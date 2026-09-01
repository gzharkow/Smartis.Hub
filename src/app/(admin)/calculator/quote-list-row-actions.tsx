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
 * Чистый оверлей: `position: absolute`, не резервирует место в карточке —
 * пробовали резервировать отступом на контейнере, но это реально увеличивало
 * высоту карточки. Позади кнопки — растушёвка фона в цвет карточки
 * (`bg-surface`, см. hub-tile-actions.tsx — тот же приём для хабов): там, где
 * кнопка перекрывает денежную колонку, текст уходит в градиент, а не
 * обрывается жёстко.
 *
 * На мыши кнопка с подложкой притушены до наведения на карточку (group-hover)
 * и лежат в правом верхнем углу. На тач-экране (pointer-coarse) hover не
 * бывает: подложка с кнопкой всегда видны и переезжают в правый нижний угол.
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
    <span
      className={
        "absolute right-0 z-10 flex items-start justify-end bg-gradient-to-bl " +
        "from-surface via-surface/90 to-transparent p-2 opacity-0 transition " +
        "group-hover:opacity-100 pointer-coarse:opacity-100 " +
        // Мышь: верхний правый угол, растушёвка сверху. Тач-экран: нижний
        // правый — угол карточки на тач-экране совпадает с формой лишь
        // отчасти, поэтому скругление тоже переключается вместе с углом.
        "top-0 h-12 w-28 rounded-tr-xl " +
        "pointer-coarse:top-auto pointer-coarse:bottom-0 pointer-coarse:h-14 " +
        "pointer-coarse:w-24 pointer-coarse:items-end pointer-coarse:rounded-tr-none " +
        "pointer-coarse:rounded-br-xl pointer-coarse:bg-gradient-to-tl"
      }
    >
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
        className={`${iconButtonClasses("danger")} ${
          confirming ? "!bg-danger/15 !text-danger ring-2 ring-danger/40" : ""
        }`}
      >
        <TrashIcon />
      </button>
    </span>
  );
}
