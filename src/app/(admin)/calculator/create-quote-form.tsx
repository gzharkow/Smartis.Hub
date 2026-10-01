"use client";

import { useActionState, useState } from "react";
import { createQuote, type CreateQuoteState } from "@/app/actions/quotes";
import { buttonClasses } from "@/components/ui/button";
import { fieldClasses } from "@/components/ui/field";
import { IndustrySelect } from "@/components/industry-select";

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
        className={buttonClasses("primary")}
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
          className={fieldClasses("w-full sm:w-72")}
        />
        {state?.error ? (
          <span role="alert" className="text-xs text-danger">
            {state.error}
          </span>
        ) : (
          <span className="text-xs text-muted">
            Появится в шапке КП: «Расчет стоимости для: …»
          </span>
        )}
      </span>

      <IndustrySelect />

      <button
        type="submit"
        disabled={pending}
        className={buttonClasses("primary")}
      >
        {pending ? "Создаём…" : "Создать"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className={buttonClasses("ghost", "md")}
      >
        Отмена
      </button>
    </form>
  );
}
