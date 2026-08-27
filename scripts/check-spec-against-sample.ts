import { readFileSync } from "node:fs";
import { extractPlainText, fillDocxStrict } from "../src/lib/docx-fill";
import { builtinSpecTemplate } from "../src/lib/spec-template";
import { deriveQuoteDocument, type BuilderCalculatorConfig } from "../src/lib/quote-calculator";
import { computeSpecValues, deriveSpecValues, specValuesToTags } from "../src/lib/spec-values";

// Сквозная сверка с заполненным вручную образцом заказчика:
//
//   npm run check:sample -- "C:\путь\SMA Спецификация с внедрением Тест КП.docx"
//
// Самая сильная проверка: генерируем Спецификацию из того же расчёта, по
// которому образец заполняли руками, и сравниваем видимый текст построчно.
//
// Ожидаемое расхождение ровно одно. В образце первая строка таблицы 2.2 —
// «178 000,00 включая НДС (5%) – 8 000,00», хотя 170 000 × 1,05 = 178 500,00
// и НДС 8 500,00. Итог 203 700 при этом посчитан верно, то есть ошибка сидит
// в одной ячейке юридического документа. Ради её устранения фича и делается,
// поэтому расхождение объявлено ожидаемым, а не подогнано под образец.
//
// Образец в репозиторий не кладём — это заполненный документ клиента. Путь
// передаётся аргументом, проверка гоняется руками при приёмке.

/** Расчёт, по которому заполняли образец: enterprise + нестандартная CRM,
 * один объект, один пользователь, загрузка медиапланов. */
const SAMPLE_CONFIG: BuilderCalculatorConfig = {
  clientType: "BUILDER",
  enterpriseLicense: true,
  customCrmIntegration: true,
  objectsCount: 1,
  supportUsersCount: 1,
  mediaPlanUpload: true,
  postViewEventsTier: "NONE",
  cdpSegments: false,
  antifraud: false,
  box: false,
};

/** Расхождения, которые мы считаем правильными: слева образец, справа наш
 * результат. Всё, чего нет в этом списке, — баг. */
const EXPECTED: { sample: string; ours: string; why: string }[] = [
  {
    sample: "178 000,00 рублей, включая НДС (5%) - 8 000,00 рублей",
    ours: "178 500,00 рублей, включая НДС (5%) - 8 500,00 рублей",
    why: "в образце арифметическая ошибка: 170 000 × 1,05 = 178 500, НДС 8 500",
  },
];

/** Неразрывные пробелы, разные тире и двойные пробелы не должны считаться
 * расхождениями: образец правили в Word, шаблон — в LibreOffice. */
function normalize(line: string): string {
  return line
    .replace(/\u00A0/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const samplePath = process.argv[2];
  if (!samplePath) {
    throw new Error(
      'Укажите путь к заполненному образцу:\n  npm run check:sample -- "…\\SMA Спецификация с внедрением Тест КП.docx"',
    );
  }

  const template = await builtinSpecTemplate("BUILDER_CLOUD");
  if (!template) throw new Error("Встроенный шаблон BUILDER_CLOUD не найден.");

  const { editable, issues } = deriveSpecValues({
    vatRatePct: 5,
    calculatorConfig: SAMPLE_CONFIG,
    sections: deriveQuoteDocument(SAMPLE_CONFIG).sections,
  });
  if (issues.length > 0) {
    console.log("Жалобы при сопоставлении:");
    for (const issue of issues) console.log(`  ${issue.code}: ${issue.message}`);
  }

  const values = computeSpecValues(editable, 5);
  const filled = await fillDocxStrict(template, specValuesToTags(values));

  const ours = (await extractPlainText(filled.bytes)).split("\n").map(normalize);
  const sample = (await extractPlainText(readFileSync(samplePath))).split("\n").map(normalize);

  console.log(`\nСтрок: наш документ ${ours.length}, образец ${sample.length}`);

  if (ours.length !== sample.length) {
    console.error(
      "\nЧисло строк не совпало — сравнивать построчно нельзя. Скорее всего, образец от другой версии шаблона.\n",
    );
    const limit = Math.max(ours.length, sample.length);
    for (let i = 0; i < limit; i++) {
      if (ours[i] !== sample[i]) {
        console.error(`  строка ${i}:\n    образец: ${sample[i] ?? "—"}\n    наш:     ${ours[i] ?? "—"}`);
      }
    }
    process.exit(1);
  }

  const unexpected: { line: number; sample: string; ours: string }[] = [];
  const matchedExpectations = new Set<number>();

  for (let i = 0; i < ours.length; i++) {
    if (ours[i] === sample[i]) continue;

    const at = EXPECTED.findIndex(
      (e) => normalize(e.sample) === sample[i] && normalize(e.ours) === ours[i],
    );
    if (at === -1) {
      unexpected.push({ line: i, sample: sample[i], ours: ours[i] });
    } else {
      matchedExpectations.add(at);
      console.log(`\n  Ожидаемое расхождение, строка ${i} — ${EXPECTED[at].why}`);
      console.log(`    образец: ${sample[i]}`);
      console.log(`    наш:     ${ours[i]}`);
    }
  }

  let failed = false;

  if (unexpected.length > 0) {
    failed = true;
    console.error(`\nНеожиданные расхождения (${unexpected.length}):`);
    for (const d of unexpected) {
      console.error(`  строка ${d.line}:\n    образец: ${d.sample}\n    наш:     ${d.ours}`);
    }
  }

  const unseen = EXPECTED.filter((_, i) => !matchedExpectations.has(i));
  if (unseen.length > 0) {
    failed = true;
    console.error("\nОжидаемые расхождения не встретились — образец или шаблон изменились:");
    for (const e of unseen) console.error(`  ${e.sample}  →  ${e.ours}`);
  }

  // Второй сценарий на том же настоящем шаблоне: позиции нет в расчёте.
  // Образца под него владелец не давал, поэтому проверяем не построчным
  // сравнением, а поведением — строка таблицы 2.2 обязана исчезнуть целиком,
  // а таблица 2.3 остаться на месте: это прайс за добавление единицы, а не
  // факт покупки.
  console.log("\nБез загрузки медиапланов — на том же шаблоне:");

  const leanConfig = { ...SAMPLE_CONFIG, mediaPlanUpload: false };
  const lean = deriveSpecValues({
    vatRatePct: 5,
    calculatorConfig: leanConfig,
    sections: deriveQuoteDocument(leanConfig).sections,
  });
  const withoutMedia = await fillDocxStrict(
    template,
    specValuesToTags(computeSpecValues(lean.editable, 5)),
  );
  const leanText = (await extractPlainText(withoutMedia.bytes)).replace(/\u00A0/g, " ");

  const expectations: [string, boolean][] = [
    ["удалена ровно одна строка таблицы", withoutMedia.removedRows === 1],
    ["строка 2.2 про медиапланы исчезла", !leanText.includes("за Импорт и Контроль")],
    ["строка 2.3 про медиапланы осталась", leanText.includes("за каждый дополнительный медиаплан")],
    ["цена за доп. медиаплан напечатана", leanText.includes("5 000,00 рублей, без НДС")],
    ["строк стало ровно на три меньше", leanText.split("\n").length === ours.length - 3],
    ["ежемесячно 198 450", leanText.includes("198 450 (сто девяносто восемь тысяч четыреста пятьдесят)")],
    ["этап 99 225", leanText.includes("99 225 (девяносто девять тысяч двести двадцать пять)")],
    ["незаполненных меток нет", !leanText.includes("{{")],
  ];

  for (const [label, ok] of expectations) {
    console.log(`  ${ok ? "✓" : "✗"} ${label}`);
    if (!ok) failed = true;
  }

  console.log(
    failed
      ? "\nСверка не прошла.\n"
      : "\nДокумент совпадает с образцом везде, кроме исправленной в нём ошибки.\n",
  );
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("\nОШИБКА:", e.message, "\n");
  process.exit(1);
});
