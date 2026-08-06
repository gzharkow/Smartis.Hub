import "server-only";

import { redirect } from "next/navigation";
import { requireUser, type CurrentUser } from "./auth";
import { canEdit, canView, parsePermissions } from "./access-levels";

// Проверка «виден ли раздел»/«можно ли в нём менять» по матрице AccessLevel.
// ADMIN всегда полный доступ — матрица для него не читается вовсе.
// У MEMBER без accessLevel (см. комментарий в schema.prisma) доступа нет
// нигде — это сознательно закрытое состояние, а не «доступно по умолчанию».

export function hasView(user: CurrentUser, sectionKey: string): boolean {
  if (user.role === "ADMIN") return true;
  return canView(parsePermissions(user.accessLevel?.permissions), sectionKey);
}

export function hasEdit(user: CurrentUser, sectionKey: string): boolean {
  if (user.role === "ADMIN") return true;
  return canEdit(parsePermissions(user.accessLevel?.permissions), sectionKey);
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
