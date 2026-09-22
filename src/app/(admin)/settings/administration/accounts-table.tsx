"use client";

import { useActionState, useState } from "react";
import { deleteAccount, type DeleteAccountState } from "@/app/actions/users";
import { formatHubCreated } from "@/lib/format-datetime";
import { EditAccountPanel } from "./edit-account-panel";
import type { AccountOption } from "./account-visibility-picker";
import { buttonClasses } from "@/components/ui/button";

export type AccountRow = {
  id: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "MEMBER";
  canAccessHubs: boolean;
  canAccessAssets: boolean;
  canAccessStats: boolean;
  canAccessCalculator: boolean;
  canAddAssets: boolean;
  visibleOwnerIds: string[];
  createdAt: Date;
};

/** Ограничен ли доступ хоть по одному разделу — для короткой приписки в
 * сводке строки (полный список разделов туда не выносим, см. форму). */
function hasLimitedAccess(account: AccountRow): boolean {
  return (
    !account.canAccessHubs ||
    !account.canAccessAssets ||
    !account.canAccessStats ||
    !account.canAccessCalculator
  );
}

const SUPERADMIN_EMAIL = "admin@smartfollow.local";

/** Список аккаунтов организации с возможностью открыть правку доступа в строке. */
export function AccountsTable({
  accounts,
  accountOptions,
  currentUserEmail,
  currentUserId,
}: {
  accounts: AccountRow[];
  accountOptions: AccountOption[];
  currentUserEmail: string;
  currentUserId: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const canDelete = currentUserEmail === SUPERADMIN_EMAIL;

  if (accounts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted">
        Пока нет ни одного аккаунта, кроме вашего.
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-2">
      {accounts.map((account) => {
        const open = openId === account.id;
        return (
          <li key={account.id} className="rounded-xl border border-border bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{account.name || account.email}</p>
                <p className="truncate text-xs text-muted">
                  {account.email} ·{" "}
                  {account.role === "ADMIN"
                    ? "Администратор"
                    : account.canAddAssets
                      ? "Обычный пользователь (полный доступ к материалам)"
                      : "Обычный пользователь"}
                  {account.role === "MEMBER" && hasLimitedAccess(account)
                    ? " · ограниченный доступ"
                    : ""}{" "}
                  · {formatHubCreated(account.createdAt)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : account.id)}
                  className={buttonClasses("ghost", "md")}
                >
                  {open ? "Свернуть" : "Изменить доступ"}
                </button>
                {canDelete && account.id !== currentUserId ? (
                  <DeleteAccountButton accountId={account.id} />
                ) : null}
              </div>
            </div>

            {open ? (
              <EditAccountPanel account={account} accountOptions={accountOptions} />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function DeleteAccountButton({ accountId }: { accountId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState<DeleteAccountState, FormData>(
    deleteAccount,
    undefined,
  );

  if (state && "error" in state) {
    return <p className="text-xs text-danger">{state.error}</p>;
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={buttonClasses("ghostDanger", "md")}
      >
        Удалить
      </button>
    );
  }

  return (
    <form action={action} className="flex items-center gap-1.5">
      <input type="hidden" name="userId" value={accountId} />
      <span className="text-xs text-muted">Удалить аккаунт?</span>
      <button
        type="submit"
        disabled={pending}
        className={buttonClasses("danger", "sm")}
      >
        {pending ? "…" : "Да, удалить"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className={buttonClasses("ghost", "sm")}
      >
        Отмена
      </button>
    </form>
  );
}
