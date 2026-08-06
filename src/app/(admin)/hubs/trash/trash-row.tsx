"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { purgeHub, restoreHub } from "@/app/actions/hubs";
import { plural, withPlural, WORDS } from "@/lib/plural";
import type { ViewMode } from "@/lib/view-mode";

const DAY: [string, string, string] = ["день", "дня", "дней"];

export type TrashRowData = {
  id: string;
  title: string;
  items: number;
  links: number;
  /** Сколько дней осталось до окончательного удаления. null — срок неизвестен. */
  daysLeft: number | null;
};

export function TrashRow({
  hub,
  view = "list",
}: {
  hub: TrashRowData;
  view?: ViewMode;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const grid = view === "grid";

  const title = (
    <Link
      href={`/hubs/${hub.id}`}
      // basis-full — на телефоне название занимает свою строку целиком,
      // остальное (счётчики, срок, кнопки) уходит вниз (см. folder-row.tsx).
      className={`truncate font-medium transition hover:text-blue-600 dark:hover:text-blue-400 ${
        grid ? "line-clamp-2 whitespace-normal" : "min-w-0 flex-1 basis-full sm:basis-auto"
      }`}
    >
      {hub.title}
    </Link>
  );

  const meta = (
    <span className="shrink-0 text-sm text-muted">
      {withPlural(hub.items, WORDS.material)} ·{" "}
      {withPlural(hub.links, WORDS.link)}
    </span>
  );

  const daysLeft = (
    <span className="shrink-0 text-xs text-muted">
      {hub.daysLeft === null
        ? "срок не задан"
        : hub.daysLeft === 0
          ? "исчезнет со дня на день"
          : `ещё ${hub.daysLeft} ${plural(hub.daysLeft, DAY)}`}
    </span>
  );

  const actions = confirming ? (
        <span className="flex flex-wrap items-center gap-2">
          {/* Здесь предупреждение жёстче, чем при обычном удалении: это
              единственное место в сервисе, где данные исчезают навсегда. */}
          <span className="text-xs text-red-600 dark:text-red-400">
            Вся статистика по хабу пропадёт. Вернуть будет нельзя
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => purgeHub(hub.id))}
            className="shrink-0 rounded px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400"
          >
            {pending ? "…" : "Стереть"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="shrink-0 rounded px-2 py-1 text-xs text-muted transition hover:bg-border/60"
          >
            Отмена
          </button>
        </span>
      ) : (
        <>
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => restoreHub(hub.id))}
            className="shrink-0 rounded px-2 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-500/10 disabled:opacity-50 dark:text-blue-400"
          >
            {pending ? "…" : "Вернуть"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="shrink-0 rounded px-2 py-1 text-xs text-muted transition hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
          >
            Удалить навсегда
          </button>
        </>
      );

  if (grid) {
    return (
      <li className="flex h-full flex-col gap-2 rounded-xl border border-border px-4 py-3 opacity-80">
        {title}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {meta}
          {daysLeft}
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          {actions}
        </div>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border border-border px-4 py-3 opacity-80">
      {title}
      {meta}
      {daysLeft}
      {actions}
    </li>
  );
}
