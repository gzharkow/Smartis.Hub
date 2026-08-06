// Как показывать списки — строками или плиткой. Файл без "use client" и без
// "server-only": имя cookie и разбор нужны и серверу (отдать страницу сразу
// в нужном виде), и браузеру (запомнить выбор). Тот же приём, что у бокового
// меню, см. nav-cookie.ts.

export const VIEW_COOKIE = "sf_view";
export const VIEW_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

export type ViewMode = "list" | "grid";

/** По умолчанию — список: он плотнее и в нём видно больше за раз. */
export function parseViewMode(value: string | undefined): ViewMode {
  return value === "grid" ? "grid" : "list";
}

// Классы контейнера под каждый вид — одни на все разделы, чтобы плитки
// везде были одинакового размера.
export const VIEW_LIST_CLASS = "grid grid-cols-1 gap-2";
export const VIEW_GRID_CLASS =
  "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4";
