"use client";

// Превью делаем В БРАУЗЕРЕ, до отправки файла, и шлём готовую картинку.
//
// Почему не на сервере: отрисовка PDF и видео требует нативных библиотек
// (canvas, ffmpeg) — их надо собирать под каждую платформу, они тяжёлые
// и ставятся с трудом. А в браузере всё это уже есть, и pdf.js мы всё равно
// возим для вьюера.
//
// Обратная сторона: превью зависит от браузера продавца. Если не получилось —
// не беда, плитка покажет цветную заглушку с типом файла.

/** Ширина превью. Плитка на витрине шире не бывает даже на больших экранах. */
const THUMB_WIDTH = 480;
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
 * Превью для файла. null — не получилось или тип не поддерживается;
 * загрузка в этом случае идёт как обычно, просто без картинки.
 */
export async function makeThumbnail(file: File): Promise<Blob | null> {
  try {
    if (file.type === "application/pdf") return await fromPdf(file);
    if (file.type.startsWith("video/")) return await fromVideo(file);
    if (file.type.startsWith("image/")) return await fromImage(file);
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
