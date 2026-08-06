"use client";

import { useActionState, useState } from "react";
import { updateAccountAccess, type UpdateAccountState } from "@/app/actions/users";
import { emptyPermissions, type Permissions } from "@/lib/access-levels";
import { PermissionMatrix } from "./permission-matrix";
import { copyText } from "./copy-text";
import type { AccountRow, AccessLevelOption } from "./accounts-table";

export function EditAccountPanel({
  account,
  accessLevels,
}: {
  account: AccountRow;
  accessLevels: AccessLevelOption[];
}) {
  const [state, action, pending] = useActionState<UpdateAccountState, FormData>(
    updateAccountAccess,
    undefined,
  );

  const [role, setRole] = useState<"MEMBER" | "ADMIN">(account.role);
  const [accessLevelMode, setAccessLevelMode] = useState<"existing" | "new">(
    accessLevels.length > 0 ? "existing" : "new",
  );
  const [accessLevelId, setAccessLevelId] = useState(
    account.accessLevelId ?? accessLevels[0]?.id ?? "",
  );
  const [accessLevelName, setAccessLevelName] = useState("");
  const [permissions, setPermissions] = useState<Permissions>(
    accessLevels.find((l) => l.id === account.accessLevelId)?.permissions ?? emptyPermissions(),
  );
  const [resetPassword, setResetPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  return (
    <form action={action} className="grid gap-4 border-t border-border px-4 py-4">
      <input type="hidden" name="userId" value={account.id} />

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
                placeholder="Название уровня доступа"
                className="w-full max-w-sm rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <PermissionMatrix value={permissions} onChange={setPermissions} />
              <input type="hidden" name="permissions" value={JSON.stringify(permissions)} />
            </>
          )}
        </div>
      ) : null}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={resetPassword}
          onChange={(e) => setResetPassword(e.target.checked)}
          className="size-4 accent-blue-600"
        />
        Сбросить пароль (сгенерировать новый)
      </label>
      <input type="hidden" name="newPassword" value={resetPassword ? "1" : "0"} />

      {state && "error" in state ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}

      {state && "success" in state && state.password ? (
        <div className="rounded-lg border border-green-600/30 bg-green-600/5 p-3">
          <p className="text-sm text-muted">Новый пароль (больше нигде не сохранён):</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <code className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
              {state.password}
            </code>
            <button
              type="button"
              onClick={async () => {
                const password = state.password;
                if (!password) return;
                const ok = await copyText(password);
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
        </div>
      ) : null}
      {state && "success" in state && !state.password ? (
        <p className="text-sm text-green-700 dark:text-green-400">Сохранено</p>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Сохраняем…" : "Сохранить"}
        </button>
      </div>
    </form>
  );
}
