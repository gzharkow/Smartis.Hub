import { Readable } from "node:stream";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";

// Отдаёт исходный файл СВОЕМУ сотруднику. Нужен, чтобы досоздать превью
// материалам, загруженным до появления этой возможности: браузер скачивает
// файл, рисует первую страницу и присылает картинку обратно.
//
// С ?download=1 тот же файл отдаётся вложением с человеческим именем — так
// скачиваются выпущенные Спецификации из Генератора КП.
//
// Витрина клиента файлы берёт по другому адресу — там проверяется токен ссылки.
// Здесь проверяется вход в админку.

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new Response("Нужно войти", { status: 401 });

  const { id } = await params;
  const asset = await db.asset.findUnique({ where: { id } });

  // Чужой организации материала «не существует».
  if (!asset || asset.organizationId !== user.organizationId || !asset.storageKey) {
    return new Response("Материал не найден", { status: 404 });
  }

  const size = await storage.size(asset.storageKey);
  const stream = await storage.get(asset.storageKey);

  const headers: Record<string, string> = {
    "Content-Type": asset.mimeType ?? "application/octet-stream",
    "Content-Length": String(size),
    "Cache-Control": "private, no-store",
  };

  if (new URL(request.url).searchParams.has("download")) {
    // Расширение берём из ключа хранилища: там оно проставлено при загрузке,
    // а в title его нет.
    const ext = asset.storageKey.slice(asset.storageKey.lastIndexOf("."));
    const utf8Name = encodeURIComponent(`${asset.title}${ext}`);
    headers["Content-Disposition"] =
      `attachment; filename="${asset.id}${ext}"; filename*=UTF-8''${utf8Name}`;
  }

  return new Response(Readable.toWeb(stream) as ReadableStream, { headers });
}
