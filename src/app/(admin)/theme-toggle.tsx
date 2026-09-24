"use client";

import { useSyncExternalStore } from "react";
import {
  setThemePreference,
  systemTheme,
  THEME_EVENT,
  type Theme,
} from "@/lib/theme";

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-[18px]"
    >
      <path d="M20 13.5A8.5 8.5 0 0 1 10.5 4a8.5 8.5 0 1 0 9.5 9.5" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-[18px]"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

// Тема живёт не в React, а в атрибуте <html> — её туда ставит скрипт ещё до
// первой отрисовки и он же меняет её, когда сменилась тема устройства.
// Поэтому читаем её как внешнее хранилище, а не держим вторую копию в
// состоянии: две копии рано или поздно разойдутся. Любая смена — кнопкой,
// из настроек или самой системой — сопровождается событием THEME_EVENT.

function subscribe(notify: () => void) {
  window.addEventListener(THEME_EVENT, notify);
  return () => window.removeEventListener(THEME_EVENT, notify);
}

function readTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/**
 * Переключатель светлой и тёмной темы.
 *
 * Показываем значок ТОЙ темы, в которую перейдём: луна — «сделать тёмной»,
 * солнце — «сделать светлой». Так кнопка отвечает на вопрос «что будет,
 * если нажать», а не «что сейчас» — сейчас и так видно по экрану.
 */
export function ThemeToggle({ initial }: { initial: Theme | null }) {
  // Пока выбора не было, сервер темы не знает — системную настройку там не
  // прочитать. Тогда он отдаёт null, и значок появляется сразу после того,
  // как страница оживёт в браузере: лучше короткая пустота, чем солнце,
  // мигнувшее на светлом экране.
  const theme = useSyncExternalStore(subscribe, readTheme, () => initial);

  const next: Theme = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      // Тему, совпадающую с системной, не закрепляем, а возвращаемся в
      // автоматику: «тёмная» на тёмном устройстве — это и есть «как в системе».
      // Иначе одно нажатие туда-обратно навсегда отвязывало бы от системы.
      onClick={() =>
        setThemePreference(next === systemTheme() ? "system" : next)
      }
      title={next === "dark" ? "Тёмная тема" : "Светлая тема"}
      aria-label={
        next === "dark" ? "Включить тёмную тему" : "Включить светлую тему"
      }
      // Размер держим постоянным, чтобы соседние кнопки не дёргались,
      // пока тема ещё не определилась.
      className="grid size-8 pointer-coarse:size-11 place-items-center rounded-lg text-muted transition duration-100 hover:bg-border/60 hover:text-foreground active:scale-[0.92]"
    >
      {theme === null ? null : next === "dark" ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}
