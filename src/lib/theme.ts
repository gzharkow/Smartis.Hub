// Светлая и тёмная тема. Файл нарочно без "server-only": имя cookie нужно
// и серверу (чтобы отдать страницу сразу в нужной теме), и браузеру
// (чтобы запомнить выбор).

// «2» — разовый сброс 2026-09-24: до появления режима «Как в системе» кнопка
// в топбаре закрепляла тему в "sf_theme" на год, и у всех, кто хоть раз её
// нажимал, система больше не командовала. Новое имя — все начинают с
// автоматики. Старую cookie не читаем, только стираем (LEGACY_THEME_COOKIE).
export const THEME_COOKIE = "sf_theme2";
const LEGACY_THEME_COOKIE = "sf_theme";
export const THEME_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

export type Theme = "light" | "dark";

/**
 * Что выбрал человек. "system" — выбора нет, тема идёт за настройкой
 * устройства (Windows, macOS, iOS, Android) и меняется вместе с ней на лету.
 * В cookie "system" не пишется: это просто отсутствие cookie.
 */
export type ThemePreference = Theme | "system";

export function parseTheme(value: string | undefined): Theme | null {
  return value === "light" || value === "dark" ? value : null;
}

export function parseThemePreference(value: string | undefined): ThemePreference {
  return parseTheme(value) ?? "system";
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
 * Событие на window: тема на <html> поменялась не из React (системная
 * настройка сменилась сама). Переключатели подписываются на него, чтобы
 * значок не отставал от экрана.
 */
export const THEME_EVENT = "sf-theme";

/**
 * Скрипт, который проставляет тему до первой отрисовки и дальше следит за
 * системной настройкой.
 *
 * Нужен для случая, когда человек НЕ выбирал тему, и мы идём за
 * настройкой системы. На сервере её не узнать — там нет ни экрана, ни
 * браузера. Если оставить это React'у, страница успеет мигнуть светлым и
 * только потом потемнеть.
 *
 * Слушатель смены системной темы тоже живёт здесь, а не в React: скрипт есть
 * на каждой странице, включая витрину, где клиентских компонентов темы нет.
 * Cookie перечитывается в обработчике — выбор мог появиться уже после
 * загрузки, и тогда система больше не командует.
 *
 * Перекрашиваем только те theme-color, что сейчас стоят в цвете одной из тем:
 * у /login свой постоянный цвет подложки, его трогать нельзя.
 */
export const THEME_SCRIPT = `(function(){try{var d=document.documentElement,q=window.matchMedia("(prefers-color-scheme: dark)"),C=${JSON.stringify(THEME_COLORS)};document.cookie="${LEGACY_THEME_COOKIE}=; path=/; max-age=0; samesite=lax";function p(){var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=([^;]*)/);var t=m&&m[1];return t==="light"||t==="dark"?t:null}d.dataset.theme=p()||(q.matches?"dark":"light");function f(){if(p())return;var t=q.matches?"dark":"light";d.dataset.theme=t;document.querySelectorAll('meta[name="theme-color"]').forEach(function(x){var c=x.getAttribute("content");if(c===C.light||c===C.dark)x.setAttribute("content",C[t])});window.dispatchEvent(new Event("${THEME_EVENT}"))}q.addEventListener?q.addEventListener("change",f):q.addListener(f)}catch(e){}})()`;

/**
 * Перекрасить полосу состояния в момент смены темы из интерфейса.
 *
 * Всё остальное время верный цвет отдаёт сервер: он знает тему из cookie
 * и рисует ровно один мета-тег (см. generateViewport в (admin)/layout.tsx).
 * Пытаться держать пару тегов с media и править их скриптом не вышло —
 * React при гидратации возвращает свою разметку мета-тегов обратно, и
 * правка скрипта либо теряется, либо плодит дубли.
 *
 * Как и THEME_SCRIPT, не трогает теги с посторонним цветом (подложка /login).
 */
export function syncThemeColor(theme: Theme) {
  const color = THEME_COLORS[theme];
  const ours = Object.values(THEME_COLORS);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    if (ours.includes(m.getAttribute("content") ?? "")) {
      m.setAttribute("content", color);
    }
  });
}

/** Тема устройства прямо сейчас. Только для браузера. */
export function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * Применить выбор человека: пишем тему прямо в <html> (там её ждут и
 * переменные цвета, и классы dark:*), запоминаем в cookie и перекрашиваем
 * полосу состояния PWA. "system" — удаляем cookie, дальше тему ведёт
 * слушатель из THEME_SCRIPT.
 */
export function setThemePreference(pref: ThemePreference) {
  const theme = pref === "system" ? systemTheme() : pref;
  document.documentElement.dataset.theme = theme;
  document.cookie =
    pref === "system"
      ? `${THEME_COOKIE}=; path=/; max-age=0; samesite=lax`
      : `${THEME_COOKIE}=${pref}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`;
  syncThemeColor(theme);
  window.dispatchEvent(new Event(THEME_EVENT));
}
