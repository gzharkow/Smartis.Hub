// Определяет, чем файл является на самом деле, по его первым байтам.
// Тип от браузера (file.type) и расширение имени подделываются одной правкой,
// поэтому доверять им при загрузке нельзя.
//
// Без "server-only" и без alias-импортов: файл проверяют обычные tsx-скрипты.

import JSZip from "jszip";

export type FileFormat =
  | "pdf"
  | "jpeg"
  | "png"
  | "gif"
  | "webp"
  | "avif"
  | "heic"
  | "bmp"
  | "ico"
  | "tiff"
  | "mp4"
  | "mov"
  | "webm"
  | "ogg"
  | "avi"
  | "mpeg"
  | "mpegts"
  | "flv"
  | "asf"
  | "zip"
  | "docx"
  | "xlsx"
  | "ole"
  | "text"
  | "svg"
  | "html"
  | "markup"
  | "unknown";

/** Как материал называется в базе (AssetKind) — только то, что можно загрузить. */
export type UploadKind = "PDF" | "IMAGE" | "VIDEO" | "DOCUMENT" | "SPREADSHEET";

export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Сколько байт с начала файла достаточно для определения (всё, кроме zip). */
export const SNIFF_HEAD_BYTES = 16 * 1024;

// zip-файл (docx/xlsx) читаем целиком, но не больше этого: у офисных документов
// размер обычно единицы мегабайт, а гигантский архив проверять незачем.
const MAX_ZIP_INSPECT_BYTES = 200 * 1024 * 1024;

function startsWith(data: Uint8Array, bytes: number[], offset = 0): boolean {
  if (data.length < offset + bytes.length) return false;
  return bytes.every((b, i) => data[offset + i] === b);
}

function ascii(data: Uint8Array, start: number, end: number): string {
  let s = "";
  for (let i = start; i < Math.min(end, data.length); i++) {
    s += String.fromCharCode(data[i]!);
  }
  return s;
}

function sniffBmff(head: Uint8Array): FileFormat | null {
  // ISO base media: размер (4 байта), затем тип атома.
  const atom = ascii(head, 4, 8);
  if (atom === "ftyp") {
    const brand = ascii(head, 8, 12);
    if (brand === "avif" || brand === "avis") return "avif";
    if (["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"].includes(brand)) {
      return "heic";
    }
    if (brand === "qt  ") return "mov";
    return "mp4";
  }
  // Старые QuickTime-файлы начинаются сразу с атомов данных, без ftyp.
  if (["moov", "mdat", "wide", "free", "skip", "pnot"].includes(atom)) return "mov";
  return null;
}

function looksLikeUtf8Text(head: Uint8Array): boolean {
  if (head.includes(0)) {
    // NUL допустим только в UTF-16 (выгрузка Excel «Юникод-текст»).
    return startsWith(head, [0xff, 0xfe]) || startsWith(head, [0xfe, 0xff]);
  }
  try {
    // stream: true — оборванный на границе среза символ не считается ошибкой.
    new TextDecoder("utf-8", { fatal: true }).decode(head, { stream: true });
    return true;
  } catch {
    return false;
  }
}

function sniffMarkup(head: Uint8Array): FileFormat | null {
  let start = 0;
  if (startsWith(head, [0xef, 0xbb, 0xbf])) start = 3;
  const text = ascii(head, start, start + 2048).toLowerCase();
  const trimmed = text.replace(/^[\s\0]+/, "");
  if (!trimmed.startsWith("<")) return null;

  if (trimmed.includes("<svg")) return "svg";
  if (
    trimmed.startsWith("<!doctype html") ||
    /^<(html|head|body|script|iframe|meta|title|style|a |div|p[ >])/.test(trimmed)
  ) {
    return "html";
  }
  return "markup";
}

/**
 * Формат по первым байтам. zip возвращается как "zip": docx это или xlsx,
 * решает refineZip(), ему нужен файл целиком (оглавление zip лежит в конце).
 */
export function sniffFormat(head: Uint8Array): FileFormat {
  // PDF допускает мусор перед сигнатурой — смотрим в первом килобайте.
  if (ascii(head, 0, 1024).includes("%PDF-")) return "pdf";

  if (startsWith(head, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (ascii(head, 0, 6) === "GIF87a" || ascii(head, 0, 6) === "GIF89a") return "gif";
  if (ascii(head, 0, 4) === "RIFF") {
    const kind = ascii(head, 8, 12);
    if (kind === "WEBP") return "webp";
    if (kind === "AVI ") return "avi";
  }
  if (startsWith(head, [0x42, 0x4d]) && head.length >= 26) return "bmp";
  if (startsWith(head, [0x00, 0x00, 0x01, 0x00])) return "ico";
  if (startsWith(head, [0x49, 0x49, 0x2a, 0x00]) || startsWith(head, [0x4d, 0x4d, 0x00, 0x2a])) {
    return "tiff";
  }

  const bmff = sniffBmff(head);
  if (bmff) return bmff;

  if (startsWith(head, [0x1a, 0x45, 0xdf, 0xa3])) return "webm";
  if (ascii(head, 0, 4) === "OggS") return "ogg";
  if (startsWith(head, [0x00, 0x00, 0x01, 0xba]) || startsWith(head, [0x00, 0x00, 0x01, 0xb3])) {
    return "mpeg";
  }
  if (head[0] === 0x47 && head.length > 188 && head[188] === 0x47) return "mpegts";
  if (ascii(head, 0, 3) === "FLV") return "flv";
  if (startsWith(head, [0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11])) return "asf";

  if (startsWith(head, [0x50, 0x4b, 0x03, 0x04]) || startsWith(head, [0x50, 0x4b, 0x05, 0x06])) {
    return "zip";
  }
  if (startsWith(head, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "ole";

  const markup = sniffMarkup(head);
  if (markup) return markup;

  if (looksLikeUtf8Text(head.subarray(0, 8192))) return "text";
  return "unknown";
}

/** Уточняет zip: docx, xlsx или просто архив. Читает только оглавление. */
export async function refineZip(data: Uint8Array): Promise<FileFormat> {
  if (data.length > MAX_ZIP_INSPECT_BYTES) return "zip";
  try {
    const zip = await JSZip.loadAsync(data);
    if (zip.file("word/document.xml")) return "docx";
    if (zip.file("xl/workbook.xml")) return "xlsx";
  } catch {
    // Битый архив — просто архив.
  }
  return "zip";
}

const KIND_FORMATS: Record<UploadKind, FileFormat[]> = {
  PDF: ["pdf"],
  IMAGE: ["jpeg", "png", "gif", "webp", "avif", "heic", "bmp", "ico", "tiff"],
  VIDEO: ["mp4", "mov", "webm", "ogg", "avi", "mpeg", "mpegts", "flv", "asf"],
  DOCUMENT: ["docx"],
  SPREADSHEET: ["xlsx", "ole", "text"],
};

const KIND_LABELS: Record<UploadKind, string> = {
  PDF: "PDF",
  IMAGE: "изображение",
  VIDEO: "видео",
  DOCUMENT: "документ Word (.docx)",
  SPREADSHEET: "таблица Excel (.xlsx, .xls, .csv)",
};

export type SignatureVerdict =
  | { ok: true; format: FileFormat; mime: string }
  | { ok: false; format: FileFormat; reason: string };

function extensionOf(name: string): string {
  const m = /\.([a-z0-9]{1,12})$/i.exec(name.trim());
  return m ? `.${m[1]!.toLowerCase()}` : "";
}

const FORMAT_MIME: Partial<Record<FileFormat, string>> = {
  pdf: "application/pdf",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  heic: "image/heic",
  bmp: "image/bmp",
  ico: "image/x-icon",
  tiff: "image/tiff",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  ogg: "video/ogg",
  avi: "video/x-msvideo",
  mpeg: "video/mpeg",
  mpegts: "video/mp2t",
  flv: "video/x-flv",
  asf: "video/x-ms-asf",
  docx: DOCX_MIME,
  xlsx: XLSX_MIME,
};

function describeFormat(format: FileFormat): string {
  switch (format) {
    case "svg":
      return "SVG не поддерживается — загрузите PNG или JPG";
    case "html":
    case "markup":
      return "это веб-страница или XML, а не материал";
    case "zip":
      return "это архив, а не документ Office";
    case "text":
      return "это текстовый файл";
    case "unknown":
      return "формат файла не распознан";
    default:
      return `по содержимому это ${format.toUpperCase()}`;
  }
}

/**
 * Совпадает ли содержимое с заявленным типом материала. Возвращает формат и
 * «честный» MIME, который стоит записать вместо присланного браузером.
 */
export function judge(
  format: FileFormat,
  kind: UploadKind,
  fileName: string,
  declaredMime: string,
): SignatureVerdict {
  const ext = extensionOf(fileName);
  const mime = declaredMime.toLowerCase().split(";")[0]!.trim();
  const mismatch = (): SignatureVerdict => ({
    ok: false,
    format,
    reason: `Содержимое файла не похоже на ${KIND_LABELS[kind]}: ${describeFormat(format)}.`,
  });

  if (!KIND_FORMATS[kind].includes(format)) return mismatch();

  if (kind === "SPREADSHEET") {
    if (format === "xlsx") return { ok: true, format, mime: XLSX_MIME };
    // .xls (OLE) принимаем только если файл и называет себя таблицей:
    // тот же контейнер у .doc и .ppt.
    if (format === "ole") {
      if (ext === ".xls" || mime === "application/vnd.ms-excel") {
        return { ok: true, format, mime: "application/vnd.ms-excel" };
      }
      return mismatch();
    }
    // У csv нет сигнатуры — смотрим, что файл сам себя так называет.
    if (format === "text") {
      if (ext === ".csv" || mime === "text/csv") {
        return { ok: true, format, mime: "text/csv" };
      }
      return mismatch();
    }
  }

  if (kind === "VIDEO") {
    // Тип видео оставляем заявленный, если он видео: по сигнатуре mp4 и mov,
    // например, не всегда различить, а проигрывателю важен именно он.
    const keep = mime.startsWith("video/") ? mime : (FORMAT_MIME[format] ?? "video/mp4");
    return { ok: true, format, mime: keep };
  }

  return { ok: true, format, mime: FORMAT_MIME[format] ?? mime };
}

/** Целиком: из буфера файла — в вердикт. Для маршрутов загрузки. */
export async function verifyBuffer(
  data: Uint8Array,
  kind: UploadKind,
  fileName: string,
  declaredMime: string,
): Promise<SignatureVerdict> {
  let format = sniffFormat(data.subarray(0, SNIFF_HEAD_BYTES));
  if (format === "zip") format = await refineZip(data);
  return judge(format, kind, fileName, declaredMime);
}

/** Превью файлов — всегда JPEG: рисует браузер. */
export function isJpeg(data: Uint8Array): boolean {
  return startsWith(data, [0xff, 0xd8, 0xff]);
}
