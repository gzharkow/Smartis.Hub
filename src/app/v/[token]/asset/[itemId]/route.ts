import { Readable } from "node:stream";
import { storage } from "@/lib/storage";
import { resolveShowcase } from "@/lib/showcase";

// Единственная дверь к файлам для клиента. Прямых ссылок на хранилище нет:
// каждый байт уходит только после проверки токена. Поэтому отзыв ссылки
// действует мгновенно и на уже открытые материалы тоже.

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string; itemId: string }> },
) {
  const { token, itemId } = await params;

  const access = await resolveShowcase(token);
  if (!access.ok) {
    return new Response("Ссылка недоступна", { status: 404 });
  }

  // Материал ищем ВНУТРИ этого хаба. Иначе по чужому itemId можно было бы
  // вытащить файл, которого в хабе нет.
  const item = access.data.hub.items.find((i) => i.id === itemId);
  if (!item) {
    return new Response("Материал не найден", { status: 404 });
  }

  // Превью просят тем же адресом с ?thumb=1 — чтобы проверка доступа
  // осталась в одном месте, а не расползлась по двум маршрутам.
  const wantsThumb = new URL(request.url).searchParams.get("thumb") === "1";

  // Проверку storageKey делаем ПОСЛЕ разбора thumb: у ссылок (kind = LINK)
  // самого файла нет вовсе, но превью-картинка есть — и её надо отдать.
  if (wantsThumb) {
    if (!item.asset.thumbnailKey) {
      return new Response("Превью нет", { status: 404 });
    }
  } else if (!item.asset.storageKey) {
    return new Response("Материал не найден", { status: 404 });
  }

  const storageKey = wantsThumb
    ? item.asset.thumbnailKey!
    : item.asset.storageKey!;
  const mimeType = wantsThumb
    ? (item.asset.thumbnailMime ?? "image/jpeg")
    : item.asset.mimeType;

  // Если хранилище умеет выдавать временные ссылки (S3) — отправляем клиента
  // туда, не гоняя файл через себя. Локальный диск не умеет, отдаём потоком.
  const direct = await storage.signedUrl(storageKey, 300);
  if (direct) return Response.redirect(direct, 302);

  const size = await storage.size(storageKey);
  const range = request.headers.get("range");

  const headers: Record<string, string> = {
    "Content-Type": mimeType ?? "application/octet-stream",
    // Скачать не предлагаем — материал смотрят внутри витрины.
    "Content-Disposition": "inline",
    // Кэшировать нельзя: доступ проверяется на каждый запрос, а закэшированный
    // ответ пережил бы отзыв ссылки.
    "Cache-Control": "private, no-store",
    "Accept-Ranges": "bytes",
  };

  // Без поддержки диапазонов видео нельзя перемотать: браузер просит кусок
  // с середины, а мы бы каждый раз слали файл сначала.
  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    const start = match?.[1] ? Number(match[1]) : 0;
    const end = match?.[2] ? Number(match[2]) : size - 1;

    if (start >= size || end >= size || start > end) {
      return new Response("Запрошенный диапазон вне файла", {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    }

    const stream = await storage.get(storageKey, { start, end });
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      status: 206,
      headers: {
        ...headers,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": String(end - start + 1),
      },
    });
  }

  const stream = await storage.get(storageKey);
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    status: 200,
    headers: { ...headers, "Content-Length": String(size) },
  });
}
