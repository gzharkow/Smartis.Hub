import "server-only";

import { PDFDocument } from "pdf-lib";

// Чистые функции про форматы (detectKind, fileExtension, KIND_LABELS...)
// переехали в asset-formats.ts — этот файл больше не единственная точка
// входа, они нужны и в браузере (make-thumbnail.ts, asset-uploader.tsx).
// Реэкспорт здесь — чтобы существующие серверные импорты не трогать.
export * from "./asset-formats";

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
