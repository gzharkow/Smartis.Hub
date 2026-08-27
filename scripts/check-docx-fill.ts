import JSZip from "jszip";
import { extractPlainText, fillDocx } from "../src/lib/docx-fill";

// Инвариант «документ не пересобран»: npm run check:docx
//
// Главная гарантия, которую фича даёт заказчику — шрифты и вёрстка
// согласованного шаблона не страдают. Здесь это проверяется механически:
// после подстановки все части архива кроме word/document.xml обязаны совпасть
// побайтово, а в самом document.xml не должно измениться ни одного элемента —
// только текст внутри <w:t> и атрибут xml:space.
//
// Фикстура нарочно устроена неудобно: метка {{STAGE_SUM}} разорвана на три
// <w:r> (так Word режет текст сам по себе), а в одном <w:t> сидят сразу три
// метки подряд.

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

const DOCUMENT_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>` +
  `<w:p><w:pPr><w:jc w:val="both"/></w:pPr>` +
  `<w:r><w:rPr><w:b/></w:rPr><w:t>За ЭТАП 1 и 2 – {{</w:t></w:r>` +
  `<w:r><w:rPr><w:b/></w:rPr><w:t>STAGE_</w:t></w:r>` +
  `<w:r><w:rPr><w:b/></w:rPr><w:t>SUM}} ({{STAGE_WORDS}}) {{STAGE_RUB}} {{STAGE_KOP}} копеек</w:t></w:r>` +
  `</w:p>` +
  `<w:tbl>` +
  `<w:tr><w:tc><w:p><w:r><w:t>{{T22_OBJECTS_LABEL}}</w:t></w:r></w:p></w:tc>` +
  `<w:tc><w:p><w:r><w:t>{{T22_OBJECTS_NET}}</w:t></w:r></w:p></w:tc></w:tr>` +
  `<w:tr><w:tc><w:p><w:r><w:t>за медиапланы</w:t></w:r></w:p></w:tc>` +
  `<w:tc><w:p><w:r><w:t>{{T22_MEDIAPLAN_NET}}</w:t></w:r></w:p></w:tc></w:tr>` +
  `<w:tr><w:tc><w:p><w:r><w:t>за пользователей</w:t></w:r></w:p></w:tc>` +
  `<w:tc><w:p><w:r><w:t>{{T22_USERS_NET}}</w:t></w:r></w:p></w:tc></w:tr>` +
  `</w:tbl>` +
  `<w:p><w:r><w:t xml:space="preserve">Итого </w:t></w:r><w:r><w:t>{{MONTH_SUM}} за месяц</w:t></w:r></w:p>` +
  `</w:body></w:document>`;

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults/></w:styles>`;

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>`;

async function buildFixture(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", CONTENT_TYPES);
  zip.file("_rels/.rels", `<?xml version="1.0"?><Relationships/>`);
  zip.file("word/document.xml", DOCUMENT_XML);
  zip.file("word/styles.xml", STYLES_XML);
  zip.file("word/fontTable.xml", `<?xml version="1.0"?><w:fonts/>`);
  return zip.generateAsync({ type: "nodebuffer" });
}

function countOf(xml: string, pattern: RegExp): number {
  return [...xml.matchAll(pattern)].length;
}

async function main() {
  const template = await buildFixture();

  const result = await fillDocx(template, {
    STAGE_SUM: "101 850",
    STAGE_WORDS: "сто одна тысяча восемьсот пятьдесят",
    STAGE_RUB: "рублей",
    STAGE_KOP: "00",
    T22_OBJECTS_LABEL: "1 объект недвижимости",
    T22_OBJECTS_NET: "15 000,00",
    // Позиции нет в расчёте — строка таблицы уходит целиком.
    T22_MEDIAPLAN_NET: null,
    T22_USERS_NET: "4 000,00",
    MONTH_SUM: "203 700",
  });

  console.log("\nПодстановка:");
  check("незаполненных меток нет", result.leftover.join(",") || "—", "—");
  check("лишних значений нет", result.unused.join(",") || "—", "—");
  check("удалена одна строка таблицы", result.removedRows, 1);

  const text = await extractPlainText(result.bytes);
  const lines = text.split("\n");

  console.log("\nТекст результата:");
  check(
    "метка, разорванная на три run, собрана",
    lines[0],
    "За ЭТАП 1 и 2 – 101 850 (сто одна тысяча восемьсот пятьдесят) рублей 00 копеек",
  );
  check("подпись строки таблицы", lines[1], "1 объект недвижимости");
  check("сумма строки таблицы", lines[2], "15 000,00");
  check("строка медиапланов исчезла", text.includes("за медиапланы"), false);
  check("строка пользователей осталась", lines[3], "за пользователей");
  check("сумма пользователей", lines[4], "4 000,00");
  check("последний абзац", lines[5], "Итого 203 700 за месяц");
  check("фигурных скобок не осталось", text.includes("{{"), false);

  console.log("\nИнвариант «документ не пересобран»:");
  const before = await JSZip.loadAsync(template);
  const after = await JSZip.loadAsync(result.bytes);

  check(
    "состав архива не изменился",
    Object.keys(after.files).sort().join(","),
    Object.keys(before.files).sort().join(","),
  );

  for (const path of Object.keys(before.files)) {
    if (path === "word/document.xml") continue;
    const a = await before.files[path].async("string");
    const b = await after.files[path].async("string");
    check(`${path} не тронут`, b === a, true);
  }

  const src = await before.files["word/document.xml"].async("string");
  const out = await after.files["word/document.xml"].async("string");

  // Строка таблицы уходит вместе со своими ячейками, абзацами и runs — это
  // единственная структурная операция, и она ровно такого размера.
  check("строк таблицы меньше ровно на одну", countOf(out, /<w:tr[ >]/g), countOf(src, /<w:tr[ >]/g) - 1);
  check("ячеек меньше на две", countOf(out, /<w:tc[ >]/g), countOf(src, /<w:tc[ >]/g) - 2);
  check("абзацев меньше на два", countOf(out, /<w:p[ >]/g), countOf(src, /<w:p[ >]/g) - 2);
  check("runs меньше на два", countOf(out, /<w:r[ >]/g), countOf(src, /<w:r[ >]/g) - 2);
  check("таблиц столько же", countOf(out, /<w:tbl[ >]/g), countOf(src, /<w:tbl[ >]/g));
  check("свойства абзаца на месте", out.includes('<w:jc w:val="both"/>'), true);
  check("жирность не потеряна", countOf(out, /<w:b\/>/g), countOf(src, /<w:b\/>/g));
  check("xml:space проставлен", out.includes('<w:t xml:space="preserve">За ЭТАП'), true);

  // Без удаления строк документ обязан сохранить структуру до последнего
  // элемента: это и есть обещание «шрифты и вёрстка не пострадают».
  console.log("\nБез удаления строк — ни одного элемента не добавлено и не убрано:");
  const intact = await fillDocx(template, {
    STAGE_SUM: "203 700",
    STAGE_WORDS: "двести три тысячи семьсот",
    STAGE_RUB: "рублей",
    STAGE_KOP: "50",
    T22_OBJECTS_LABEL: "3 объекта недвижимости",
    T22_OBJECTS_NET: "45 000,00",
    T22_MEDIAPLAN_NET: "5 000,00",
    T22_USERS_NET: "4 000,00",
    MONTH_SUM: "203 700",
  });
  check("строк не удалено", intact.removedRows, 0);

  const kept = await (await JSZip.loadAsync(intact.bytes)).files["word/document.xml"].async("string");
  for (const [name, re] of [
    ["абзацев", /<w:p[ >]/g],
    ["runs", /<w:r[ >]/g],
    ["оформлений run", /<w:rPr[ >]/g],
    ["текстовых узлов", /<w:t[ >]/g],
    ["ячеек", /<w:tc[ >]/g],
    ["строк таблиц", /<w:tr[ >]/g],
    ["таблиц", /<w:tbl[ >]/g],
  ] as const) {
    check(`${name} столько же`, countOf(kept, re), countOf(src, re));
  }
  check("копейки «50» подставились", (await extractPlainText(intact.bytes)).includes("рублей 50 копеек"), true);

  console.log(
    failed === 0
      ? "\nШаблон заполняется, документ не пересобирается.\n"
      : `\nНе сошлось: ${failed}.\n`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("ОШИБКА:", e);
  process.exit(1);
});
