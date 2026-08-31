"use client";

import { useActionState, useState } from "react";
import { createHub, type CreateHubState } from "@/app/actions/hubs";
import { buttonClasses } from "@/components/ui/button";
import { fieldClasses } from "@/components/ui/field";

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
        className={buttonClasses("primary")}
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
          className={fieldClasses("w-full sm:w-72")}
        />
        {state?.error ? (
          <span role="alert" className="text-xs text-danger">
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
