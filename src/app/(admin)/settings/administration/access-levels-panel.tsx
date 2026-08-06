"use client";

import { useActionState, useState } from "react";
import { editAccessLevel, type EditAccessLevelState } from "@/app/actions/users";
import { withPlural, WORDS } from "@/lib/plural";
import type { Permissions } from "@/lib/access-levels";
import { PermissionMatrix } from "./permission-matrix";

export type AccessLevelData = {
  id: string;
  name: string;
  permissions: Permissions;
  userCount: number;
};

/**
 * Уровень доступа общий — им может пользоваться сразу несколько аккаунтов,
 * поэтому правка здесь меняет доступ всем им одновременно, не только одному.
 */
export function AccessLevelsPanel({ levels }: { levels: AccessLevelData[] }) {
  if (levels.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted">
        Уровни доступа появятся здесь после того, как первый будет заведён вместе с аккаунтом.
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-2">
      {levels.map((level) => (
        <AccessLevelRow key={level.id} level={level} />
      ))}
    </ul>
  );
}

function AccessLevelRow({ level }: { level: AccessLevelData }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(level.name);
  const [permissions, setPermissions] = useState<Permissions>(level.permissions);
  const [state, action, pending] = useActionState<EditAccessLevelState, FormData>(
    editAccessLevel,
    undefined,
  );

  return (
    <li className="rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{level.name}</p>
          <p className="text-xs text-muted">{withPlural(level.userCount, WORDS.person)}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 rounded-lg px-3 py-1.5 text-sm text-muted transition hover:bg-border/60 hover:text-foreground"
        >
          {open ? "Свернуть" : "Изменить"}
        </button>
      </div>

      {open ? (
        <form action={action} className="grid gap-3 border-t border-border px-4 py-4">
          <input type="hidden" name="accessLevelId" value={level.id} />
          <input type="hidden" name="permissions" value={JSON.stringify(permissions)} />

          <label className="grid gap-1.5">
            <span className="text-sm">Название</span>
            <input
              name="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full max-w-sm rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </label>

          <PermissionMatrix value={permissions} onChange={setPermissions} />

          {state && "error" in state ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {state.error}
            </p>
          ) : null}
          {state && "success" in state ? (
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
      ) : null}
    </li>
  );
}
