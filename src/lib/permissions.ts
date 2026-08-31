import "server-only";

import type { CurrentUser } from "./auth";

// Права доступа ролевые, без матрицы по разделам (модель AccessLevel из схемы
// убрана). MEMBER видит и может менять всё наравне с ADMIN, кроме библиотеки
// материалов: там переименование/удаление/перенос раздела — только ADMIN,
// а добавление — по отдельному флагу User.canAddAssets (см. canAddMaterials).
// «Настройки → Администрирование» сюда не входит — она доступна только
// role = ADMIN, жёстко, см. requireAdmin() в auth.ts.
//
// Здесь НЕТ проверки «виден ли раздел»: она была бы `return true` для всех.
// Страницы разделов открываются обычным requireUser(), меню и вкладки
// показывают все пункты. Если видимость разделов понадобится снова —
// заводить её вместе с моделью данных, а не оставлять пустую заглушку,
// которая выглядит как защита, но ничего не проверяет.

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
