"use client";

import { useActionState, useState } from "react";
import { updateAccountAccess, type UpdateAccountState } from "@/app/actions/users";
import { AccountVisibilityPicker, type AccountOption } from "./account-visibility-picker";
import { copyText } from "./copy-text";
import type { AccountRow } from "./accounts-table";
import { buttonClasses } from "@/components/ui/button";

export function EditAccountPanel({
  account,
  accountOptions,
}: {
  account: AccountRow;
  accountOptions: AccountOption[];
}) {
  const [state, action, pending] = useActionState<UpdateAccountState, FormData>(
    updateAccountAccess,
    undefined,
  );

  const [role, setRole] = useState<"MEMBER" | "ADMIN">(account.role);
  const [canAddAssets, setCanAddAssets] = useState(account.canAddAssets);
  const [visibleOwnerIds, setVisibleOwnerIds] = useState<string[]>(account.visibleOwnerIds);
  const [resetPassword, setResetPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  // Аккаунт не может видеть сам себя в списке видимости.
  const otherAccounts = accountOptions.filter((o) => o.id !== account.id);

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
              className="size-4"
            />
            Обычный пользователь — доступ как у администратора, кроме материалов
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="role"
              value="ADMIN"
              checked={role === "ADMIN"}
              onChange={() => setRole("ADMIN")}
              className="size-4"
            />
            Администратор — полный доступ
          </label>
        </div>
      </div>

      {role === "MEMBER" ? (
        <div className="grid gap-4 rounded-lg border border-border p-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={canAddAssets}
              onChange={(e) => setCanAddAssets(e.target.checked)}
            />
            Разрешить добавление материалов в библиотеку
          </label>
          <input type="hidden" name="canAddAssets" value={canAddAssets ? "1" : "0"} />
          <p className="text-xs text-muted">
            Переименование и удаление материалов всё равно останутся недоступны — это может
            только администратор.
          </p>

          <AccountVisibilityPicker
            options={otherAccounts}
            selected={visibleOwnerIds}
            onChange={setVisibleOwnerIds}
          />
        </div>
      ) : null}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={resetPassword}
          onChange={(e) => setResetPassword(e.target.checked)}
          className="size-4"
        />
        Сбросить пароль (сгенерировать новый)
      </label>
      <input type="hidden" name="newPassword" value={resetPassword ? "1" : "0"} />

      {state && "error" in state ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      {state && "success" in state && state.password ? (
        <div className="rounded-lg border border-ok/30 bg-ok/5 p-3">
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
              className="rounded-lg px-3 py-2 text-sm font-medium text-accent transition hover:bg-accent/10"
            >
              {copied ? "Скопировано" : "Копировать"}
            </button>
          </div>
        </div>
      ) : null}
      {state && "success" in state && !state.password ? (
        <p className="text-sm text-ok">Сохранено</p>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={pending}
          className={buttonClasses("primary")}
        >
          {pending ? "Сохраняем…" : "Сохранить"}
        </button>
      </div>
    </form>
  );
}
