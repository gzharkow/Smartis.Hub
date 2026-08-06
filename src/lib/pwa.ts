"use client";

/**
 * Узкий экран (телефон) + запущено как установленное PWA. Проверяется в
 * JS, а не через CSS-вариант standalone (globals.css) — нужна там, где
 * логика завязана не на разметку, а на обработчики событий/эффекты
 * (pull-to-refresh, скролл-фикс позиции нижнего бара при холодном
 * запуске) — условным классом такое не отключить.
 */
export function isStandaloneNarrow() {
  return (
    window.matchMedia("(display-mode: standalone)").matches &&
    window.innerWidth < 768
  );
}
