// Светлая и тёмная тема. Файл нарочно без "server-only": имя cookie нужно
// и серверу (чтобы отдать страницу сразу в нужной теме), и браузеру
// (чтобы запомнить выбор).

export const THEME_COOKIE = "sf_theme";
export const THEME_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

export type Theme = "light" | "dark";

export function parseTheme(value: string | undefined): Theme | null {
  return value === "light" || value === "dark" ? value : null;
}

/**
 * Цвет строки состояния под каждую тему — то, чем система красит полосу
 * над приложением в установленном PWA. Совпадает с --background: в узком
 * standalone шапки нет, и под строкой состояния лежит сам фон страницы.
 */
export const THEME_COLORS: Record<Theme, string> = {
  light: "#ffffff",
  dark: "#0a0a0a",
};

/**
 * Скрипт, который проставляет тему до первой отрисовки.
 *
 * Нужен ровно для одного случая: человек ещё НЕ выбирал тему, и мы идём за
 * настройкой системы. На сервере её не узнать — там нет ни экрана, ни
 * браузера. Если оставить это React'у, страница успеет мигнуть светлым и
 * только потом потемнеть.
 *
 * Скрипт крошечный и без внешних вызовов, поэтому выполняется мгновенно.
 * Когда выбор уже сделан, тему проставляет сервер, и скрипт лишь подтверждает
 * то же самое.
 */
export const THEME_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=([^;]*)/);var t=m&&m[1];if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){}})()`;

/**
 * Перекрасить полосу состояния в момент переключения темы кнопкой.
 *
 * Всё остальное время верный цвет отдаёт сервер: он знает тему из cookie
 * и рисует ровно один мета-тег (см. generateViewport в (admin)/layout.tsx).
 * Пытаться держать пару тегов с media и править их скриптом не вышло —
 * React при гидратации возвращает свою разметку мета-тегов обратно, и
 * правка скрипта либо теряется, либо плодит дубли.
 *
 * На экране входа переключателя темы нет, так что до его собственного
 * тёмного тега эта функция не доберётся.
 */
export function syncThemeColor(theme: Theme) {
  const color = THEME_COLORS[theme];
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((m) => m.setAttribute("content", color));
}
