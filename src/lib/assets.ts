import "server-only";

import { PDFDocument } from "pdf-lib";
import type { AssetKind } from "@/generated/prisma/enums";

// Пока файлы едут через наш сервер и целиком помещаются в память,
// поэтому потолок скромный. Когда переедем на S3, загрузка пойдёт
// напрямую в хранилище мимо нас, и ограничение можно будет поднять.
export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

// Легаси-форматы (.doc бинарный, .ppt/.pptx) сюда намеренно не попадают —
// mammoth умеет только OOXML .docx, а вменяемой клиентской библиотеки для
// презентаций нет. Такие файлы остаются FILE — только скачивание, как раньше.
const SPREADSHEET_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls
  "text/csv",
]);

export function detectKind(mimeType: string): AssetKind {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.startsWith("video/")) return "VIDEO";
  if (mimeType.startsWith("image/")) return "IMAGE";
  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    return "DOCUMENT";
  if (SPREADSHEET_MIME_TYPES.has(mimeType)) return "SPREADSHEET";
  return "FILE";
}

/** Число страниц PDF. Нужно и для витрины, и для постраничного трекинга. */
export async function readPdfPageCount(data: Buffer): Promise<number | null> {
  try {
    const doc = await PDFDocument.load(data, {
      // Файл только считаем, не редактируем — на битых и защищённых
      // документах не спотыкаемся.
      ignoreEncryption: true,
      updateMetadata: false,
    });
    return doc.getPageCount();
  } catch {
    // Не разобрали — не беда: покажем материал без числа страниц.
    return null;
  }
}

const SIZE_UNITS = ["Б", "КБ", "МБ", "ГБ"];

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

export const KIND_LABELS: Record<AssetKind, string> = {
  PDF: "PDF",
  VIDEO: "Видео",
  IMAGE: "Изображение",
  DOCUMENT: "Документ",
  SPREADSHEET: "Таблица",
  LINK: "Ссылка",
  FILE: "Файл",
};

/** Расширение из имени файла, вместе с точкой. Пустая строка, если его нет. */
export function fileExtension(filename: string): string {
  const match = /\.[a-z0-9]{1,12}$/i.exec(filename.trim());
  return match ? match[0].toLowerCase() : "";
}
