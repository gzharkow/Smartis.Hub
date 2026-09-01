"use client";

import { useState, useTransition } from "react";
import { archiveHub, duplicateHub } from "@/app/actions/hubs";

function CopyIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="size-4.5" aria-hidden="true">
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
    <svg viewBox="0 0 20 20" fill="none" className="size-4.5" aria-hidden="true">
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
 * Копировать/удалить — только на ПЛИТКЕ хаба (в списке действие убрано
 * совсем — оно перекрывало дату и бейдж автора что на мыши по наведению,
 * что на тач-экране, а зайти в сам хаб и сделать то же самое оттуда ничуть
 * не сложнее). Один и тот же блок для мыши и тач-экрана — квадратные
 * кнопки со скруглением, мягкая полупрозрачная заливка (`/45`), друг под
 * другом (копировать сверху, мусорка снизу), привязаны к НИЖНЕМУ краю
 * плитки фиксированным отступом — не к месту в потоке, поэтому положение
 * одно и то же на любом хабе независимо от того, в одну или две строки
 * легло название. Разница только в показе: на мыши — по наведению
 * (`group-hover`), на тач-экране — всегда (наведения там не бывает).
 *
 * Удаление требует повторного клика (см. hub-danger-buttons.tsx для того
 * же паттерна подтверждения в полный рост) — места на текст предупреждения
 * нет, поэтому подтверждение — это смена вида самой иконки.
 */
export function HubTileActions({ hubId }: { hubId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const iconBtn =
    "grid size-9 pointer-coarse:size-11 cursor-pointer place-items-center rounded-lg " +
    "shadow-sm backdrop-blur-sm transition duration-100 active:scale-[0.92] disabled:opacity-50";
  // Мягкая полупрозрачная заливка, а не сплошная — кнопка лежит на
  // видном месте (по наведению или постоянно), ей не нужно быть
  // настолько же контрастной, как подсказка «тут скрыто действие».
  const copyClass = "bg-accent-fill/45 text-on-accent hover:bg-accent-fill-hover/60";
  const trashClass = "bg-danger-fill/45 text-white hover:bg-danger-fill/60";

  const onCopyClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startTransition(() => duplicateHub(hubId));
  };
  const onTrashClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirming) {
      setConfirming(true);
      return;
    }
    startTransition(() => archiveHub(hubId));
  };
  const trashTitle = confirming ? "Точно удалить? Нажмите ещё раз" : "Удалить";

  return (
    <span
      // bottom-11 — с запасом выше строки метаданных (см. metaRow в
      // hub-list.tsx: mt-auto прижимает её к низу, высота — одна строка
      // text-xs).
      className="absolute bottom-11 right-2 z-20 flex flex-col gap-1.5 opacity-0 transition group-hover:opacity-100 pointer-coarse:opacity-100"
      onMouseLeave={() => setConfirming(false)}
    >
      <button
        type="button"
        disabled={pending}
        onClick={onCopyClick}
        title="Сделать копию"
        className={`${iconBtn} ${copyClass}`}
      >
        <CopyIcon />
      </button>

      <button
        type="button"
        disabled={pending}
        onClick={onTrashClick}
        title={trashTitle}
        className={`${iconBtn} ${trashClass} ${confirming ? "ring-2 ring-white/80" : ""}`}
      >
        <TrashIcon />
      </button>
    </span>
  );
}
