"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  VIEW_COOKIE,
  VIEW_COOKIE_MAX_AGE,
  type ViewMode,
} from "@/lib/view-mode";

function ListIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-4"
    >
      <line x1="8" y1="6" x2="20" y2="6" />
      <line x1="8" y1="12" x2="20" y2="12" />
      <line x1="8" y1="18" x2="20" y2="18" />
      <circle cx="4" cy="6" r="1" />
      <circle cx="4" cy="12" r="1" />
      <circle cx="4" cy="18" r="1" />
    </svg>
  );
}

/** Запоминаем выбор. Вне компонента — записью в cookie React не ведает. */
function remember(mode: ViewMode) {
  document.cookie = `${VIEW_COOKIE}=${mode}; path=/; max-age=${VIEW_COOKIE_MAX_AGE}; samesite=lax`;
}

function GridIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-4"
    >
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  );
}

/**
 * Переключатель «список / плитка».
 *
 * Выбор пишем в cookie и перерисовываем страницу с сервера (`router.refresh`):
 * какой вид показать, решает сервер по cookie — поэтому список приходит сразу
 * нужным и не мигает. Одна cookie на все разделы: выбрал плитку — она везде.
 */
export function ViewToggle({ value }: { value: ViewMode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: ViewMode) {
    if (next === value) return;
    remember(next);
    startTransition(() => router.refresh());
  }

  const btn = (mode: ViewMode, label: string, icon: React.ReactNode) => {
    const active = value === mode;
    return (
      <button
        type="button"
        onClick={() => choose(mode)}
        disabled={pending}
        aria-pressed={active}
        title={label}
        aria-label={label}
        className={`grid size-7 place-items-center rounded-md transition ${
          active
            ? "bg-border text-foreground"
            : "text-muted hover:text-foreground"
        }`}
      >
        {icon}
      </button>
    );
  };

  return (
    <div
      role="group"
      aria-label="Вид списка"
      className="inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-border p-0.5"
    >
      {btn("list", "Списком", <ListIcon />)}
      {btn("grid", "Плиткой", <GridIcon />)}
    </div>
  );
}
