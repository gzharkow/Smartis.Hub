import DOMPurify from "isomorphic-dompurify";

// Описание хаба — это HTML, набранный человеком в редакторе, и показываем мы его
// клиентам на публичной витрине. Без очистки туда можно вписать скрипт, который
// выполнится в браузере клиента на нашем домене: подменить содержимое страницы,
// увести человека на поддельную форму. Пишут описания свои сотрудники, но
// «свои» — это до первой угнанной учётки.
//
// Чистим И при сохранении, И при показе. Двойная работа тут намеренна: если
// в базу однажды попадёт грязь в обход формы, витрина всё равно не выстрелит.

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "u",
  "s",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "a",
  "blockquote",
];

const ALLOWED_ATTR = ["href", "target", "rel"];

// Только эти четыре вида ссылок. Список нарочно короткий и явный: всё, чего
// здесь нет, отсекается — включая javascript:, на котором строится добрая
// половина попыток внедрения скриптов через ссылки.
// Относительные ссылки и якоря тоже отсекаются, и это правильно: описание
// хаба ссылается наружу, внутренних переходов в нём быть не должно.
const ALLOWED_URI_REGEXP = /^(?:https?|mailto|tel):/i;

let hookInstalled = false;

function installHook() {
  if (hookInstalled) return;
  hookInstalled = true;

  // Любая ссылка из описания ведёт наружу. Открываем её в новой вкладке,
  // а rel закрывает открытой странице доступ к нашей через window.opener.
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A" && node.hasAttribute("href")) {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer nofollow");
    }
  });
}

export function sanitizeHtml(dirty: string): string {
  installHook();
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP,
  });
}

// Отдельный, более широкий список для HTML, который получаем конвертацией
// .docx (mammoth) во вьюере материалов — там реальный документ с таблицами,
// заголовками и картинками, а не набранный в простом редакторе текст.
// Отдельная функция, а не расширение ALLOWED_TAGS выше: не хотим тихо
// разрешить <table>/<img> и в описании хаба заодно — там это не проверялось.
const DOCUMENT_ALLOWED_TAGS = [
  ...ALLOWED_TAGS,
  "h1",
  "h4",
  "h5",
  "h6",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "img",
  "sup",
  "sub",
];

const DOCUMENT_ALLOWED_ATTR = [...ALLOWED_ATTR, "src", "alt", "colspan", "rowspan"];

// mammoth встраивает картинки .docx как data:image/... — обычный https-only
// список их бы вырезал. Разрешаем только image/* через data:, никакой другой
// data:-схемы (в частности, не data:text/html).
const DOCUMENT_ALLOWED_URI_REGEXP =
  /^(?:https?|mailto|tel):|^data:image\/(?:png|jpe?g|gif|webp);base64,/i;

/** Санитизация HTML, сконвертированного из .docx — см. docx-viewer.tsx. */
export function sanitizeDocumentHtml(dirty: string): string {
  installHook();
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: DOCUMENT_ALLOWED_TAGS,
    ALLOWED_ATTR: DOCUMENT_ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: DOCUMENT_ALLOWED_URI_REGEXP,
  });
}

/** Пустой ли текст описания. Редактор на пустом поле оставляет «<p></p>». */
export function isEmptyHtml(html: string | null | undefined): boolean {
  if (!html) return true;
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length === 0;
}
