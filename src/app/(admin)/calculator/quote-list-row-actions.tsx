"use client";

import { useState, useTransition } from "react";
import { archiveQuote } from "@/app/actions/quotes";

// Тот же confirm-then-archive приём, что и в quote-actions-bar.tsx на
// странице самого КП — здесь без router.push, revalidatePath внутри
// archiveQuote сам уберёт строку из списка.
export function QuoteListRowActions({ quoteId }: { quoteId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, startDelete] = useTransition();

  if (confirming) {
    return (
      <span className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          disabled={deleting}
          onClick={() => startDelete(() => archiveQuote(quoteId))}
          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400"
        >
          {deleting ? "…" : "Удалить"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-lg px-2.5 py-1.5 text-xs text-muted transition hover:bg-border/60"
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
      className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs text-muted transition hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
    >
      Удалить
    </button>
  );
}
