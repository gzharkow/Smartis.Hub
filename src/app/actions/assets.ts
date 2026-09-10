"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { canAccessSection, canAddMaterials, hasEdit } from "@/lib/permissions";
import { db } from "@/lib/db";
import { parseSection, permissionKeyForSection } from "@/lib/asset-sections";
import { checkLink, downloadLinkImage } from "@/lib/link-check";
import { storage, storageKeys } from "@/lib/storage";

// Расширение файла превью под тип картинки. Ключ хранилища — путь на диске,
// его имя косметическое; тип для отдачи берётся из БД (Asset.thumbnailMime).
const THUMB_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
};

/**
 * Скачать og:image сайта и сохранить как превью ссылки.
 *
 * Лучшее усилие: не вышло — ссылка просто останется без картинки, как файл,
 * для которого превью не сделалось. Ошибку сюда пробрасывать нельзя, иначе
 * из-за неудачной картинки сорвалось бы добавление самой ссылки.
 */
async function storeLinkThumbnail(
  orgId: string,
  assetId: string,
  imageUrl: string,
): Promise<boolean> {
  try {
    const { bytes, mime } = await downloadLinkImage(imageUrl);
    const key = storageKeys.thumbnail(orgId, assetId, THUMB_EXT[mime] ?? ".img");
    await storage.put(key, bytes, mime);
    await db.asset.update({
      where: { id: assetId },
      data: { thumbnailKey: key, thumbnailMime: mime },
    });
    return true;
  } catch (e) {
    // Видно только нам в логах сервера — клиента это не касается.
    console.warn(`Превью ссылки ${assetId} не сделалось:`, e);
    return false;
  }
}

async function ownedAsset(assetId: string) {
  const user = await requireUser();
  const asset = await db.asset.findUnique({ where: { id: assetId } });

  // Не «нет доступа», а «не найдено»: разные ответы позволили бы перебором
  // выяснять, что есть в чужих организациях.
  if (!asset || asset.organizationId !== user.organizationId) {
    throw new Error("Материал не найден.");
  }
  // Право «Изменение» проверяется по РАЗДЕЛУ, в котором материал лежит
  // сейчас — Материалы видны всем с доступом к разделу целиком, но менять
  // можно только там, где явно разрешено (см. hasEdit в permissions.ts).
  // Исключение — PDF из «Генератора КП» (quoteId не пуст): у них
  // asset.section всегда COMMON, но живут они не в «Материалах», а в
  // «Генератор КП → Файлы», и это именно тот ключ матрицы, который
  // должен решать, можно ли их удалять/восстанавливать.
  const permissionKey = asset.quoteId
    ? "calculator.files"
    : permissionKeyForSection(asset.section);
  if (!canAccessSection(user, asset.quoteId ? "calculator" : "assets")) {
    throw new Error("Материал не найден.");
  }
  if (!hasEdit(user, permissionKey)) {
    throw new Error("Недостаточно прав.");
  }
  return { user, asset };
}

/**
 * Удаление материала — мягкое, физически файл остаётся.
 *
 * Причин две, и обе важные:
 *   1. Статистика. По материалу уже могли ходить клиенты. Стереть его —
 *      значит обнулить историю по всем сделкам, где он участвовал.
 *   2. Обратимость. Удалить материал, который стоит в десяти хабах, — легко.
 *      Собрать эти хабы заново — долго. Пусть ошибка стоит одного нажатия.
 *
 * Связи с хабами (HubItem) НЕ трогаем: витрина сама скрывает материалы
 * с archivedAt, а при восстановлении он вернётся во все хабы, где стоял.
 */
export async function archiveAsset(assetId: string) {
  const { asset } = await ownedAsset(assetId);

  await db.asset.update({
    where: { id: asset.id },
    data: { archivedAt: new Date() },
  });

  revalidatePath("/assets");
  revalidatePath("/hubs");
}

export async function restoreAsset(assetId: string) {
  const { asset } = await ownedAsset(assetId);

  await db.asset.update({
    where: { id: asset.id },
    data: { archivedAt: null },
  });

  revalidatePath("/assets");
  revalidatePath("/hubs");
}

/** Хабы, где сейчас стоит материал — показать перед безвозвратным удалением. */
export async function getAssetHubUsage(assetId: string) {
  const { asset } = await ownedAsset(assetId);

  const items = await db.hubItem.findMany({
    where: { assetId: asset.id },
    include: { hub: { select: { id: true, title: true } } },
  });

  return items.map((item) => ({ hubId: item.hub.id, hubTitle: item.hub.title }));
}

/**
 * Безвозвратное удаление — только из «Удалённых» (см. archiveAsset). Материал
 * мог остаться прикреплённым к хабам (архивирование их не отвязывает) —
 * отвязываем заодно, интерфейс уже предупредил об этом списком хабов.
 */
export async function deleteAssetPermanently(assetId: string) {
  const { asset } = await ownedAsset(assetId);
  if (asset.archivedAt === null) {
    throw new Error("Сначала удалите материал — он должен быть в «Удалённых».");
  }

  await db.$transaction([
    db.hubItem.deleteMany({ where: { assetId: asset.id } }),
    db.asset.delete({ where: { id: asset.id } }),
  ]);

  if (asset.storageKey) await storage.delete(asset.storageKey).catch(() => {});
  if (asset.thumbnailKey) await storage.delete(asset.thumbnailKey).catch(() => {});

  revalidatePath("/assets");
  revalidatePath("/hubs");
}

export type AddLinkState =
  | { error: string }
  | { ok: true; title: string; embeddable: boolean }
  | undefined;

/**
 * Добавить ссылку как материал: кейс на сайте, статья, видео на внешнем
 * сервисе. Файла у такого материала нет — только адрес.
 *
 * Заодно выясняем, пускает ли сайт себя в рамку. Продавец узнаёт об этом
 * СРАЗУ, при добавлении, а не от клиента, который увидел белый прямоугольник.
 */
export async function addLinkAsset(
  _prev: AddLinkState,
  formData: FormData,
): Promise<AddLinkState> {
  const user = await requireUser();
  if (!canAccessSection(user, "assets")) {
    return { error: "Недостаточно прав." };
  }

  const url = String(formData.get("url") ?? "").trim();
  if (!url) return { error: "Введите адрес ссылки." };

  const section = parseSection(formData.get("section")) ?? "COMMON";
  if (!canAddMaterials(user)) {
    return { error: "Недостаточно прав." };
  }
  const typed = String(formData.get("title") ?? "").trim();

  let checked;
  try {
    checked = await checkLink(url);
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Не удалось проверить ссылку.",
    };
  }

  // Название берём от продавца, если он его ввёл: он лучше знает, как
  // материал должен называться у клиента. Иначе — заголовок страницы.
  const title = typed || checked.title || checked.url;

  const asset = await db.asset.create({
    data: {
      organizationId: user.organizationId,
      kind: "LINK",
      section,
      title: title.slice(0, 200),
      externalUrl: checked.url,
      embeddable: checked.embeddable,
    },
  });

  // Превью — картинка-превью самого сайта (og:image). Не вышло — не беда.
  if (checked.imageUrl) {
    await storeLinkThumbnail(user.organizationId, asset.id, checked.imageUrl);
  }

  revalidatePath("/assets");
  return { ok: true, title, embeddable: checked.embeddable === true };
}

/**
 * Досоздать превью для ссылки, добавленной раньше (или у которой оно
 * не сделалось). Заново заходим на сайт, берём свежий og:image.
 */
export async function backfillLinkThumbnail(assetId: string) {
  const { user, asset } = await ownedAsset(assetId);

  if (asset.kind !== "LINK" || !asset.externalUrl) {
    throw new Error("Это не ссылка.");
  }

  const checked = await checkLink(asset.externalUrl);
  if (!checked.imageUrl) {
    throw new Error("У этого сайта нет картинки-превью.");
  }

  const ok = await storeLinkThumbnail(
    user.organizationId,
    asset.id,
    checked.imageUrl,
  );
  if (!ok) throw new Error("Не удалось загрузить картинку сайта.");

  revalidatePath("/assets");
}

/**
 * Переложить материал в другой раздел библиотеки.
 *
 * На хабы это не влияет: где материал уже стоит — там и останется. Раздел
 * нужен только чтобы находить материал в библиотеке, а не чтобы решать,
 * кто его увидит.
 */
export async function setAssetSection(assetId: string, section: string) {
  const value = parseSection(section);
  if (!value) throw new Error("Неизвестный раздел.");

  const { user, asset } = await ownedAsset(assetId);

  // ownedAsset уже проверила права на ИСХОДНЫЙ раздел — здесь дополнительно
  // проверяем ЦЕЛЕВОЙ: иначе материал можно было бы переложить в раздел,
  // редактировать который не разрешено.
  if (!hasEdit(user, permissionKeyForSection(value))) {
    throw new Error("Недостаточно прав.");
  }

  await db.asset.update({
    where: { id: asset.id },
    data: { section: value },
  });

  revalidatePath("/assets");
}

/**
 * Переименовать материал. Название не уникально — это просто заголовок,
 * который видят клиенты, а не идентификатор.
 */
export async function renameAsset(assetId: string, title: string) {
  const value = title.trim();
  if (!value) throw new Error("Введите название материала.");

  const { asset } = await ownedAsset(assetId);

  await db.asset.update({
    where: { id: asset.id },
    data: { title: value.slice(0, 200) },
  });

  revalidatePath("/assets");
  revalidatePath("/hubs");
}
