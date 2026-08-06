import "server-only";

import { db } from "./db";

/**
 * Сколько удалённые хабы лежат в «Недавно удалённых», прежде чем исчезнуть
 * насовсем. Тридцать дней — запас на «удалили не тот» и на отпуск сотрудника.
 */
export const TRASH_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Дата, раньше которой удалённые хабы уже просрочены. */
export function trashCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - TRASH_DAYS * DAY_MS);
}

/** Сколько дней осталось до окончательного удаления. Минимум 0. */
export function daysLeft(archivedAt: Date, now: Date = new Date()): number {
  const passed = (now.getTime() - archivedAt.getTime()) / DAY_MS;
  return Math.max(0, Math.ceil(TRASH_DAYS - passed));
}

/**
 * Снести хабы, пролежавшие в корзине дольше срока.
 *
 * Вызывается при открытии «Недавно удалённых». Это компромисс: правильное
 * место для такой уборки — задача по расписанию, но её негде запустить, пока
 * сервис живёт локально. Побочный эффект — хаб, на который никто не заходил,
 * может пережить свои 30 дней. Лучше так, чем стереть данные по таймеру,
 * который никто не контролирует.
 *
 * Хабы БЕЗ даты удаления не трогаем: их удалили до появления срока хранения,
 * и когда истекает их время — неизвестно. Пусть лежат до ручного решения.
 */
export async function purgeExpiredHubs(organizationId: string): Promise<number> {
  const { count } = await db.hub.deleteMany({
    where: {
      organizationId,
      status: "ARCHIVED",
      archivedAt: { not: null, lt: trashCutoff() },
    },
  });

  return count;
}
