"use client";

import { useSyncExternalStore } from "react";
import {
  parseThemePreference,
  setThemePreference,
  THEME_COOKIE,
  THEME_EVENT,
  type ThemePreference,
} from "@/lib/theme";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "Как в системе" },
  { value: "light", label: "Светлая" },
  { value: "dark", label: "Тёмная" },
];

function subscribe(notify: () => void) {
  window.addEventListener(THEME_EVENT, notify);
  return () => window.removeEventListener(THEME_EVENT, notify);
}

function readPreference(): ThemePreference {
  const m = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=([^;]*)`));
  return parseThemePreference(m?.[1]);
}

/**
 * Выбор темы: как в системе, светлая или тёмная.
 *
 * Здесь, в отличие от кнопки в топбаре, показываем сам выбор, а не тему на
 * экране: «как в системе» и «светлая» днём выглядят одинаково, но ведут себя
 * по-разному вечером. Выбор хранит только cookie — её и читаем, а не держим
 * копию в состоянии: кнопка в топбаре на этой же странице может его сменить.
 */
export function ThemePicker({ initial }: { initial: ThemePreference }) {
  const value = useSyncExternalStore(subscribe, readPreference, () => initial);

  return (
    <div
      role="radiogroup"
      aria-label="Тема оформления"
      className="inline-flex shrink-0 flex-wrap items-center gap-0.5 rounded-lg border border-border p-0.5"
    >
      {OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setThemePreference(opt.value)}
            className={`rounded-md px-2.5 py-1 text-sm transition duration-100 pointer-coarse:min-h-11 active:scale-[0.96] ${
              active
                ? "bg-border font-medium text-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
