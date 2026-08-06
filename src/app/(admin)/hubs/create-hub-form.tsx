"use client";

import { useActionState, useState } from "react";
import { createHub, type CreateHubState } from "@/app/actions/hubs";

export function CreateHubForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<CreateHubState, FormData>(
    createHub,
    undefined,
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
      >
        Создать хаб
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-start gap-2">
      {/* basis-full — на телефоне поле занимает всю строку целиком, кнопки
          уходят на следующую (иначе поле сжималось бы до нечитаемой ширины
          рядом с ними). С sm и шире — снова в одну строку, как раньше. */}
      <span className="flex basis-full flex-col gap-1 sm:basis-auto">
        <input
          autoFocus
          name="title"
          required
          maxLength={120}
          placeholder="Название компании клиента"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-blue-500 sm:w-72"
        />
        {state?.error ? (
          <span role="alert" className="text-xs text-red-600 dark:text-red-400">
            {state.error}
          </span>
        ) : (
          <span className="text-xs text-muted">
            Внутреннее имя — клиент его не увидит
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
