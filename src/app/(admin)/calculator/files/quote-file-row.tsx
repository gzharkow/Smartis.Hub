"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { archiveAsset, restoreAsset } from "@/app/actions/assets";
import { withPlural, WORDS } from "@/lib/plural";
import { OwnerBadge } from "@/components/owner-badge";

export type QuoteFileRowData = {
  id: string;
  title: string;
  meta: string;
  created: string;
  hubCount: number;
  /** Расчёт-источник. null — расчёт удалён физически (крайний случай). */
  quoteId: string | null;
  archived: boolean;
  /** Кто создал исходный расчёт — заполнено только у администратора. */
  owner?: { id: string; label: string } | null;
};

// Тот же confirm-then-archive приём, что у AssetRow в /assets и у
// QuoteListRowActions в /calculator — файл калькулятора удаляется тем же
// archiveAsset, что и обычный материал: он и есть Asset, просто без
// собственного места в общей библиотеке.
export function QuoteFileRow({
  file,
  canEdit = true,
}: {
  file: QuoteFileRowData;
  /** Право «Изменение» на «Генератор КП → Файлы» — см. calculator/files/page.tsx. */
  canEdit?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const actionCluster = !canEdit ? null : file.archived ? (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => restoreAsset(file.id))}
      className="shrink-0 rounded px-2 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-500/10 disabled:opacity-50 dark:text-blue-400"
    >
      {pending ? "…" : "Восстановить"}
    </button>
  ) : confirming ? (
    <span className="flex shrink-0 items-center gap-2">
      <span className="text-xs text-muted">
        {file.hubCount > 0
          ? `Стоит в ${withPlural(file.hubCount, WORDS.hubIn)} — пропадёт у клиентов`
          : "Удалить?"}
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => archiveAsset(file.id))}
        className="rounded px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400"
      >
        {pending ? "…" : "Удалить"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded px-2 py-1 text-xs text-muted transition hover:bg-border/60"
      >
        Отмена
      </button>
    </span>
  ) : (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="shrink-0 rounded px-2 py-1 text-xs text-muted transition hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
    >
      Удалить
    </button>
  );

  return (
    <li
      className={`flex flex-wrap items-center gap-3 rounded-xl border border-border px-3 py-2.5 ${
        file.archived ? "opacity-60" : "bg-surface"
      }`}
    >
      <span className="shrink-0 rounded-md bg-border/70 px-2 py-0.5 text-xs font-medium">
        PDF
      </span>

      <span className="min-w-40 flex-1 truncate font-medium">
        {file.title}
      </span>

      {file.owner ? <OwnerBadge id={file.owner.id} label={file.owner.label} /> : null}

      <span className="hidden shrink-0 text-xs text-muted sm:inline">
        {file.created}
      </span>
      <span className="hidden shrink-0 text-sm text-muted sm:inline">
        {file.meta}
      </span>
      <span className="shrink-0 text-xs text-muted">
        {file.hubCount > 0
          ? `в ${withPlural(file.hubCount, WORDS.hubIn)}`
          : "не в хабах"}
      </span>

      {file.quoteId ? (
        <Link
          href={`/calculator/${file.quoteId}`}
          className="shrink-0 rounded px-2 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-500/10 dark:text-blue-400"
        >
          Открыть расчёт
        </Link>
      ) : null}

      <a
        href={`/api/assets/${file.id}/file`}
        className="shrink-0 rounded px-2 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-500/10 dark:text-blue-400"
      >
        Скачать
      </a>

      {actionCluster}
    </li>
  );
}
