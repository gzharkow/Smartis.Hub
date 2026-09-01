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
    "grid size-9 pointer-coarse:size-11 cursor-pointer place-items-center rounded-full " +
    "shadow-sm backdrop-blur-sm transition duration-100 active:scale-[0.92] disabled:opacity-50";
  // Сплошной цвет читается одинаково и на фото витрины (плитка), и на
  // светлом фоне строки — поэтому, в отличие от прежней нейтральной версии,
  // grid/list здесь больше не различаются.
  const copyClass = "bg-accent-fill text-on-accent hover:bg-accent-fill-hover";
  const trashClass = "bg-danger-fill text-white hover:opacity-90";

  return (
    <span
      // pointer-coarse:opacity-100 — не косметика: на телефоне hover не бывает,
      // и «Копировать»/«Удалить» были не просто незаметны, а недостижимы —
      // тап по плитке сразу уходил на страницу хаба. На мыши поведение прежнее.
      //
      // Якорь всегда top-right (а не inset-y-0 по центру строки в списке) —
      // единое предсказуемое место, под которое верхний ряд карточки
      // (см. hub-list.tsx) резервирует отступ, поэтому кнопки больше не
      // наезжают на название хаба ни в плитке, ни в списке.
      className={`absolute top-2 z-20 flex items-center gap-1 opacity-0 transition group-hover:opacity-100 pointer-coarse:opacity-100 ${
        grid ? "right-2" : "right-3"
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
        className={`${iconBtn} ${copyClass}`}
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
        className={`${iconBtn} ${trashClass} ${
          // Подтверждение — то же красное, но с кольцом, чтобы второй клик
          // отличался от первого не только текстом подсказки.
          confirming ? "ring-2 ring-white/80" : ""
        }`}
      >
        <TrashIcon />
      </button>
    </span>
  );
}
