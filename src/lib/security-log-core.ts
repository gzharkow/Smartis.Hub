// Чистая часть журнала безопасности: фильтр деталей, подписи, срок хранения,
// подавитель «залпа». Без базы и без "server-only" — её проверяет tsx-скрипт
// (npm run check:seclog). Запись в базу — в security-log.ts.

import type { SecurityEventType } from "../generated/prisma/enums";

export const EVENT_LABELS: Record<SecurityEventType, string> = {
  LOGIN_SUCCESS: "Вход выполнен",
  LOGIN_FAILED: "Неудачный вход",
  LOGIN_BLOCKED: "Вход заблокирован лимитом попыток",
  LOGOUT: "Выход",
  PASSWORD_CHANGED: "Пароль изменён сотрудником",
  PASSWORD_CHANGE_FAILED: "Неудачная смена пароля",
  PASSWORD_RESET: "Администратор выдал новый пароль",
  ACCOUNT_CREATED: "Создана учётная запись",
  ACCOUNT_UPDATED: "Изменены права учётной записи",
  ACCOUNT_DELETED: "Учётная запись удалена",
  SHARE_LINK_CREATED: "Выдана ссылка клиенту",
  SHARE_LINK_REVOKED: "Ссылка отозвана",
  SHARE_LINK_RESTORED: "Ссылка возвращена",
  ITEM_PURGED: "Удалено безвозвратно",
  DATA_EXPORTED: "Выгрузка или скачивание данных",
};

export const RETENTION_MS = 365 * 24 * 60 * 60 * 1000;
export const PURGE_EVERY_MS = 24 * 60 * 60 * 1000;

export function retentionCutoff(now: number): Date {
  return new Date(now - RETENTION_MS);
}

/** Пора ли в этом процессе снова чистить старые записи. */
export function purgeDue(lastRun: number, now: number): boolean {
  return now - lastRun >= PURGE_EVERY_MS;
}

// Ключи, в которых по названию может оказаться секрет, — отбрасываем целиком.
const SECRET_KEY = /pass|hash|token|secret|cookie|authorization/i;
const MAX_VALUE_LENGTH = 200;
const MAX_KEYS = 20;

export type DetailValue = string | number | boolean | null;

/**
 * Оставляет только короткие плоские значения. Пароли, хэши и токены сюда не
 * должны попадать, но защищаемся и от случайной ошибки в вызывающем коде.
 */
export function sanitizeDetails(
  input: Record<string, unknown> | undefined | null,
): Record<string, DetailValue> | null {
  if (!input) return null;
  const out: Record<string, DetailValue> = {};
  for (const [key, value] of Object.entries(input)) {
    if (Object.keys(out).length >= MAX_KEYS) break;
    if (SECRET_KEY.test(key)) continue;
    if (typeof value === "string") out[key] = value.slice(0, MAX_VALUE_LENGTH);
    else if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
    else if (typeof value === "boolean") out[key] = value;
    else if (value === null) out[key] = null;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function clip(value: string | null | undefined, max = 200): string | null {
  if (!value) return null;
  return value.length > max ? value.slice(0, max) : value;
}

/** Не чаще одного раза за окно на ключ — чтобы перебор не раздувал таблицу. */
export function createOncePerWindow(windowMs: number, maxKeys = 5_000) {
  const seen = new Map<string, number>();
  return {
    allow(key: string, now: number): boolean {
      const until = seen.get(key);
      if (until !== undefined && until > now) return false;
      seen.set(key, now + windowMs);
      if (seen.size > maxKeys) {
        for (const [k, t] of seen) if (t <= now) seen.delete(k);
        for (const k of seen.keys()) {
          if (seen.size <= maxKeys) break;
          seen.delete(k);
        }
      }
      return true;
    },
  };
}

/** Подписи для ключей `details` в просмотрщике. Неизвестный ключ показываем как есть. */
export const DETAIL_LABELS: Record<string, string> = {
  reason: "Причина",
  role: "Роль",
  roleFrom: "Роль была",
  roleTo: "Роль стала",
  changed: "Изменено",
  hubId: "Хаб",
  expiresAt: "Действует до",
  kind: "Вид",
  title: "Название",
  what: "Что",
  months: "Месяцы",
  quarters: "Кварталы",
  count: "Количество",
  visibleOwners: "Видит авторов",
  system: "Система",
};

export function formatDetails(details: unknown): string {
  if (!details || typeof details !== "object") return "";
  return Object.entries(details as Record<string, unknown>)
    .map(([k, v]) => `${DETAIL_LABELS[k] ?? k}: ${String(v)}`)
    .join(" · ");
}
