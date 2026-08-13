"use client";

import { detectKind } from "./asset-formats";
import { sanitizeDocumentHtml } from "./sanitize";

// Превью делаем В БРАУЗЕРЕ, до отправки файла, и шлём готовую картинку.
//
// Почему не на сервере: отрисовка PDF и видео требует нативных библиотек
// (canvas, ffmpeg) — их надо собирать под каждую платформу, они тяжёлые
// и ставятся с трудом. А в браузере всё это уже есть, и pdf.js мы всё равно
// возим для вьюера. По той же причине docx/xlsx рендерим тем же mammoth/
// exceljs, что и во вьювере (docx-viewer.tsx/xlsx-viewer.tsx), а картинку
// с них снимаем через html2canvas.
//
// Обратная сторона: превью зависит от браузера продавца. Если не получилось —
// не беда, плитка покажет цветную заглушку с типом файла.

/** Ширина превью. Плитка на витрине шире не бывает даже на больших экранах. */
const THUMB_WIDTH = 480;
// Пропорция «страницы» для документов и таблиц — не весь документ,
// а первый экран, ровно как у PDF (первая страница, а не всё целиком).
const THUMB_HEIGHT = Math.round(THUMB_WIDTH * 1.3);
const JPEG_QUALITY = 0.82;

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
}

/** Первая страница PDF. */
async function fromPdf(file: File): Promise<Blob | null> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.mjs",
    import.meta.url,
  ).toString();

  const data = new Uint8Array(await file.arrayBuffer());
  // Держим саму задачу загрузки: освобождать поток надо через неё.
  // У документа метода destroy() НЕТ — только у задачи (pdfjs-dist 6).
  const task = pdfjs.getDocument({ data });
  const doc = await task.promise;

  try {
    const page = await doc.getPage(1);
    const unscaled = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: THUMB_WIDTH / unscaled.width });

    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    await page.render({ canvas, viewport }).promise;
    return canvasToBlob(canvas);
  } finally {
    // Освобождаем рабочий поток: без этого при загрузке пачки файлов
    // их накопится по одному на каждый PDF.
    void task.destroy();
  }
}

/** Кадр из видео — берём с начала, но не самый первый: он часто чёрный. */
function fromVideo(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => URL.revokeObjectURL(url);

    video.onloadeddata = () => {
      // Секунда от начала, но не дальше середины короткого ролика.
      video.currentTime = Math.min(1, (video.duration || 2) / 2);
    };

    video.onseeked = async () => {
      const scale = THUMB_WIDTH / video.videoWidth;
      const canvas = document.createElement("canvas");
      canvas.width = THUMB_WIDTH;
      canvas.height = Math.floor(video.videoHeight * scale);

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        cleanup();
        resolve(null);
        return;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      cleanup();
      resolve(await canvasToBlob(canvas));
    };

    video.onerror = () => {
      cleanup();
      resolve(null);
    };

    video.src = url;
  });
}

/** Уменьшенная копия изображения. */
async function fromImage(file: File): Promise<Blob | null> {
  // createImageBitmap умеет уменьшать сам и не грузит полноразмерную
  // картинку в память — важно для фотографий на 20 мегапикселей.
  const bitmap = await createImageBitmap(file, {
    resizeWidth: THUMB_WIDTH,
    resizeQuality: "high",
  }).catch(() => null);

  if (!bitmap) return null;

  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  return canvasToBlob(canvas);
}

/**
 * Снимок DOM-узла в JPEG через html2canvas. Узел рисуем за пределами
 * экрана (left: -9999px), с фиксированными шириной/высотой и
 * overflow: hidden — так снимается ровно «первый экран», как первая
 * страница у PDF, а не документ/таблица целиком.
 */
async function snapshotOffscreen(build: (container: HTMLElement) => void): Promise<Blob | null> {
  const html2canvas = (await import("html2canvas")).default;

  const container = document.createElement("div");
  container.style.cssText = `position:fixed; left:-9999px; top:0; width:${THUMB_WIDTH}px; height:${THUMB_HEIGHT}px; overflow:hidden; box-sizing:border-box; background:#fff;`;
  build(container);
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      width: THUMB_WIDTH,
      height: THUMB_HEIGHT,
      backgroundColor: "#ffffff",
    });
    return canvasToBlob(canvas);
  } finally {
    container.remove();
  }
}

/** Первый экран .docx — тот же mammoth и та же санитизация, что и во вьювере. */
async function fromDocx(file: File): Promise<Blob | null> {
  const mammoth = await import("mammoth/mammoth.browser");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const html = sanitizeDocumentHtml(result.value);

  return snapshotOffscreen((container) => {
    container.style.padding = "20px";
    container.style.fontFamily = "sans-serif";
    container.style.fontSize = "13px";
    container.style.lineHeight = "1.5";
    container.style.color = "#18181b";
    container.innerHTML = html;
  });
}

/** Первые строки/столбцы первого листа .xlsx/.xls — своя лёгкая табличка, не весь XlsxViewer. */
async function fromXlsx(file: File): Promise<Blob | null> {
  const mod = await import("exceljs");
  const ExcelJS = (mod as unknown as { default?: typeof mod }).default ?? mod;

  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) return null;

  const MAX_ROWS = 12;
  const MAX_COLS = 6;

  const table = document.createElement("table");
  table.style.cssText = "border-collapse:collapse; width:100%; table-layout:fixed;";

  let rowIndex = 0;
  sheet.eachRow({ includeEmpty: false }, (row) => {
    if (rowIndex >= MAX_ROWS) return;
    const tr = document.createElement("tr");
    let colIndex = 0;
    row.eachCell({ includeEmpty: true }, (cell) => {
      if (colIndex >= MAX_COLS) return;
      const td = document.createElement("td");
      td.textContent = cell.text ?? "";
      td.style.cssText =
        "border:1px solid #d4d4d8; padding:4px 6px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" +
        (rowIndex === 0 ? "background:#f4f4f5; font-weight:600;" : "");
      tr.appendChild(td);
      colIndex += 1;
    });
    table.appendChild(tr);
    rowIndex += 1;
  });

  if (rowIndex === 0) return null;

  return snapshotOffscreen((container) => {
    container.style.padding = "12px";
    container.style.fontFamily = "sans-serif";
    container.style.fontSize = "12px";
    container.style.color = "#18181b";
    container.appendChild(table);
  });
}

/**
 * Превью для файла. null — не получилось или тип не поддерживается;
 * загрузка в этом случае идёт как обычно, просто без картинки.
 */
export async function makeThumbnail(file: File): Promise<Blob | null> {
  try {
    if (file.type === "application/pdf") return await fromPdf(file);
    if (file.type.startsWith("video/")) return await fromVideo(file);
    if (file.type.startsWith("image/")) return await fromImage(file);

    const kind = detectKind(file.type, file.name);
    if (kind === "DOCUMENT") return await fromDocx(file);
    if (kind === "SPREADSHEET") return await fromXlsx(file);

    return null;
  } catch (e) {
    // Битый файл, защищённый PDF, кодек без поддержки — не повод
    // ломать загрузку. Просто останемся без картинки.
    //
    // Но в консоль пишем: молчаливый сбой невозможно отладить, а увидеть
    // это сообщение может только продавец в админке, не клиент.
    console.warn("Не удалось сделать превью для", file.name, e);
    return null;
  }
}
