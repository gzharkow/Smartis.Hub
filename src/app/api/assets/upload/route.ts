import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { storage, storageKeys } from "@/lib/storage";
import {
  detectKind,
  fileExtension,
  MAX_UPLOAD_BYTES,
  readPdfPageCount,
} from "@/lib/assets";
import { parseSection } from "@/lib/asset-sections";

export async function POST(request: Request) {
  // Маршрут дёргают напрямую, а не только из нашей формы — проверяем вход здесь,
  // на защиту в proxy полагаться нельзя.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Нужно войти." }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Файл не получен." }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `Файл больше ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} МБ.` },
      { status: 413 },
    );
  }

  const mimeType = file.type || "application/octet-stream";
  const kind = detectKind(mimeType);
  const buffer = Buffer.from(await file.arrayBuffer());

  // Имя файла берём как заголовок по умолчанию — продавец потом переименует.
  // Расширение убираем: «Прайс 2026», а не «Прайс 2026.pdf».
  const ext = fileExtension(file.name);
  const title = (ext ? file.name.slice(0, -ext.length) : file.name).trim() || "Без названия";

  const pageCount = kind === "PDF" ? await readPdfPageCount(buffer) : null;

  // Раздел не пришёл или пришёл незнакомый — кладём в «Общие». Терять файл
  // из-за этого незачем: раздел потом меняется одним нажатием.
  const section = parseSection(form.get("section")) ?? "COMMON";

  // Ключ в хранилище содержит id материала, поэтому сначала запись, потом файл.
  const asset = await db.asset.create({
    data: {
      organizationId: user.organizationId,
      kind,
      section,
      title,
      mimeType,
      sizeBytes: file.size,
      pageCount,
    },
  });

  const key = storageKeys.original(user.organizationId, asset.id, ext);

  try {
    await storage.put(key, buffer, mimeType);
  } catch (e) {
    // Файл не лёг — убираем запись, чтобы в библиотеке не появился
    // материал, который невозможно открыть.
    await db.asset.delete({ where: { id: asset.id } });
    throw e;
  }

  // Превью рисует браузер и присылает вместе с файлом — см. src/lib/make-thumbnail.ts.
  // Его может не быть: старый браузер, битый файл, неподдержанный кодек.
  // Это не ошибка, плитка просто останется с цветной заглушкой.
  let thumbnailKey: string | null = null;
  const thumb = form.get("thumbnail");

  if (
    thumb instanceof File &&
    thumb.size > 0 &&
    thumb.size <= 2 * 1024 * 1024 &&
    thumb.type === "image/jpeg"
  ) {
    const thumbKey = storageKeys.thumbnail(user.organizationId, asset.id);
    try {
      await storage.put(
        thumbKey,
        Buffer.from(await thumb.arrayBuffer()),
        "image/jpeg",
      );
      thumbnailKey = thumbKey;
    } catch {
      // Сам файл уже лёг — терять материал из-за картинки не станем.
    }
  }

  const saved = await db.asset.update({
    where: { id: asset.id },
    data: { storageKey: key, thumbnailKey },
  });

  return NextResponse.json({
    id: saved.id,
    title: saved.title,
    kind: saved.kind,
    sizeBytes: saved.sizeBytes,
    pageCount: saved.pageCount,
  });
}
