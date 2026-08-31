"use client";

import { useTransition } from "react";
import { setHubStatus } from "@/app/actions/hubs";

export function PublishToggle({
  hubId,
  published,
  itemCount,
}: {
  hubId: string;
  published: boolean;
  itemCount: number;
}) {
  const [pending, startTransition] = useTransition();

  // Публиковать пустой хаб бессмысленно: клиент откроет ссылку и увидит
  // пустоту. Ловим это здесь, а не показываем клиенту.
  const blocked = !published && itemCount === 0;

  return (
    <span className="flex items-center gap-3">
      {blocked ? (
        <span className="text-xs text-muted">Добавьте материалы</span>
      ) : null}

      <button
        type="button"
        disabled={pending || blocked}
        onClick={() => startTransition(() => setHubStatus(hubId, !published))}
        className={
          published
            ? "rounded-lg border border-border px-3 py-1.5 text-sm transition hover:bg-border/60 disabled:opacity-50"
            : "rounded-lg bg-ok-fill px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
        }
      >
        {pending
          ? "…"
          : published
            ? "Снять с публикации"
            : "Опубликовать"}
      </button>
    </span>
  );
}
