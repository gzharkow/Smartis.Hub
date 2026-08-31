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
// Правила написаны так, чтобы пережить мелкие текстовые различия между
// вариантами документа (застройщик/автодилер, облако/коробка): разное число
// прочерков, случайный лишний символ у одного из юристов, «пользователя»
// вместо «пользователей». Расхождение крупнее — например, другая структура
// таблицы — правилами не покрыть, тогда сначала смотрите документ через
// --inspect и правьте здесь.

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

/** Экранирует тире для regex — «–»/«—» не спецсимволы, но пусть будет
 * безопасно на случай, если в документе окажется что-то из \-подобных. */
function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function rules(dash: string): TextRule[] {
  const d = escapeForRegex(dash);

  // Денежные ячейки таблиц 2.2 и 2.3 в норме — «_____,00»: пять прочерков.
  // В одном из присланных документов (автодилер, облако) у части ячеек
  // 2.2 их шесть, а сумма НДС и вовсе набрана как «____0,00» — четыре
  // прочерка и залипший литеральный ноль вместо пятого. Это не наша
  // договорённость, а опечатка составителя, но подстановка обязана
  // сработать несмотря на неё — отсюда `[_0]+` вместо жёстких пяти «_».
  const money = /[_0]+,00/;

  return [
    // п.1.2.1 и п.1.2.2 — платёж за этап, сумма в обоих абзацах одна и та же.
    // Копейки метка, а не текст: половина нечётной суммы даёт 50 копеек.
    // Хвостовая точка перед запятой — опциональна: в одном из документов
    // юрист поставил лишнюю («…рублей., Заказчик»), в другом её нет.
    {
      find: new RegExp(
        `_+ \\(_+\\) рублей _+ копеек, включая НДС \\(5%\\) ${d} ${money.source} рублей\\.?`,
        "g",
      ),
      replace:
        `{{STAGE_SUM}} ({{STAGE_WORDS}}) {{STAGE_RUB}} {{STAGE_KOP}} копеек, ` +
        `включая НДС (5%) ${dash} {{STAGE_VAT}} рублей`,
      expect: 2,
    },
    // п.2.1 — ежемесячная стоимость. Копейки здесь всегда «00» текстом —
    // сумма договора на момент подписания целая по условию заказчика.
    {
      find: new RegExp(
        `_+ \\(_+\\) рублей 00 копеек, включая НДС \\(5%\\) ${d} ${money.source} рублей`,
        "g",
      ),
      replace:
        `{{MONTH_SUM}} ({{MONTH_WORDS}}) {{MONTH_RUB}} {{MONTH_KOP}} копеек, ` +
        `включая НДС (5%) ${dash} {{MONTH_VAT}} рублей`,
      expect: 1,
    },

    // Подписи строк таблицы 2.2: количество и склонение приходят одной
    // меткой, потому что «1 объект» и «3 объекта» — разные формы слова.
    // У застройщика строка про «объекты недвижимости», у автодилера — про
    // «дилерские центры» (иногда с шальной цифрой-примером внутри
    // прочерков, «за 1 ____ дилерских центров») — оба варианта в одном
    // правиле.
    {
      find: /за\s+\d*\s*_+\s*(?:объектов недвижимости|дилерских центров)/g,
      replace: "за {{T22_OBJECTS_LABEL}}",
      expect: 1,
    },
    {
      find: /за\s+_+\s+авторизованн\S+\s+пользовател\S+\s+Заказчика/g,
      replace: "за {{T22_USERS_LABEL}}",
      expect: 1,
    },

    // Денежные ячейки таблиц — по порядку сверху вниз.
    {
      find: new RegExp(`${money.source} рублей, без НДС`, "g"),
      replace: (i) => `{{${moneyRow(i)}_NET}} рублей, без НДС`,
      expect: MONEY_ROWS.length,
    },
    {
      find: new RegExp(
        `${money.source} рублей, включая НДС \\(5%\\) ${d} ${money.source} рублей`,
        "g",
      ),
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
