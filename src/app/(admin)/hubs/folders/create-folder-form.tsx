"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createHubFolder, type FolderState } from "@/app/actions/hub-folders";
import { buttonClasses } from "@/components/ui/button";
import { fieldClasses } from "@/components/ui/field";

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
        className={buttonClasses("primary")}
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
          className={fieldClasses("w-full sm:w-72")}
        />
        {state?.error ? (
          <span role="alert" className="text-xs text-danger">
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
        className={buttonClasses("primary")}
      >
        {pending ? "Создаём…" : "Создать"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className={buttonClasses("ghost", "md")}
      >
        Готово
      </button>
    </form>
  );
}
