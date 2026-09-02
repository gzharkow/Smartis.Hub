import type { AssetKind } from "@/generated/prisma/enums";

// Чистые функции про форматы файлов — без "server-only". Нужны и на
// сервере (маршрут загрузки), и в браузере (превью до отправки в
// make-thumbnail.ts, проверка формата в asset-uploader.tsx до похода
// на сервер). Настоящий server-only остаток (readPdfPageCount, требует
// pdf-lib + Buffer) живёт в src/lib/assets.ts и импортирует отсюда же.

// Пока файлы едут через наш сервер и целиком помещаются в память,
// поэтому потолок скромный. Когда переедем на S3, загрузка пойдёт
// напрямую в хранилище мимо нас, и ограничение можно будет поднять.
export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// Легаси-форматы (.doc бинарный, .ppt/.pptx) сюда намеренно не попадают —
// mammoth умеет только OOXML .docx, а вменяемой клиентской библиотеки для
// презентаций нет. Такие файлы остаются FILE — только скачивание.
const SPREADSHEET_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls
  "text/csv",
]);

/** Расширение из имени файла, вместе с точкой. Пустая строка, если его нет. */
export function fileExtension(filename: string): string {
  const match = /\.[a-z0-9]{1,12}$/i.exec(filename.trim());
  return match ? match[0].toLowerCase() : "";
}

const SPREADSHEET_EXTS = new Set([".xlsx", ".xls", ".csv"]);

/**
 * Тип материала по MIME. Второй параметр — подстраховка: некоторые
 * браузеры/ОС для Office-форматов шлют пустой тип или
 * application/octet-stream вместо настоящего MIME — тогда смотрим на
 * расширение имени файла, а не молча кладём материал в FILE.
 */
export function detectKind(mimeType: string, filename?: string): AssetKind {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.startsWith("video/")) return "VIDEO";
  if (mimeType.startsWith("image/")) return "IMAGE";
  if (mimeType === DOCX_MIME) return "DOCUMENT";
  if (SPREADSHEET_MIME_TYPES.has(mimeType)) return "SPREADSHEET";

  if (filename && (mimeType === "" || mimeType === "application/octet-stream")) {
    const ext = fileExtension(filename);
    if (ext === ".docx") return "DOCUMENT";
    if (SPREADSHEET_EXTS.has(ext)) return "SPREADSHEET";
    if (ext === ".pdf") return "PDF";
  }

  return "FILE";
}

/**
 * Можно ли этот файл вообще положить в библиотеку. Единственный источник
 * правды — detectKind: всё, что не PDF/VIDEO/IMAGE/DOCUMENT/SPREADSHEET,
 * у нас нельзя ни посмотреть внутри сервиса, ни сделать превью — только
 * скачать, а такие материалы больше не принимаем (см. asset-uploader.tsx
 * и api/assets/upload/route.ts).
 */
export function isUploadSupported(mimeType: string, filename: string): boolean {
  return detectKind(mimeType, filename) !== "FILE";
}

/** Показываем рядом с формой загрузки и в тексте ошибки при отказе. */
export const SUPPORTED_FORMATS_TEXT =
  "PDF, изображения (JPG, PNG, GIF, WebP…), видео (MP4, WebM…), Word (.docx), Excel (.xlsx, .xls, .csv)";

/** Список для атрибута accept у <input type="file"> — сужает системный диалог выбора. */
export const UPLOAD_ACCEPT =
  "application/pdf,image/*,video/*," +
  `${DOCX_MIME},` +
  [...SPREADSHEET_MIME_TYPES].join(",") +
  ",.docx,.xlsx,.xls,.csv";

export const KIND_LABELS: Record<AssetKind, string> = {
  PDF: "PDF",
  VIDEO: "Видео",
  IMAGE: "Изображение",
  DOCUMENT: "Документ",
  SPREADSHEET: "Таблица",
  LINK: "Ссылка",
  FILE: "Файл",
};

/**
 * Цвет типа материала на витрине: подложка превью и значок на плитке.
 *
 * Это палитра различения, а не семантика темы, — как и цвета авторов в
 * owner-color.ts. Токены --accent/--danger сюда не годятся: их задача
 * в том, чтобы значить одно и то же везде, а здесь семь цветов нужны
 * ровно затем, чтобы отличаться друг от друга.
 *
 * Лежит рядом с KIND_LABELS: подпись и цвет типа — одна пара, и разъезжаться
 * им нельзя. Раньше палитра была захардкожена в showcase-body.tsx.
 */
export const KIND_TINTS: Record<AssetKind, string> = {
  PDF: "#dc2626",
  VIDEO: "#7c3aed",
  IMAGE: "#0891b2",
  DOCUMENT: "#2563eb",
  SPREADSHEET: "#16a34a",
  LINK: "#0d9488",
  FILE: "#64748b",
};

const SIZE_UNITS = ["Б", "КБ", "МБ", "ГБ"];

/**
 * Спецификация (DOCX-снимок расчёта, см. finalizeQuoteSpec в
 * actions/quote-spec.ts) — не материал и не КП: существует только для
 * повторного скачивания из «Генератор КП → Спецификации», в хабы её
 * никогда не добавляют. От PDF-расчёта (тоже quoteId, но kind: "PDF",
 * см. addQuotePdfToHub) отличаем по kind — тот в хабе законно виден.
 */
export function isSpecAsset(asset: { kind: AssetKind; quoteId: string | null }): boolean {
  return asset.kind === "DOCUMENT" && asset.quoteId !== null;
}

export function formatFileSize(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < SIZE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = value >= 100 || unit === 0 ? Math.round(value) : Number(value.toFixed(1));
  return `${rounded} ${SIZE_UNITS[unit]}`;
}
