import "server-only";

import type { CurrentUser } from "./auth";

// ADMIN видит и может менять всё безусловно. MEMBER — по двум независимым
// осям: canAccessSection (виден ли раздел целиком — настраивается при
// создании/правке аккаунта в администрировании, см. User.canAccessHubs и
// соседние поля) и hasEdit (внутри видимого раздела — можно ли менять).
// Внутри раздела «Материалы» и добавление, и переименование/удаление/
// перенос/замена файла даёт один и тот же флаг User.canAddAssets (имеет
// смысл только при canAccessAssets = true) — см. canAddMaterials, на
// которую hasEdit для "assets*" опирается напрямую, чтобы эти два права
// не могли разъехаться.
// «Настройки → Администрирование» сюда не входит — она доступна только
// role = ADMIN, жёстко, см. requireAdmin() в auth.ts. «Настройки» целиком
// галочки доступа не имеют — открыты любому вошедшему, независимо от
// canAccessSection.

export type SectionKey = "hubs" | "assets" | "stats" | "calculator";

const SECTION_FLAG: Record<SectionKey, keyof CurrentUser> = {
  hubs: "canAccessHubs",
  assets: "canAccessAssets",
  stats: "canAccessStats",
  calculator: "canAccessCalculator",
};

/** Виден ли раздел целиком. ADMIN — всегда true. MEMBER — по персональному
 * флагу (см. src/lib/auth.ts requireSection() для блокировки страниц). */
export function canAccessSection(user: CurrentUser, section: SectionKey): boolean {
  if (user.role === "ADMIN") return true;
  return user[SECTION_FLAG[section]] === true;
}

export function hasEdit(user: CurrentUser, sectionKey: string): boolean {
  if (sectionKey.startsWith("assets")) return canAddMaterials(user);
  return true;
}

/** Право на материалы библиотеки — и добавлять, и менять существующие
 * (переименование, удаление, перенос, замена файла). Одно право на оба
 * действия: см. комментарий в hasEdit выше. */
export function canAddMaterials(user: CurrentUser): boolean {
  return user.role === "ADMIN" || user.canAddAssets === true;
}

/** Личная библиотека материалов («Мои материалы») — отдельная от
 * canAddMaterials ось прав: владелец управляет своими материалами всегда,
 * независимо от canAddAssets (то право касается только общей библиотеки).
 * ADMIN — тоже, у него полный доступ везде, включая чужие личные библиотеки
 * (см. комментарий роли ADMIN в schema.prisma). */
export function canManagePersonalAsset(
  user: CurrentUser,
  asset: { ownerId: string | null },
): boolean {
  if (asset.ownerId === null) return false;
  return user.role === "ADMIN" || asset.ownerId === user.id;
}

/** ownerId-фильтр для списков хабов/расчётов/статистики: ADMIN видит всё,
 * MEMBER — своё и то, что явно открыл суперадмин через visibleOwners. */
export function visibleOwnerFilter(user: CurrentUser): { ownerId?: { in: string[] } } {
  if (user.role === "ADMIN") return {};
  return { ownerId: { in: [user.id, ...user.visibleOwners.map((o) => o.id)] } };
}

/** Показывать ли бейдж автора в списке — есть смысл, только если в списке
 * действительно могут быть чужие хабы/расчёты. */
export function showsOtherOwners(user: CurrentUser): boolean {
  return user.role === "ADMIN" || user.visibleOwners.length > 0;
}
