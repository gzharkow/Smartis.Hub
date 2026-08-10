import "server-only";

import { redirect } from "next/navigation";
import { requireUser, type CurrentUser } from "./auth";

// Права доступа теперь ролевые, без матрицы по разделам (см. схему —
// AccessLevel убран). MEMBER видит и может менять всё наравне с ADMIN, кроме
// библиотеки материалов: там переименование/удаление/перенос раздела —
// только ADMIN, а добавление — по отдельному флагу User.canAddAssets
// (см. canAddMaterials). «Настройки → Администрирование» сюда не входит —
// она доступна только role = ADMIN, жёстко, см. requireAdmin() в auth.ts.

export function hasView(_user: CurrentUser, _sectionKey: string): boolean {
  return true;
}

export function hasEdit(user: CurrentUser, sectionKey: string): boolean {
  if (sectionKey.startsWith("assets")) return user.role === "ADMIN";
  return true;
}

/** Право добавлять материалы в библиотеку — отдельное от hasEdit (см. выше). */
export function canAddMaterials(user: CurrentUser): boolean {
  return user.role === "ADMIN" || user.canAddAssets === true;
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

/** Для страниц раздела/подраздела — блокирует и прямой переход по URL, не только пункт меню. */
export async function requireSectionView(sectionKey: string): Promise<CurrentUser> {
  const user = await requireUser();
  if (!hasView(user, sectionKey)) redirect("/hubs");
  return user;
}

/** Для мутирующих server actions — защита на случай, если кнопку в UI всё же обошли. */
export async function requireSectionEdit(sectionKey: string): Promise<CurrentUser> {
  const user = await requireUser();
  if (!hasEdit(user, sectionKey)) redirect("/hubs");
  return user;
}
