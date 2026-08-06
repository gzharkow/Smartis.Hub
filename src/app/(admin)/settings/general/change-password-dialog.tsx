"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { changePassword, type ChangePasswordState } from "@/app/actions/account";
import { useCloseOnBack } from "@/lib/use-close-on-back";

const inputClassName =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-blue-500";

function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const [state, action, pending] = useActionState<ChangePasswordState, FormData>(
    changePassword,
    undefined,
  );

  if (state && "success" in state) {
    return (
      <div className="grid gap-4">
        <p className="text-sm font-medium text-green-800 dark:text-green-400">
          Пароль изменён.
        </p>
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          Готово
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-4">
      <label className="grid gap-1.5">
        <span className="text-sm">Текущий пароль</span>
        <input
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          className={inputClassName}
        />
      </label>

      <label className="grid gap-1.5">
        <span className="text-sm">Новый пароль</span>
        <input
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className={inputClassName}
        />
      </label>

      <label className="grid gap-1.5">
        <span className="text-sm">Повторите новый пароль</span>
        <input
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className={inputClassName}
        />
      </label>

      {state && "error" in state ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}

      <p className="text-xs text-muted">
        Если забыли текущий пароль — для восстановления обратитесь к администратору.
      </p>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Сохраняем…" : "Сменить пароль"}
        </button>
      </div>
    </form>
  );
}

/**
 * Окно смены пароля — та же подложка/паттерн, что у ContactDialog
 * (src/components/showcase/contact-dialog.tsx), но на surface-цветах, а не
 * bg-white: это часть кабинета, должно уметь в тёмную тему.
 */
function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  useCloseOnBack(onClose);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid cursor-pointer place-items-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Смена пароля"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm cursor-auto rounded-2xl border border-border bg-surface p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Сменить пароль</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="grid size-8 cursor-pointer place-items-center rounded-lg text-muted transition hover:bg-border/60 hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <ChangePasswordForm onDone={onClose} />
      </div>
    </div>
  );
}

export function ChangePasswordButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition hover:bg-border/60"
      >
        Сменить пароль
      </button>

      {open ? <ChangePasswordModal onClose={() => setOpen(false)} /> : null}
    </>
  );
}
