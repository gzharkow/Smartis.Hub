import { readFileSync, writeFileSync } from "node:fs";
import { extractPlainText } from "../src/lib/docx-fill";
import { prepareSpecTemplate } from "../src/lib/spec-prepare";
import { SPEC_TAG_NAMES, findTags } from "../src/lib/spec-tags";

// Превращает согласованный юристами шаблон Спецификации в шаблон с метками:
//
//   npm run prepare:spec -- --inspect "исходник.docx"
//   npm run prepare:spec -- "исходник.docx" templates/spec/builder-cloud.docx
//
// Правила живут в src/lib/spec-prepare.ts — их же применяет загрузка шаблона
// в «Настройки → Шаблоны документов», так что результат один и тот же. Файл,
// где метки уже стоят, можно прогонять повторно: недостающее (метка ставки,
// тариф доп. услуг) добавится, остальное не тронется.

async function inspect(path: string) {
  const text = await extractPlainText(readFileSync(path));
  console.log("\nСтроки с прочерками, ставкой и счётными местами:\n");
  text.split("\n").forEach((line, i) => {
    if (/_{2,}|за \d|объект|пользовател|НДС|астроном/i.test(line)) {
      console.log(`${String(i).padStart(3)}  ${JSON.stringify(line)}`);
    }
  });
  console.log("\nУже проставленные метки:", findTags(text).join(", ") || "нет");
}

async function prepare(input: string, output: string) {
  const { bytes, report } = await prepareSpecTemplate(readFileSync(input));

  console.log(`\nУже размечен: ${report.alreadyTagged ? "да" : "нет"}`);
  console.log(`Ставки НДС в исходнике: ${report.vatRatesFound.join(", ") || "не найдены"}`);
  console.log("\nЗамены:");
  for (const s of report.steps) console.log(`  ${String(s.count).padStart(2)}×  ${s.title}`);
  for (const w of report.warnings) console.log(`  ! ${w}`);

  const text = await extractPlainText(bytes);
  const tags = findTags(text);
  const unknown = tags.filter((t) => !SPEC_TAG_NAMES.has(t));
  const missing = [...SPEC_TAG_NAMES].filter((t) => !tags.includes(t));

  console.log(`\nМеток в результате: ${tags.length} из ${SPEC_TAG_NAMES.size}`);
  if (unknown.length > 0) console.log(`  неизвестные: ${unknown.join(", ")}`);
  if (missing.length > 0) console.log(`  не проставлены: ${missing.join(", ")}`);

  const leftoverVat = text.split("\n").filter((l) => /НДС\s*\(\s*\d/.test(l));
  if (leftoverVat.length > 0) {
    console.log("\n  Остались жёсткие ставки НДС:");
    for (const line of leftoverVat) console.log(`    ${line.slice(0, 100)}`);
  }

  writeFileSync(output, bytes);
  console.log(`\nГотово: ${output}\n`);

  if (unknown.length > 0 || missing.length > 0 || leftoverVat.length > 0) {
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
