"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/actions/auth";

// Значки в правом крае полей. Нарисованы здесь, как остальные значки проекта
// (nav-icons, editor-icons), — ради двух штук лишняя зависимость не нужна.
function AtIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-[18px]"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-[18px]"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    login,
    undefined,
  );

  // Общий вид поля. pr-10 — место под значок справа, чтобы текст под него
  // не заезжал. Подпись живёт в placeholder и гаснет сама, как только введён
  // первый символ (обычное поведение placeholder) — специально ничего не
  // гасим на фокусе. Видимой подписи над полем нет, поэтому обязателен
  // aria-label: без него поле немо для программ чтения с экрана.
  const fieldClass =
    "w-full rounded-lg border border-border bg-background py-2 pr-10 pl-3 outline-none placeholder:text-muted focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

  return (
    <form action={action} className="flex flex-col gap-2.5">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <div className="relative">
        <input
          id="email"
          name="email"
          type="text"
          autoComplete="username"
          required
          aria-label="E-mail или логин"
          placeholder="e-mail / логин"
          className={fieldClass}
        />
        {/* pointer-events-none: значок декоративный, клик сквозь него
            попадает в поле. */}
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted">
          <AtIcon />
        </span>
      </div>

      <div className="relative">
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-label="Пароль"
          placeholder="пароль"
          className={fieldClass}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted">
          <LockIcon />
        </span>
      </div>

      {state?.error ? (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
        >
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-1.5 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "Проверяем…" : "Войти"}
      </button>
    </form>
  );
}
