import { readFileSync, writeFileSync } from "node:fs";
import { extractPlainText, replaceTextInDocx, type TextRule } from "../src/lib/docx-fill";
import { SPEC_TAG_NAMES, findTags } from "../src/lib/spec-tags";

// Превращает согласованный юристами шаблон Спецификации в шаблон с метками:
//
//   npm run prepare:spec -- --inspect "исходник.docx"
//   npm run prepare:spec -- "исходник.docx" templates/spec/builder-cloud.docx
//
// Прочерки вида «____ (____) рублей ___ копеек» заменяются на {{STAGE_SUM}}
// и соседей. Делать это руками в Word нельзя: редактор режет набранный текст
// на runs как ему вздумается, и метка легко оказывается разорванной посреди
// служебной разметки. Здесь замена идёт по видимому тексту абзаца, а
// форматирование остаётся нетронутым — тем же механизмом, что и боевая
// подстановка (см. src/lib/docx-fill.ts).
//
// Правила написаны под шаблон застройщика «SMA Спецификация с внедрением».
// Для автодилерского и коробочного формулировки другие — сначала посмотрите
// документ через --inspect и поправьте правила здесь.

/** Денежные ячейки таблиц 2.2 и 2.3 текстом неразличимы: во всех стоит
 * «_____,00 рублей, без НДС». Единственное, что их различает, — порядок в
 * документе, поэтому метки раздаются по счётчику вхождений. */
const MONEY_ROWS = [
  "T22_PLATFORM",
  "T22_OBJECTS",
  "T22_USERS",
  "T22_MEDIAPLAN",
  "T23_OBJECT",
  "T23_USER",
  "T23_MEDIAPLAN",
] as const;

function moneyRow(occurrence: number): string {
  const row = MONEY_ROWS[occurrence];
  if (!row) {
    throw new Error(
      `Денежных ячеек в документе больше, чем строк в MONEY_ROWS (${MONEY_ROWS.length}). Проверьте шаблон.`,
    );
  }
  return row;
}

function rules(dash: string): TextRule[] {
  return [
    // п.1.2.1 и п.1.2.2 — платёж за этап, сумма в обоих абзацах одна и та же.
    // Копейки метка, а не текст: половина нечётной суммы даёт 50 копеек.
    {
      find: `____ (____) рублей ___ копеек, включая НДС (5%) ${dash} _____,00 рублей`,
      replace:
        `{{STAGE_SUM}} ({{STAGE_WORDS}}) {{STAGE_RUB}} {{STAGE_KOP}} копеек, ` +
        `включая НДС (5%) ${dash} {{STAGE_VAT}} рублей`,
      expect: 2,
    },
    // п.2.1 — ежемесячная стоимость.
    {
      find: `____ (____) рублей 00 копеек, включая НДС (5%) ${dash} _____,00 рублей`,
      replace:
        `{{MONTH_SUM}} ({{MONTH_WORDS}}) {{MONTH_RUB}} {{MONTH_KOP}} копеек, ` +
        `включая НДС (5%) ${dash} {{MONTH_VAT}} рублей`,
      expect: 1,
    },

    // Подписи строк таблицы 2.2: количество и склонение приходят одной
    // меткой, потому что «1 объект» и «3 объекта» — разные формы слова.
    { find: "за ___объектов недвижимости", replace: "за {{T22_OBJECTS_LABEL}}", expect: 1 },
    {
      find: "за ___ авторизованных пользователей Заказчика",
      replace: "за {{T22_USERS_LABEL}}",
      expect: 1,
    },

    // Денежные ячейки таблиц — по порядку сверху вниз.
    {
      find: "_____,00 рублей, без НДС",
      replace: (i) => `{{${moneyRow(i)}_NET}} рублей, без НДС`,
      expect: MONEY_ROWS.length,
    },
    {
      find: `_____,00 рублей, включая НДС (5%) ${dash} _____,00 рублей`,
      replace: (i) =>
        `{{${moneyRow(i)}_GROSS}} рублей, включая НДС (5%) ${dash} {{${moneyRow(i)}_VAT}} рублей`,
      expect: MONEY_ROWS.length,
    },
  ];
}

async function inspect(path: string) {
  const text = await extractPlainText(readFileSync(path));
  console.log("\nСтроки с прочерками и счётными местами (как есть, с точными символами):\n");
  text.split("\n").forEach((line, i) => {
    if (/_{2,}|за \d|объект|пользовател|включая НДС/i.test(line)) {
      console.log(`${String(i).padStart(3)}  ${JSON.stringify(line)}`);
    }
  });
  const tags = findTags(text);
  console.log("\nУже проставленные метки:", tags.join(", ") || "нет");
}

/** В шаблоне перед суммой НДС стоит тире, и какое именно — дефис или
 * короткое тире — заранее не известно: документ правили в разных редакторах.
 * Пробуем оба, вместо того чтобы гадать. */
function pickDash(text: string): string {
  for (const dash of ["-", "–", "—"]) {
    if (text.includes(`включая НДС (5%) ${dash} _____,00`)) return dash;
  }
  throw new Error(
    'В документе не найдено ни одного «включая НДС (5%) … _____,00». Посмотрите его через --inspect.',
  );
}

async function prepare(input: string, output: string) {
  const source = readFileSync(input);
  const sourceText = await extractPlainText(source);
  const dash = pickDash(sourceText);
  console.log(`\nТире перед суммой НДС: ${JSON.stringify(dash)}`);

  const ruleSet = rules(dash);
  const { bytes, applied } = await replaceTextInDocx(source, ruleSet);

  console.log("\nЗамены:");
  ruleSet.forEach((rule, i) => {
    console.log(`  ${String(applied[i]).padStart(2)}×  ${rule.find}`);
  });

  const text = await extractPlainText(bytes);
  const tags = findTags(text);
  const unknown = tags.filter((t) => !SPEC_TAG_NAMES.has(t));
  const missing = [...SPEC_TAG_NAMES].filter((t) => !tags.includes(t));

  console.log(`\nМеток в результате: ${tags.length} из ${SPEC_TAG_NAMES.size}`);
  if (unknown.length > 0) console.log(`  неизвестные: ${unknown.join(", ")}`);
  if (missing.length > 0) console.log(`  не проставлены: ${missing.join(", ")}`);

  const leftoverBlanks = text.split("\n").filter((line) => /_{3,}/.test(line));
  if (leftoverBlanks.length > 0) {
    console.log("\n  Остались прочерки (это нормально для реквизитов и подписей):");
    for (const line of leftoverBlanks) console.log(`    ${line.slice(0, 100)}`);
  }

  writeFileSync(output, bytes);
  console.log(`\nГотово: ${output}\n`);

  if (unknown.length > 0 || missing.length > 0) {
    console.error("Шаблон неполный — выпускать Спецификацию по нему нельзя.\n");
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--inspect") {
    if (!args[1]) throw new Error("Укажите путь к .docx");
    return inspect(args[1]);
  }
  if (args.length < 2) {
    throw new Error(
      'Использование:\n  npm run prepare:spec -- --inspect "исходник.docx"\n' +
        '  npm run prepare:spec -- "исходник.docx" "результат.docx"',
    );
  }
  return prepare(args[0], args[1]);
}

main().catch((e) => {
  console.error("\nОШИБКА:", e.message, "\n");
  process.exit(1);
});
