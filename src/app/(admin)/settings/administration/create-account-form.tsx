"use client";

import { useActionState, useState } from "react";
import { createAccount, type CreateAccountState } from "@/app/actions/users";
import { emptyPermissions, type Permissions } from "@/lib/access-levels";
import { PermissionMatrix } from "./permission-matrix";
import { copyText } from "./copy-text";

type AccessLevelOption = { id: string; name: string };

/**
 * Обёртка нужна только чтобы «Создать ещё аккаунт» полностью пересоздавала
 * форму (свежий useActionState) — смена key размонтирует и создаёт заново.
 */
export function CreateAccountForm({ accessLevels }: { accessLevels: AccessLevelOption[] }) {
  const [formKey, setFormKey] = useState(0);
  return (
    <CreateAccountFormInner
      key={formKey}
      accessLevels={accessLevels}
      onCreateAnother={() => setFormKey((k) => k + 1)}
    />
  );
}

function CreateAccountFormInner({
  accessLevels,
  onCreateAnother,
}: {
  accessLevels: AccessLevelOption[];
  onCreateAnother: () => void;
}) {
  const [state, action, pending] = useActionState<CreateAccountState, FormData>(
    createAccount,
    undefined,
  );

  const [role, setRole] = useState<"MEMBER" | "ADMIN">("MEMBER");
  const [accessLevelMode, setAccessLevelMode] = useState<"existing" | "new">(
    accessLevels.length > 0 ? "existing" : "new",
  );
  const [accessLevelId, setAccessLevelId] = useState(accessLevels[0]?.id ?? "");
  const [accessLevelName, setAccessLevelName] = useState("");
  const [permissions, setPermissions] = useState<Permissions>(emptyPermissions());
  const [copied, setCopied] = useState(false);

  if (state && "success" in state) {
    return (
      <div className="rounded-xl border border-green-600/30 bg-green-600/5 p-5">
        <p className="font-medium text-green-800 dark:text-green-400">Аккаунт создан</p>
        <p className="mt-1 text-sm">
          Почта: <b>{state.email}</b>
        </p>
        <p className="mt-2 text-sm text-muted">
          Пароль нигде больше не сохранён — сообщите его пользователю сейчас:
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <code className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            {state.password}
          </code>
          <button
            type="button"
            onClick={async () => {
              const ok = await copyText(state.password);
              if (ok) {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }
            }}
            className="rounded-lg px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-500/10 dark:text-blue-400"
          >
            {copied ? "Скопировано" : "Копировать"}
          </button>
        </div>
        <button
          type="button"
          onClick={onCreateAnother}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          Создать ещё аккаунт
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-4 rounded-xl border border-border bg-surface p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-sm">Почта</span>
          <input
            name="email"
            type="email"
            required
            placeholder="ivan@smartis.bi"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm">Имя</span>
          <input
            name="name"
            placeholder="Иван Иванов"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </label>
      </div>

      <div className="grid gap-1.5">
        <span className="text-sm">Роль</span>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="role"
              value="MEMBER"
              checked={role === "MEMBER"}
              onChange={() => setRole("MEMBER")}
              className="size-4 accent-blue-600"
            />
            Обычный пользователь — доступ по уровню
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="role"
              value="ADMIN"
              checked={role === "ADMIN"}
              onChange={() => setRole("ADMIN")}
              className="size-4 accent-blue-600"
            />
            Администратор — полный доступ
          </label>
        </div>
      </div>

      {role === "MEMBER" ? (
        <div className="grid gap-3 rounded-lg border border-border p-4">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm font-medium">Уровень доступа</span>
            {accessLevels.length > 0 ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="accessLevelMode"
                  value="existing"
                  checked={accessLevelMode === "existing"}
                  onChange={() => setAccessLevelMode("existing")}
                  className="size-4 accent-blue-600"
                />
                Существующий
              </label>
            ) : null}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="accessLevelMode"
                value="new"
                checked={accessLevelMode === "new"}
                onChange={() => setAccessLevelMode("new")}
                className="size-4 accent-blue-600"
              />
              Новый уровень
            </label>
          </div>

          {accessLevelMode === "existing" ? (
            <select
              name="accessLevelId"
              value={accessLevelId}
              onChange={(e) => setAccessLevelId(e.target.value)}
              className="w-full max-w-xs rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-blue-500"
            >
              {accessLevels.map((lvl) => (
                <option key={lvl.id} value={lvl.id}>
                  {lvl.name}
                </option>
              ))}
            </select>
          ) : (
            <>
              <input
                name="accessLevelName"
                required
                value={accessLevelName}
                onChange={(e) => setAccessLevelName(e.target.value)}
                placeholder="Название уровня доступа, например «Авторынок»"
                className="w-full max-w-sm rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <PermissionMatrix value={permissions} onChange={setPermissions} />
              <input type="hidden" name="permissions" value={JSON.stringify(permissions)} />
            </>
          )}
        </div>
      ) : null}

      {state && "error" in state ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Создаём…" : "Создать аккаунт"}
        </button>
      </div>
    </form>
  );
}
