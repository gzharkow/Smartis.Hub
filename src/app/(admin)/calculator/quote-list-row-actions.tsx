"use client";

import { useState, useTransition } from "react";
import { purgeQuote } from "@/app/actions/quotes";
import { iconButtonClasses } from "@/components/ui/icon-button";

function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="size-4" aria-hidden="true">
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
 * Удаление расчёта — иконка внутри самой карточки, а не отдельный элемент
 * справа от неё. Тот же приём подтверждения повторным кликом, что и в
 * hub-tile-actions.tsx: карточка кликабельна целиком и ведёт на страницу
 * расчёта, поэтому клик по кнопке гасит всплытие (иначе он же открыл бы
 * страницу).
 *
 * На мыши кнопка притушена до наведения на карточку (group-hover) и лежит
 * в правом верхнем углу — карточка резервирует под неё отступ (см.
 * page.tsx), поэтому наложения на текст нет ни в одном состоянии. На
 * тач-экране (pointer-coarse) hover не бывает: кнопка всегда видна и
 * переезжает в правый нижний угол — просто маленькая кнопка, без ряда
 * текстового подтверждения (второй тап включает то же кольцо-подсветку).
 */
export function QuoteListRowActions({
  quoteId,
  canEdit = true,
}: {
  quoteId: string;
  /** Право «Изменение» на «Генератор КП» — см. calculator/page.tsx. */
  canEdit?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, startDelete] = useTransition();

  if (!canEdit) return null;

  return (
    <button
      type="button"
      disabled={deleting}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!confirming) {
          setConfirming(true);
          return;
        }
        startDelete(() => purgeQuote(quoteId));
      }}
      onMouseLeave={() => setConfirming(false)}
      aria-label={confirming ? "Точно удалить? Нажмите ещё раз" : "Удалить расчёт"}
      title={confirming ? "Точно удалить? Нажмите ещё раз" : "Удалить расчёт"}
      className={`absolute right-2 top-2 z-10 opacity-0 transition group-hover:opacity-100 pointer-coarse:top-auto pointer-coarse:bottom-2 pointer-coarse:opacity-100 ${iconButtonClasses(
        "danger",
      )} ${confirming ? "!bg-danger/15 !text-danger ring-2 ring-danger/40" : ""}`}
    >
      <TrashIcon />
    </button>
  );
}
