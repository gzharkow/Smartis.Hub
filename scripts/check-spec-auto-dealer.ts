import { readFileSync } from "node:fs";
import { extractPlainText, fillDocxStrict } from "../src/lib/docx-fill";
import { deriveQuoteDocument, type AutoDealerCalculatorConfig } from "../src/lib/quote-calculator";
import { computeSpecValues, deriveSpecValues, specValuesToTags } from "../src/lib/spec-values";

// Сквозная проверка шаблона автодилера (облако): npm run check:auto
//
// В отличие от check-spec-against-sample.ts, заполненного вручную образца для
// этого шаблона нет — сверять построчно не с чем. Поэтому здесь два
// сценария по образцу «без загрузки медиапланов» из той проверки: полный
// расчёт (все четыре строки таблицы 2.2 печатаются) и урезанный (одна
// удаляется целиком). Оба проверяют, что документ закрывается без единой
// незаполненной метки и что счётная строка называется «дилерский центр»,
// а не «объект недвижимости» — унаследованный от шаблона застройщика ярлык,
// который для автодилера был бы прямой ошибкой в тексте договора.

let failed = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const a = String(actual);
  const e = String(expected);
  if (a === e) {
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${label}\n      ожидалось: ${e}\n      получено:  ${a}`);
  }
}

const CONFIG: AutoDealerCalculatorConfig = {
  clientType: "AUTO_DEALER",
  customCrmIntegration: true,
  objectsCount: 2,
  supportUsersCount: 3,
  mediaPlanUpload: true,
  postViewAvitoTier: "NONE",
  postViewAutoRuTier: "NONE",
  postViewOtherEventsTier: "NONE",
  mindbox: false,
  cdpSegments: false,
  box: false,
};

async function render(config: AutoDealerCalculatorConfig, template: Buffer) {
  const { editable, issues } = deriveSpecValues({
    vatRatePct: 5,
    calculatorConfig: config,
    sections: deriveQuoteDocument(config).sections,
  });
  const values = computeSpecValues(editable, 5, "AUTO_DEALER");
  const filled = await fillDocxStrict(template, specValuesToTags(values));
  const text = (await extractPlainText(filled.bytes)).replace(/ /g, " ");
  return { issues, values, filled, text };
}

async function main() {
  // Шаблон автодилера пока не входит во встроенную поставку (его грузит
  // админ в «Настройки → Шаблоны документов»), поэтому читаем файл прямо
  // из templates/spec/ — этот скрипт проверяет именно то, что туда ляжет
  // после npm run prepare:spec.
  const template = readFileSync("templates/spec/auto-dealer-cloud.docx");

  console.log("\nПолный расчёт (объекты, пользователи, медиапланы, кастомная CRM):");
  {
    const { issues, values, filled, text } = await render(CONFIG, template);

    check("жалоб нет", issues.map((i) => i.code).join(",") || "—", "—");
    check("строк не удалено", filled.removedRows, 0);
    check("незаполненных меток нет", !text.includes("{{"), true);

    // 90 000 (техподдержка) + 50 000 (кастомная CRM) = 140 000.
    check("платформа без НДС", values.t22.platform.net.toFixed(2), "140000.00");
    check("объекты (2 × 6 000)", values.t22.objects!.net.toFixed(2), "12000.00");
    check("пользователи (3 × 4 000)", values.t22.users!.net.toFixed(2), "12000.00");
    // Медиапланы считаются по числу объектов — 2 × 3 500.
    check("медиапланы (2 × 3 500)", values.t22.mediaPlan!.net.toFixed(2), "7000.00");
    check("ежемесячно с НДС", values.monthly.gross.toFixed(2), "179550.00");
    check("этап с НДС", values.stage.gross.toFixed(2), "89775.00");

    check("в документе нет слова «недвижимости»", !text.includes("недвижимости"), true);
    check("подпись объектов в тексте", text.includes("за 2 дилерских центра"), true);
    check(
      "подпись пользователей в тексте",
      text.includes("за 3 авторизованных пользователей Заказчика"),
      true,
    );
    check(
      "строка про доп. дилерский центр на месте",
      text.includes("за каждый дополнительный дилерский центр"),
      true,
    );
    check(
      "сумма этапа прописью в тексте",
      text.includes("89 775 (восемьдесят девять тысяч семьсот семьдесят пять) рублей 00 копеек"),
      true,
    );
  }

  console.log("\nБез загрузки медиапланов — строка таблицы 2.2 удаляется целиком:");
  {
    const { filled, text } = await render({ ...CONFIG, mediaPlanUpload: false }, template);

    check("удалена ровно одна строка", filled.removedRows, 1);
    check("строка про медиапланы исчезла", !text.includes("за Импорт и Контроль"), true);
    check(
      "цена 2.3 за доп. медиаплан всё равно напечатана",
      text.includes("за каждый дополнительный медиаплан"),
      true,
    );
    check("незаполненных меток нет", !text.includes("{{"), true);
  }

  console.log(
    failed === 0
      ? "\nШаблон автодилера собирается корректно.\n"
      : `\nНе сошлось: ${failed}.\n`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("\nОШИБКА:", e.message, "\n");
  process.exit(1);
});
