import JSZip from "jszip";

// Подстановка значений в .docx без пересборки документа.
//
// Требование заказчика сформулировано жёстко: шрифты и вёрстка согласованного
// юристами шаблона не должны пострадать. Поэтому здесь нет ни генератора
// документов, ни docxtemplater — меняется только текст внутри уже
// существующих <w:t>, все прочие части архива (styles.xml, numbering.xml,
// fontTable.xml, темы, связи) переезжают в результат нетронутыми. Это делает
// требование проверяемым инвариантом, а не обещанием: см.
// scripts/check-docx-fill.ts.
//
// Главная сложность — Word режет текст на runs произвольно (ревизии, метки
// проверки орфографии), поэтому набранная в редакторе метка {{MONTH_SUM}}
// в XML нередко выглядит как «{{», «MONTH», «_SUM}}» в трёх соседних <w:r>.
// Отсюда приём: внутри абзаца текст всех <w:t> склеивается в одну плоскую
// строку, поиск идёт по ней, а правка возвращается по карте смещений.
//
// Модуль серверный по смыслу (Buffer, вызывается из route handlers и server
// actions), но без "server-only": тот бросает при импорте вне Next, а
// scripts/check-docx-fill.ts проверяет здешние инварианты напрямую под tsx.

/** Части документа, где может встретиться текст. Всё остальное не трогаем. */
const TEXT_PARTS = /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/;

const TAG_RE = /\{\{([A-Z0-9_]+)\}\}/g;

export type FillResult = {
  bytes: Buffer;
  /** Метки, которые нашлись в шаблоне и получили значение. */
  replaced: string[];
  /** Метки, нашедшиеся в шаблоне, но без значения — документ выпускать нельзя. */
  leftover: string[];
  /** Переданные значения, для которых метки в шаблоне не нашлось. */
  unused: string[];
  /** Сколько строк таблиц удалено (значение метки — null). */
  removedRows: number;
};

/**
 * Заполняет шаблон. Значение `null` означает «удалить строку таблицы, внутри
 * которой стоит эта метка» — единственная структурная операция, нужна для
 * позиций, которых нет в расчёте.
 */
export async function fillDocx(
  templateBytes: Buffer | Uint8Array,
  values: Record<string, string | null>,
): Promise<FillResult> {
  const replaced = new Set<string>();
  const leftover = new Set<string>();
  let removedRows = 0;

  const bytes = await editDocx(templateBytes, (xml) => {
    const result = editParagraphs(xml, (paragraph) => {
      for (const match of paragraph.flat.matchAll(TAG_RE)) {
        const tag = match[1];
        if (!(tag in values)) {
          leftover.add(tag);
          continue;
        }

        replaced.add(tag);
        const start = match.index;
        const end = match.index + match[0].length;
        const value = values[tag];

        // null — «позиции нет в расчёте», строка таблицы уходит целиком.
        // Если метка стоит вне таблицы, удалять нечего: подставляем пустую
        // строку, лишь бы «{{…}}» не осталось в документе.
        if (value === null && paragraph.removeRow(start)) continue;

        paragraph.replace(start, end, value ?? "");
      }
    });

    // Считаем строки, а не сработавшие метки: в одной строке таблицы их
    // обычно три (без НДС, с НДС, сумма НДС), и все три просят удалить одну
    // и ту же строку.
    removedRows += result.removedRows;
    return result.xml;
  });

  return {
    bytes,
    replaced: [...replaced].sort(),
    leftover: [...leftover].sort(),
    unused: Object.keys(values)
      .filter((tag) => !replaced.has(tag))
      .sort(),
    removedRows,
  };
}

/** Как fillDocx, но падает, если в документе остались незаполненные метки.
 * Выпустить Спецификацию с «{{MONTH_SUM}}» внутри нельзя ни при каких
 * обстоятельствах, а глазами в PDF такое ловится плохо. */
export async function fillDocxStrict(
  templateBytes: Buffer | Uint8Array,
  values: Record<string, string | null>,
): Promise<FillResult> {
  const result = await fillDocx(templateBytes, values);
  if (result.leftover.length > 0) {
    throw new Error(
      `В шаблоне остались незаполненные метки: ${result.leftover.join(", ")}. ` +
        "Проверьте шаблон в настройках — возможно, он от другой версии Спецификации.",
    );
  }
  return result;
}

export type TextRule = {
  /** Что искать в видимом тексте абзаца, как его видит человек в Word. */
  find: string;
  /** Строка — или функция от порядкового номера вхождения в документе, если
   * одинаковые с виду места надо разметить разными метками (денежные ячейки
   * таблиц Спецификации отличаются только положением). */
  replace: string | ((occurrence: number) => string);
  /** Сколько раз правило обязано сработать; иначе подготовка шаблона падает. */
  expect?: number;
};

/**
 * Замена произвольного текста — **только для подготовки шаблонов**
 * (scripts/prepare-spec-template.ts), где прочерки согласованного документа
 * превращаются в метки. Боевой путь выпуска Спецификации этой функцией не
 * пользуется: там подстановка идёт строго по меткам, и никакой другой текст
 * тронуть нельзя.
 */
export async function replaceTextInDocx(
  templateBytes: Buffer | Uint8Array,
  rules: TextRule[],
): Promise<{ bytes: Buffer; applied: number[] }> {
  const applied = rules.map(() => 0);

  // Строк здесь не удаляем — правила подготовки шаблона только меняют текст.
  const bytes = await editDocx(templateBytes, (xml) =>
    editParagraphs(xml, (paragraph) => {
      rules.forEach((rule, ruleIndex) => {
        const hits: number[] = [];
        let from = paragraph.flat.indexOf(rule.find);
        while (from !== -1) {
          hits.push(from);
          from = paragraph.flat.indexOf(rule.find, from + rule.find.length);
        }

        // Номера вхождений считаем по документу слева направо — от них
        // зависит, какая метка встанет в какую строку таблицы. А сами правки
        // отдаём справа налево, иначе несколько вхождений в одном абзаце
        // сдвинут смещения друг друга.
        const before = applied[ruleIndex];
        applied[ruleIndex] += hits.length;

        for (let k = hits.length - 1; k >= 0; k--) {
          const text =
            typeof rule.replace === "string" ? rule.replace : rule.replace(before + k);
          paragraph.replace(hits[k], hits[k] + rule.find.length, text);
        }
      });
    }).xml,
  );

  const wrong = rules
    .map((rule, i) => ({ rule, count: applied[i] }))
    .filter(({ rule, count }) => rule.expect !== undefined && count !== rule.expect);

  if (wrong.length > 0) {
    const lines = wrong.map(
      ({ rule, count }) => `  «${rule.find}» — ожидалось ${rule.expect}, найдено ${count}`,
    );
    throw new Error(`Шаблон не совпал с ожиданиями:\n${lines.join("\n")}`);
  }

  return { bytes, applied };
}

/** Видимый текст документа — для валидации загружаемого шаблона и сверки
 * результата с эталоном. Абзац на строку. */
export async function extractPlainText(bytes: Buffer | Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const doc = zip.file("word/document.xml");
  if (!doc) throw new Error("Это не документ Word: внутри нет word/document.xml.");

  const xml = await doc.async("string");
  return paragraphRanges(xml)
    .map(([start, end]) => paragraphText(xml.slice(start, end)))
    .filter((line) => line.length > 0)
    .join("\n");
}

// ─────────────────────────────  Обход архива  ─────────────────────────────

async function editDocx(
  bytes: Buffer | Uint8Array,
  editXml: (xml: string) => string,
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(bytes);

  for (const path of Object.keys(zip.files)) {
    if (!TEXT_PARTS.test(path)) continue;
    const xml = await zip.files[path].async("string");
    const next = editXml(xml);
    if (next !== xml) zip.file(path, next);
  }

  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

// ─────────────────────────────  Разбор XML  ─────────────────────────────

type TextNode = {
  /** Смещение открывающего тега <w:t …>. */
  openStart: number;
  /** Смещение сразу после открывающего тега — оно же начало содержимого. */
  contentStart: number;
  contentEnd: number;
  openTag: string;
};

/** Абзацы. Метка никогда не пересекает границу абзаца, поэтому это
 * естественная и безопасная единица разбора. */
function paragraphRanges(xml: string): [number, number][] {
  const ranges: [number, number][] = [];
  for (const m of xml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)) {
    ranges.push([m.index, m.index + m[0].length]);
  }
  return ranges;
}

/** Текстовые узлы внутри куска XML. Самозакрывающиеся <w:t/> пропускаем:
 * содержимого у них нет, а значение мы всегда пишем в узел, где лежит начало
 * совпадения, — то есть заведомо непустой. Похожие на вид <w:tab/>, <w:tbl>,
 * <w:tc> и <w:tr> регулярка не ловит: после «w:t» она требует пробел или «>». */
function textNodes(fragment: string): TextNode[] {
  const nodes: TextNode[] = [];
  for (const m of fragment.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)) {
    const openTag = m[0].slice(0, m[0].length - m[1].length - "</w:t>".length);
    nodes.push({
      openStart: m.index,
      contentStart: m.index + openTag.length,
      contentEnd: m.index + openTag.length + m[1].length,
      openTag,
    });
  }
  return nodes;
}

/** Текст абзаца в порядке документа: содержимое <w:t> вперемешку с
 * табуляциями и переводами строк, которые лежат между runs отдельными
 * элементами. */
function paragraphText(paragraph: string): string {
  const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>/g;
  let out = "";
  for (const m of paragraph.matchAll(re)) {
    if (m[0] === "<w:tab/>") out += "\t";
    else if (m[0] === "<w:br/>") out += "\n";
    else out += unescapeXml(m[1]);
  }
  return out.trim();
}

/** Диапазоны строк таблиц, с учётом вложенных таблиц: для позиции потом
 * выбирается самая внутренняя строка, которая её содержит. */
function rowRanges(xml: string): [number, number][] {
  const ranges: [number, number][] = [];
  const stack: number[] = [];
  for (const m of xml.matchAll(/<w:tr(?:\s[^>]*)?>|<\/w:tr>/g)) {
    if (m[0] === "</w:tr>") {
      const start = stack.pop();
      if (start !== undefined) ranges.push([start, m.index + m[0].length]);
    } else {
      stack.push(m.index);
    }
  }
  return ranges;
}

// ─────────────────────────────  Правка абзацев  ─────────────────────────────

type Edit = { start: number; end: number; text: string };

/** Абзац, каким его видит правило замены: плоский текст плюс две операции. */
export type ParagraphView = {
  /** Видимый текст абзаца, склеенный из всех <w:t> без учёта границ runs. */
  flat: string;
  /** Заменить [start, end) плоского текста. Значение уходит в тот <w:t>, где
   * начинается совпадение, и наследует его форматирование. */
  replace(start: number, end: number, text: string): void;
  /** Удалить строку таблицы, в которой лежит позиция. false — позиция не
   * внутри таблицы, удалять нечего. */
  removeRow(flatIndex: number): boolean;
};

function editParagraphs(
  xml: string,
  visit: (paragraph: ParagraphView) => void,
): { xml: string; removedRows: number } {
  const edits: Edit[] = [];
  const rowsToRemove: [number, number][] = [];
  // Узлы, которым нужен xml:space="preserve". Собираем в map, а не правим
  // сразу: в один <w:t> может попасть несколько замен, и две одинаковые
  // правки открывающего тега выглядели бы как пересечение.
  const needPreserve = new Map<number, TextNode>();

  const rows = rowRanges(xml);

  for (const [paraStart, paraEnd] of paragraphRanges(xml)) {
    const paragraph = xml.slice(paraStart, paraEnd);
    const nodes = textNodes(paragraph).map((n) => ({
      openStart: paraStart + n.openStart,
      contentStart: paraStart + n.contentStart,
      contentEnd: paraStart + n.contentEnd,
      openTag: n.openTag,
    }));
    if (nodes.length === 0) continue;

    // Плоский текст абзаца плюс карта «индекс в плоской строке → узел».
    // Промежуточные элементы (rPr, proofErr, закладки) в неё не попадают,
    // поэтому разрыв совпадения между runs здесь просто не существует.
    //
    // Склеиваем сырое содержимое, не расшифровывая сущности: иначе смещения
    // разъедутся с исходным XML.
    let flat = "";
    const owner: number[] = [];
    const offsetInNode: number[] = [];
    nodes.forEach((node, i) => {
      const content = xml.slice(node.contentStart, node.contentEnd);
      for (let k = 0; k < content.length; k++) {
        owner.push(i);
        offsetInNode.push(k);
      }
      flat += content;
    });

    visit({
      flat,

      replace(start, end, text) {
        if (start >= end || end > flat.length) return;
        const first = owner[start];
        const last = owner[end - 1];
        const escaped = escapeXml(text);

        if (first === last) {
          const node = nodes[first];
          edits.push({
            start: node.contentStart + offsetInNode[start],
            end: node.contentStart + offsetInNode[end - 1] + 1,
            text: escaped,
          });
          needPreserve.set(node.openStart, node);
          return;
        }

        // Значение целиком уходит в первый узел совпадения. Промежуточные
        // узлы опустошаются, но сами <w:r> остаются на месте: количество
        // элементов в документе не меняется.
        const firstNode = nodes[first];
        edits.push({
          start: firstNode.contentStart + offsetInNode[start],
          end: firstNode.contentEnd,
          text: escaped,
        });
        needPreserve.set(firstNode.openStart, firstNode);

        for (let i = first + 1; i < last; i++) {
          edits.push({ start: nodes[i].contentStart, end: nodes[i].contentEnd, text: "" });
        }

        const lastNode = nodes[last];
        edits.push({
          start: lastNode.contentStart,
          end: lastNode.contentStart + offsetInNode[end - 1] + 1,
          text: "",
        });
      },

      removeRow(flatIndex) {
        const node = nodes[owner[flatIndex]];
        if (!node) return false;
        const row = innermostRow(rows, node.openStart);
        if (!row) return false;
        rowsToRemove.push(row);
        return true;
      },
    });
  }

  for (const node of needPreserve.values()) {
    if (node.openTag.includes('xml:space="preserve"')) continue;
    edits.push({
      start: node.openStart,
      end: node.openStart + node.openTag.length,
      text: node.openTag.replace(/^<w:t/, '<w:t xml:space="preserve"'),
    });
  }

  if (edits.length === 0 && rowsToRemove.length === 0) return { xml, removedRows: 0 };

  // Правки внутри удаляемых строк бессмысленны — строки уйдут целиком.
  // dedupeRanges нужен потому, что одну строку обычно просят удалить сразу
  // несколько меток из её ячеек.
  const uniqueRows = dedupeRanges(rowsToRemove);
  const kept = edits.filter((e) => !uniqueRows.some(([s, x]) => e.start >= s && e.end <= x));

  return {
    xml: applyEdits(xml, [
      ...kept,
      ...uniqueRows.map(([start, end]) => ({ start, end, text: "" })),
    ]),
    removedRows: uniqueRows.length,
  };
}

function innermostRow(rows: [number, number][], offset: number): [number, number] | null {
  let best: [number, number] | null = null;
  for (const row of rows) {
    if (offset < row[0] || offset >= row[1]) continue;
    if (best === null || row[1] - row[0] < best[1] - best[0]) best = row;
  }
  return best;
}

function dedupeRanges(ranges: [number, number][]): [number, number][] {
  const seen = new Set<string>();
  const out: [number, number][] = [];
  for (const r of ranges) {
    const key = `${r[0]}:${r[1]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

/** Применяем справа налево, чтобы смещения не поехали. Пересечение правок —
 * баг разбора, а не свойство шаблона, поэтому падаем громко. */
function applyEdits(xml: string, edits: Edit[]): string {
  const sorted = [...edits].sort((a, b) => b.start - a.start || b.end - a.end);
  let out = xml;
  let previousStart = Infinity;
  for (const edit of sorted) {
    if (edit.end > previousStart) {
      throw new Error(
        `docx-fill: пересекающиеся правки на позиции ${edit.start}—${edit.end}. Это баг разбора, а не шаблона.`,
      );
    }
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
    previousStart = edit.start;
  }
  return out;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function unescapeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
