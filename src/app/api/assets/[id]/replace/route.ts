import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canAccessSection, canManagePersonalAsset, hasEdit } from "@/lib/permissions";
import { db } from "@/lib/db";
import { permissionKeyForSection } from "@/lib/asset-sections";
import { readPdfPageCount } from "@/lib/assets";
import {
  detectKind,
  fileExtension,
  isUploadSupported,
  MAX_UPLOAD_BYTES,
  SUPPORTED_FORMATS_TEXT,
} from "@/lib/asset-formats";
import { storage, storageKeys } from "@/lib/storage";
import { revalidatePath } from "next/cache";

// Замена файла материала «на месте»: тот же Asset.id, тот же материал во всех
// хабах, где он уже стоит (HubItem ссылается только на assetId) — просто
// другое содержимое. Формат может смениться (см. asset-formats.ts) — тогда
// пересчитываем kind/pageCount и меняем расширение в ключе хранилища.
//
// Отдельный маршрут, не серверный экшен: как и у обычной загрузки
// (api/assets/upload/route.ts), нужен прогресс через XMLHttpRequest,
// которого server action не даёт.

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Нужно войти." }, { status: 401 });
  }

  const { id } = await params;
  const asset = await db.asset.findUnique({ where: { id } });

  // Не «нет доступа», а «не найдено» — тот же принцип, что и везде
  // в этом файле: чужой организации материала как будто не существует.
  if (!asset || asset.organizationId !== user.organizationId) {
    return NextResponse.json({ error: "Материал не найден." }, { status: 404 });
  }
  if (!canAccessSection(user, asset.quoteId ? "calculator" : "assets")) {
    return NextResponse.json({ error: "Материал не найден." }, { status: 404 });
  }
  // Личный материал («Мои материалы») — своя ось прав: владелец (и ADMIN)
  // может заменять файл независимо от canAddAssets. См. canManagePersonalAsset.
  const allowed =
    asset.ownerId !== null
      ? canManagePersonalAsset(user, asset)
      : hasEdit(user, permissionKeyForSection(asset.section));
  if (!allowed) {
    return NextResponse.json({ error: "Недостаточно прав." }, { status: 403 });
  }
  // Ссылки — не файл, менять нечего; снимки калькулятора живут в
  // «Генератор КП → Файлы», у этой операции своя область — библиотека.
  if (asset.kind === "LINK" || asset.quoteId !== null) {
    return NextResponse.json(
      { error: "Этот материал нельзя заменить файлом." },
      { status: 400 },
    );
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
  const ext = fileExtension(file.name);
  const pageCount = kind === "PDF" ? await readPdfPageCount(buffer) : null;

  // Расширение — часть ключа (см. storageKeys.original), поэтому смена
  // формата даёт НОВЫЙ ключ. Кладём новый файл первым: если запись не
  // удалась, ни БД, ни старый файл не тронуты.
  const newKey = storageKeys.original(user.organizationId, asset.id, ext);
  try {
    await storage.put(newKey, buffer, mimeType);
  } catch {
    return NextResponse.json({ error: "Не удалось сохранить файл." }, { status: 500 });
  }

  // Превью — решено пересобирать автоматически и всегда: браузер уже
  // прислал готовую JPEG-картинку вместе с файлом (как при обычной
  // загрузке). Путь превью не зависит от формата — он просто перезапишется.
  // Не получилось — не оставляем старую картинку от прошлого файла.
  const thumbKey = storageKeys.thumbnail(user.organizationId, asset.id);
  let newThumbnailKey: string | null = null;
  const thumb = form.get("thumbnail");
  if (
    thumb instanceof File &&
    thumb.size > 0 &&
    thumb.size <= 2 * 1024 * 1024 &&
    thumb.type === "image/jpeg"
  ) {
    try {
      await storage.put(thumbKey, Buffer.from(await thumb.arrayBuffer()), "image/jpeg");
      newThumbnailKey = thumbKey;
    } catch {
      // Не фатально — как и при обычной загрузке, материал просто
      // останется без превью (см. ниже — старое тоже будет удалено).
    }
  }

  let saved;
  try {
    saved = await db.asset.update({
      where: { id: asset.id },
      data: {
        kind,
        storageKey: newKey,
        mimeType,
        sizeBytes: file.size,
        pageCount,
        thumbnailKey: newThumbnailKey,
        thumbnailMime: newThumbnailKey ? "image/jpeg" : null,
        // Содержимое личного материала сменилось — прежнее подтверждение
        // «валидирован с руководством» относилось к старому файлу, его
        // нельзя переносить молча. Общей библиотеки это не касается —
        // ownerId у неё всегда null, validatedAt она не использует.
        ...(asset.ownerId !== null ? { validatedAt: null } : {}),
      },
    });
  } catch (e) {
    // БД не записалась — не оставляем в хранилище новый файл-сирота.
    await storage.delete(newKey).catch(() => {});
    if (newThumbnailKey) await storage.delete(newThumbnailKey).catch(() => {});
    throw e;
  }

  // Только теперь, когда запись надёжно указывает на новые файлы, чистим
  // старые — best-effort, как и в deleteAssetPermanently.
  if (asset.storageKey && asset.storageKey !== newKey) {
    await storage.delete(asset.storageKey).catch(() => {});
  }
  if (asset.thumbnailKey && asset.thumbnailKey !== newThumbnailKey) {
    await storage.delete(asset.thumbnailKey).catch(() => {});
  }

  revalidatePath("/assets");
  revalidatePath("/assets/mine");
  revalidatePath("/hubs");

  return NextResponse.json({
    id: saved.id,
    kind: saved.kind,
    sizeBytes: saved.sizeBytes,
    pageCount: saved.pageCount,
    hasThumbnail: saved.thumbnailKey !== null,
  });
}
