import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { canAccessSection, canManagePersonalAsset, hasEdit } from "@/lib/permissions";
import { db } from "@/lib/db";
import { storage, storageKeys } from "@/lib/storage";
import { permissionKeyForSection } from "@/lib/asset-sections";

const MAX_THUMB_BYTES = 2 * 1024 * 1024;

// Превью материала для админки: GET отдаёт картинку, POST сохраняет присланную.
// Рисует её браузер — см. src/lib/make-thumbnail.ts.
//
// Витрина клиента берёт превью по другому адресу, где проверяется токен ссылки.

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new Response("Нужно войти", { status: 401 });

  const { id } = await params;
  const asset = await db.asset.findUnique({ where: { id } });

  if (
    !asset ||
    asset.organizationId !== user.organizationId ||
    !asset.thumbnailKey
  ) {
    return new Response("Превью не найдено", { status: 404 });
  }
  if (!canAccessSection(user, asset.quoteId ? "calculator" : "assets")) {
    return new Response("Превью не найдено", { status: 404 });
  }
  // Личный материал — превью тоже только владельцу (и ADMIN), см. тот же
  // принцип в api/assets/[id]/file/route.ts.
  if (asset.ownerId !== null && !canManagePersonalAsset(user, asset)) {
    return new Response("Превью не найдено", { status: 404 });
  }

  const stream = await storage.get(asset.thumbnailKey);
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      // Превью файлов — JPEG (тип не хранился), у ссылок — свой (og:image).
      "Content-Type": asset.thumbnailMime ?? "image/jpeg",
      "Content-Length": String(await storage.size(asset.thumbnailKey)),
      "Cache-Control": "private, max-age=60",
    },
  });
}

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

  if (!asset || asset.organizationId !== user.organizationId) {
    return NextResponse.json({ error: "Материал не найден." }, { status: 404 });
  }
  if (!canAccessSection(user, asset.quoteId ? "calculator" : "assets")) {
    return NextResponse.json({ error: "Материал не найден." }, { status: 404 });
  }
  const allowed =
    asset.ownerId !== null
      ? canManagePersonalAsset(user, asset)
      : hasEdit(user, permissionKeyForSection(asset.section));
  if (!allowed) {
    return NextResponse.json({ error: "Недостаточно прав." }, { status: 403 });
  }

  const form = await request.formData();
  const thumb = form.get("thumbnail");

  if (
    !(thumb instanceof File) ||
    thumb.size === 0 ||
    thumb.size > MAX_THUMB_BYTES ||
    thumb.type !== "image/jpeg"
  ) {
    return NextResponse.json({ error: "Нужна картинка JPEG." }, { status: 400 });
  }

  const key = storageKeys.thumbnail(user.organizationId, asset.id);
  await storage.put(key, Buffer.from(await thumb.arrayBuffer()), "image/jpeg");

  await db.asset.update({ where: { id: asset.id }, data: { thumbnailKey: key } });

  revalidatePath("/assets");
  revalidatePath("/assets/mine");
  return NextResponse.json({ ok: true });
}
