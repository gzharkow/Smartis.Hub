"use client";

import { useState, useTransition } from "react";
import { archiveQuote } from "@/app/actions/quotes";
import { buttonClasses } from "@/components/ui/button";

// Тот же confirm-then-archive приём, что и в quote-actions-bar.tsx на
// странице самого КП — здесь без router.push, revalidatePath внутри
// archiveQuote сам уберёт строку из списка.
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

  if (confirming) {
    return (
      <span className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          disabled={deleting}
          onClick={() => startDelete(() => archiveQuote(quoteId))}
          className={buttonClasses("danger", "sm")}
        >
          {deleting ? "…" : "Удалить"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className={buttonClasses("ghost", "sm")}
        >
          Отмена
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      title="Удалить расчёт"
      className={buttonClasses("ghostDanger", "sm", "shrink-0")}
    >
      Удалить
    </button>
  );
}
