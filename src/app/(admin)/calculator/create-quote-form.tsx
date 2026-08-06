"use client";

import { useActionState, useState } from "react";
import { createQuote, type CreateQuoteState } from "@/app/actions/quotes";

export function CreateQuoteForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<CreateQuoteState, FormData>(
    createQuote,
    undefined,
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
      >
        Новый расчёт
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-start gap-2">
      <span className="flex basis-full flex-col gap-1 sm:basis-auto">
        <input
          autoFocus
          name="clientName"
          required
          maxLength={160}
          placeholder="Название компании клиента"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-blue-500 sm:w-72"
        />
        {state?.error ? (
          <span role="alert" className="text-xs text-red-600 dark:text-red-400">
            {state.error}
          </span>
        ) : (
          <span className="text-xs text-muted">
            Появится в шапке КП: «Расчет стоимости для: …»
          </span>
        )}
      </span>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "Создаём…" : "Создать"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-border/60"
      >
        Отмена
      </button>
    </form>
  );
}
