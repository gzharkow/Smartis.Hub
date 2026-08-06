"use client";

import { useState } from "react";
import type { Permissions } from "@/lib/access-levels";
import { EditAccountPanel } from "./edit-account-panel";

export type AccountRow = {
  id: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "MEMBER";
  accessLevelId: string | null;
  accessLevelName: string | null;
  createdLabel: string;
};

export type AccessLevelOption = { id: string; name: string; permissions: Permissions };

/** Список аккаунтов организации с возможностью открыть правку доступа в строке. */
export function AccountsTable({
  accounts,
  accessLevels,
}: {
  accounts: AccountRow[];
  accessLevels: AccessLevelOption[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);

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
                    : (account.accessLevelName ?? "Без доступа")}{" "}
                  · {account.createdLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenId(open ? null : account.id)}
                className="shrink-0 rounded-lg px-3 py-1.5 text-sm text-muted transition hover:bg-border/60 hover:text-foreground"
              >
                {open ? "Свернуть" : "Изменить доступ"}
              </button>
            </div>

            {open ? <EditAccountPanel account={account} accessLevels={accessLevels} /> : null}
          </li>
        );
      })}
    </ul>
  );
}
