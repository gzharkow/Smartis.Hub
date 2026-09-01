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
 * Копировать/удалить — хаб. Форма кнопок — квадрат со скруглением
 * (`rounded-lg`, как у `iconButtonClasses`), одна и та же во всех вариантах
 * ниже.
 *
 * Два независимых варианта размещения делят один и тот же `confirming`/
 * `pending` — но реально виден только один за раз (CSS-медиа-запрос
 * `pointer-coarse`, недоступный второй — `hidden`/`pointer-coarse:hidden`),
 * так что двойное срабатывание исключено:
 *
 * 1. **Оверлей** (`position: absolute`, верхний правый угол) — на мыши
 *    всплывает по наведению на плитку/строку (group-hover), на тач-экране
 *    в СПИСКЕ виден всегда (hover недостижим тапом). Растушёвка фона под
 *    кнопками — тот же приём, что и у HubTilePreview: там, где кнопки
 *    перекрывают статус/автора, текст уходит в градиент, а не обрывается.
 * 2. **Инлайн-строка** (обычный поток, не оверлей) — только в ПЛИТКЕ на
 *    тач-экране (см. hub-list.tsx: строка вставлена прямо перед метаданными,
 *    после названия). Между двухстрочным названием и низом плитки всегда
 *    есть пустое место, поэтому здесь ничего не перекрывается и растушёвка
 *    не нужна — только мягкая полупрозрачная заливка вместо сплошной.
 *
 * Удаление требует повторного клика (см. hub-danger-buttons.tsx для того
 * же паттерна подтверждения в полный рост) — места на текст предупреждения
 * нет, поэтому подтверждение — это смена вида самой иконки.
 */
export function HubTileActions({ hubId, grid }: { hubId: string; grid: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const iconBtn =
    "grid size-9 pointer-coarse:size-11 cursor-pointer place-items-center rounded-lg " +
    "shadow-sm backdrop-blur-sm transition duration-100 active:scale-[0.92] disabled:opacity-50";
  // Сплошной цвет читается одинаково и на фото витрины (плитка), и на
  // светлом фоне строки — поэтому, в отличие от прежней нейтральной версии,
  // grid/list здесь больше не различаются.
  const copyClass = "bg-accent-fill text-on-accent hover:bg-accent-fill-hover";
  const trashClass = "bg-danger-fill text-white hover:opacity-90";
  // Инлайн-вариант в плитке — мягкая полупрозрачная заливка, а не сплошная:
  // это уже не подсказка «тут скрыто действие», а обычная видимая кнопка
  // в потоке, ей не нужно быть настолько же контрастной.
  const copyClassSoft = "bg-accent-fill/70 text-on-accent hover:bg-accent-fill-hover/80";
  const trashClassSoft = "bg-danger-fill/70 text-white hover:bg-danger-fill/85";

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
    <>
      <span
        // pointer-coarse:opacity-100 — не косметика: на телефоне hover не бывает,
        // и «Копировать»/«Удалить» были не просто незаметны, а недостижимы —
        // тап по плитке сразу уходил на страницу хаба. На мыши поведение прежнее.
        // В ПЛИТКЕ на тач-экране этот оверлей уступает место инлайн-строке
        // ниже (pointer-coarse:hidden) — в списке остаётся как есть.
        //
        // Растушёвка в верхнем правом углу — в плитке фон фото (см.
        // HubTilePreview), поэтому градиент тёмный; в списке — сплошной
        // bg-surface.
        className={`absolute right-0 top-0 z-20 flex h-16 w-32 items-start justify-end rounded-tr-xl p-2 opacity-0 transition group-hover:opacity-100 pointer-coarse:opacity-100 ${
          grid
            ? "pointer-coarse:hidden bg-gradient-to-bl from-black/60 via-black/30 to-transparent"
            : "bg-gradient-to-bl from-surface via-surface/90 to-transparent"
        }`}
        onMouseLeave={() => setConfirming(false)}
      >
        <span className="flex items-center gap-1">
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
            className={`${iconBtn} ${trashClass} ${
              // Подтверждение — то же красное, но с кольцом, чтобы второй клик
              // отличался от первого не только текстом подсказки.
              confirming ? "ring-2 ring-white/80" : ""
            }`}
          >
            <TrashIcon />
          </button>
        </span>
      </span>

      {grid ? (
        <span
          className="relative z-10 hidden items-center justify-end gap-1.5 pointer-coarse:flex"
          onMouseLeave={() => setConfirming(false)}
        >
          <button
            type="button"
            disabled={pending}
            onClick={onCopyClick}
            title="Сделать копию"
            className={`${iconBtn} ${copyClassSoft}`}
          >
            <CopyIcon />
          </button>

          <button
            type="button"
            disabled={pending}
            onClick={onTrashClick}
            title={trashTitle}
            className={`${iconBtn} ${trashClassSoft} ${confirming ? "ring-2 ring-white/80" : ""}`}
          >
            <TrashIcon />
          </button>
        </span>
      ) : null}
    </>
  );
}
