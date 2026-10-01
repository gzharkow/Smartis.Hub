import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canAccessSection, canAddMaterials } from "@/lib/permissions";
import { db } from "@/lib/db";
import { storage, storageKeys } from "@/lib/storage";
import { readPdfPageCount } from "@/lib/assets";
import {
  detectKind,
  fileExtension,
  isUploadSupported,
  MAX_UPLOAD_BYTES,
  SUPPORTED_FORMATS_TEXT,
} from "@/lib/asset-formats";
import { parseSection } from "@/lib/asset-sections";
import { isJpeg, verifyBuffer, type UploadKind } from "@/lib/file-signature";

export async function POST(request: Request) {
  // Маршрут дёргают напрямую, а не только из нашей формы — проверяем вход здесь,
  // на защиту в proxy полагаться нельзя.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Нужно войти." }, { status: 401 });
  }
  if (!canAccessSection(user, "assets")) {
    return NextResponse.json({ error: "Недостаточно прав." }, { status: 403 });
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

  // Проверяем и здесь, а не только в форме на клиенте: маршрут дёргают
  // напрямую, клиентскую проверку легко обойти. Всё, что вьювер не умеет
  // показать и превью для него не сделать, в библиотеку не кладём —
  // раньше такие файлы просто падали в FILE (только скачивание).
  if (!isUploadSupported(mimeType, file.name)) {
    return NextResponse.json(
      {
        error: `Формат файла «${file.name}» не поддерживается. Можно загрузить: ${SUPPORTED_FORMATS_TEXT}.`,
      },
      { status: 415 },
    );
  }

  const kind = detectKind(mimeType, file.name);
  const buffer = Buffer.from(await file.arrayBuffer());

  // Тип и расширение присылает браузер — подделать их одной правкой. Смотрим
  // на сами байты: что внутри на самом деле, и какой тип честно записать.
  const verdict = await verifyBuffer(buffer, kind as UploadKind, file.name, mimeType);
  if (!verdict.ok) {
    return NextResponse.json(
      { error: `Файл «${file.name}» не загружен. ${verdict.reason}` },
      { status: 415 },
    );
  }
  const storedMime = verdict.mime;

  // Имя файла берём как заголовок по умолчанию — продавец потом переименует.
  // Расширение убираем: «Прайс 2026», а не «Прайс 2026.pdf».
  const ext = fileExtension(file.name);
  const title = (ext ? file.name.slice(0, -ext.length) : file.name).trim() || "Без названия";

  const pageCount = kind === "PDF" ? await readPdfPageCount(buffer) : null;

  // target=mine — загрузка в личную библиотеку («Мои материалы»): доступна
  // любому, кто видит раздел «Материалы» вообще, независимо от canAddAssets
  // (то право касается только общей библиотеки — см. canManagePersonalAsset
  // в permissions.ts). Раздел (AssetSection) личные материалы не используют.
  const isPersonal = form.get("target") === "mine";

  // Раздел не пришёл или пришёл незнакомый — кладём в «Общие». Терять файл
  // из-за этого незачем: раздел потом меняется одним нажатием.
  const section = parseSection(form.get("section")) ?? "COMMON";
  if (!isPersonal && !canAddMaterials(user)) {
    return NextResponse.json({ error: "Недостаточно прав." }, { status: 403 });
  }

  // Ключ в хранилище содержит id материала, поэтому сначала запись, потом файл.
  const asset = await db.asset.create({
    data: {
      organizationId: user.organizationId,
      kind,
      section,
      title,
      mimeType: storedMime,
      sizeBytes: file.size,
      pageCount,
      ownerId: isPersonal ? user.id : null,
    },
  });

  const key = storageKeys.original(user.organizationId, asset.id, ext);

  try {
    await storage.put(key, buffer, storedMime);
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
      const thumbBytes = Buffer.from(await thumb.arrayBuffer());
      // Заявлен JPEG, а внутри нет — молча не берём, как и любую другую
      // неудачу с превью.
      if (isJpeg(thumbBytes)) {
        await storage.put(thumbKey, thumbBytes, "image/jpeg");
        thumbnailKey = thumbKey;
      }
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
    ownerId: saved.ownerId,
  });
}
