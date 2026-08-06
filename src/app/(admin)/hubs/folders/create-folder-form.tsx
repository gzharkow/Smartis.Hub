"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createHubFolder, type FolderState } from "@/app/actions/hub-folders";

export function CreateFolderForm() {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<FolderState, FormData>(
    createHubFolder,
    undefined,
  );

  // Папку создали — очищаем поле и оставляем форму открытой: заводят их
  // обычно пачкой, по одной на сотрудника.
  useEffect(() => {
    if (!pending && !state?.error) formRef.current?.reset();
  }, [pending, state]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
      >
        Создать папку
      </button>
    );
  }

  return (
    <form ref={formRef} action={action} className="flex flex-wrap items-start gap-2">
      {/* basis-full — на телефоне поле занимает всю строку, кнопки уходят
          на следующую (см. тот же приём в create-hub-form.tsx). */}
      <span className="flex basis-full flex-col gap-1 sm:basis-auto">
        <input
          autoFocus
          name="name"
          required
          maxLength={60}
          placeholder="Например, фамилия сотрудника"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-blue-500 sm:w-72"
        />
        {state?.error ? (
          <span role="alert" className="text-xs text-red-600 dark:text-red-400">
            {state.error}
          </span>
        ) : (
          <span className="text-xs text-muted">
            Папку видят все сотрудники — она не закрывает доступ
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
        Готово
      </button>
    </form>
  );
}
