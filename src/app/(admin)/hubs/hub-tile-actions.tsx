"use client";

import { useState, useTransition } from "react";
import { archiveHub, duplicateHub } from "@/app/actions/hubs";

function CopyIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="size-3.5" aria-hidden="true">
      <rect x="7" y="7" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M13 7V4.5A1.5 1.5 0 0 0 11.5 3H4.5A1.5 1.5 0 0 0 3 4.5v7A1.5 1.5 0 0 0 4.5 13H7"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="size-3.5" aria-hidden="true">
      <path
        d="M4 6h12M8 6V4.5A1.5 1.5 0 0 1 9.5 3h1A1.5 1.5 0 0 1 12 4.5V6m-6.5 0 .6 9a1.5 1.5 0 0 0 1.497 1.4h3.806A1.5 1.5 0 0 0 14.9 15l.6-9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Копировать/удалить — всплывают по наведению на плитку/строку хаба
 * (см. group-hover в hub-list.tsx). Кнопки внутри <Link> карточки, поэтому
 * каждый клик гасит всплытие — иначе он же открыл бы страницу хаба.
 *
 * Удаление требует повторного клика (см. hub-danger-buttons.tsx для того
 * же паттерна подтверждения в полный рост) — на плитке места на текст
 * предупреждения нет, поэтому подтверждение — это смена вида самой иконки.
 */
export function HubTileActions({ hubId, grid }: { hubId: string; grid: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const iconBtn =
    "grid size-7 cursor-pointer place-items-center rounded-full backdrop-blur-sm transition disabled:opacity-50";
  // В плитке фон — тёмное фото витрины, нужен светлый глянцевый значок.
  // В строке фон светлый (bg-surface), берём тот же стиль бордера,
  // что и у остальных кнопок действий в сервисе.
  const neutral = grid
    ? "bg-black/55 text-white hover:bg-black/75"
    : "border border-border bg-surface text-muted hover:bg-border/60 hover:text-foreground";

  return (
    <span
      className={`absolute z-20 flex items-center gap-1 opacity-0 transition group-hover:opacity-100 ${
        grid ? "top-2 right-2" : "inset-y-0 right-3"
      }`}
      onMouseLeave={() => setConfirming(false)}
    >
      <button
        type="button"
        disabled={pending}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          startTransition(() => duplicateHub(hubId));
        }}
        title="Сделать копию"
        className={`${iconBtn} ${neutral}`}
      >
        <CopyIcon />
      </button>

      <button
        type="button"
        disabled={pending}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!confirming) {
            setConfirming(true);
            return;
          }
          startTransition(() => archiveHub(hubId));
        }}
        title={confirming ? "Точно удалить? Нажмите ещё раз" : "Удалить"}
        className={`${iconBtn} ${
          confirming ? "bg-red-600 text-white hover:bg-red-700" : neutral
        }`}
      >
        <TrashIcon />
      </button>
    </span>
  );
}
