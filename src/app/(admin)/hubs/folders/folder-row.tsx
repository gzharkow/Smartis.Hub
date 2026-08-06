"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { deleteHubFolder, renameHubFolder } from "@/app/actions/hub-folders";
import { withPlural, WORDS } from "@/lib/plural";
import type { ViewMode } from "@/lib/view-mode";

export type FolderRowData = {
  id: string;
  name: string;
  hubCount: number;
};

export function FolderRow({
  folder,
  view = "list",
  canEdit = true,
}: {
  folder: FolderRowData;
  view?: ViewMode;
  /** Право «Изменение» на «Хабы → Папки» — см. hubs/folders/page.tsx. */
  canEdit?: boolean;
}) {
  const [mode, setMode] = useState<"view" | "rename" | "confirm">("view");
  const [name, setName] = useState(folder.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const grid = view === "grid";

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await renameHubFolder(folder.id, name);
        setMode("view");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось переименовать.");
      }
    });
  }

  const nameEl =
    mode === "rename" ? (
      <input
        autoFocus
        value={name}
        maxLength={60}
        disabled={pending}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") {
            setName(folder.name);
            setMode("view");
          }
        }}
        className={`rounded-lg border border-border bg-background px-2 py-1 text-sm outline-none focus:border-blue-500 ${
          grid ? "w-full" : "min-w-0 flex-1 basis-full sm:basis-auto"
        }`}
      />
    ) : (
      <Link
        href={`/hubs/folders/${folder.id}`}
        // basis-full — на телефоне название занимает свою строку целиком,
        // счётчик и кнопки уходят вниз, иначе имя обрезалось бы почти
        // сразу же, даже у коротких названий.
        className={`truncate font-medium transition hover:text-blue-600 dark:hover:text-blue-400 ${
          grid ? "" : "min-w-0 flex-1 basis-full sm:basis-auto"
        }`}
      >
        {folder.name}
      </Link>
    );

  const errorEl = error ? (
    <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
  ) : null;

  const countEl = (
    <span className="shrink-0 text-sm text-muted">
      {withPlural(folder.hubCount, WORDS.hub)}
    </span>
  );

  const actions =
    mode === "rename" ? (
        <>
          <button
            type="button"
            disabled={pending}
            onClick={save}
            className="shrink-0 rounded px-2 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-500/10 disabled:opacity-50 dark:text-blue-400"
          >
            {pending ? "…" : "Сохранить"}
          </button>
          <button
            type="button"
            onClick={() => {
              setName(folder.name);
              setError(null);
              setMode("view");
            }}
            className="shrink-0 rounded px-2 py-1 text-xs text-muted transition hover:bg-border/60"
          >
            Отмена
          </button>
        </>
      ) : mode === "confirm" ? (
        // Папка ничем не владеет, поэтому предупреждение мягкое: хабы никуда
        // не денутся, просто окажутся вне папок.
        <>
          <span className="text-xs text-muted">
            {folder.hubCount > 0
              ? "Хабы останутся, но окажутся без папки"
              : "Удалить папку?"}
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => deleteHubFolder(folder.id))}
            className="shrink-0 rounded px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400"
          >
            {pending ? "…" : "Удалить"}
          </button>
          <button
            type="button"
            onClick={() => setMode("view")}
            className="shrink-0 rounded px-2 py-1 text-xs text-muted transition hover:bg-border/60"
          >
            Отмена
          </button>
        </>
      ) : canEdit ? (
        <>
          <button
            type="button"
            onClick={() => setMode("rename")}
            className="shrink-0 rounded px-2 py-1 text-xs text-muted transition hover:bg-border/60 hover:text-foreground"
          >
            Переименовать
          </button>
          <button
            type="button"
            onClick={() => setMode("confirm")}
            className="shrink-0 rounded px-2 py-1 text-xs text-muted transition hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
          >
            Удалить
          </button>
        </>
      ) : null;

  if (grid) {
    return (
      <li className="flex h-full flex-col gap-2 rounded-xl border border-border bg-surface px-4 py-3">
        {nameEl}
        {errorEl}
        {countEl}
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          {actions}
        </div>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
      {nameEl}
      {errorEl}
      {countEl}
      {actions}
    </li>
  );
}
