"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { archiveAsset, deleteAssetPermanently, restoreAsset } from "@/app/actions/assets";
import { withPlural, WORDS } from "@/lib/plural";
import { OwnerBadge } from "@/components/owner-badge";
import { buttonClasses } from "@/components/ui/button";

export type QuoteFileRowData = {
  id: string;
  /** Что за файл: «PDF» у коммерческого предложения, «DOCX» у Спецификации.
   * Раньше бейдж был захардкожен — до Спецификации других файлов тут и не
   * бывало. */
  kindLabel: string;
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
  const [purgeConfirming, setPurgeConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const actionCluster = !canEdit ? null : file.archived ? (
    purgeConfirming ? (
      <span className="flex shrink-0 items-center gap-2">
        <span className="text-xs text-danger">
          {file.hubCount > 0
            ? `Стоит в ${withPlural(file.hubCount, WORDS.hubIn)} — исчезнет и оттуда. Вернуть будет нельзя`
            : "Вернуть будет нельзя"}
        </span>
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => deleteAssetPermanently(file.id))}
          className={buttonClasses("danger", "sm")}
        >
          {pending ? "…" : "Удалить навсегда"}
        </button>
        <button
          type="button"
          onClick={() => setPurgeConfirming(false)}
          className={buttonClasses("ghost", "sm")}
        >
          Отмена
        </button>
      </span>
    ) : (
      <span className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => restoreAsset(file.id))}
          className={buttonClasses("link", "sm", "shrink-0")}
        >
          {pending ? "…" : "Восстановить"}
        </button>
        <button
          type="button"
          onClick={() => setPurgeConfirming(true)}
          className={buttonClasses("ghostDanger", "sm", "shrink-0")}
        >
          Удалить навсегда
        </button>
      </span>
    )
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
        className={buttonClasses("danger", "sm")}
      >
        {pending ? "…" : "Удалить"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className={buttonClasses("ghost", "sm")}
      >
        Отмена
      </button>
    </span>
  ) : (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className={buttonClasses("ghostDanger", "sm", "shrink-0")}
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
        {file.kindLabel}
      </span>

      {file.quoteId ? (
        <Link
          href={`/calculator/${file.quoteId}`}
          className="min-w-40 flex-1 truncate font-medium transition hover:text-accent"
        >
          {file.title}
        </Link>
      ) : (
        <span className="min-w-40 flex-1 truncate font-medium">
          {file.title}
        </span>
      )}

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

      <a
        href={`/api/assets/${file.id}/file`}
        className={buttonClasses("link", "sm", "shrink-0")}
      >
        Скачать
      </a>

      {actionCluster}
    </li>
  );
}
