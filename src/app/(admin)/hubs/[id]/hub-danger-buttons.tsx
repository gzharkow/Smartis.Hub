"use client";

import { useState, useTransition } from "react";
import { archiveHub, restoreHub } from "@/app/actions/hubs";
import { plural, withPlural, WORDS } from "@/lib/plural";

// Согласовывать с числом надо не только существительное, но и глагол:
// «1 ссылка перестанет», «2 ссылки перестанут».
const WILL_STOP: [string, string, string] = [
  "перестанет",
  "перестанут",
  "перестанут",
];

/**
 * Удаление хаба и возврат его обратно.
 *
 * Подтверждение показываем прямо в строке, а не окном браузера: окна
 * закрывают вслепую, а здесь видно, чем именно удаление обернётся.
 */
export function DeleteHubButton({
  hubId,
  liveLinks,
}: {
  hubId: string;
  /** Действующие ссылки у клиентов — они перестанут открываться. */
  liveLinks: number;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-lg px-3 py-1.5 text-sm text-muted transition hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
      >
        Удалить
      </button>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted">
        {liveLinks > 0
          ? `${withPlural(liveLinks, WORDS.link)} ${plural(liveLinks, WILL_STOP)} открываться`
          : "Удалить хаб?"}
      </span>

      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => archiveHub(hubId))}
        className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400"
      >
        {pending ? "…" : "Удалить"}
      </button>

      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded-lg px-3 py-1.5 text-sm text-muted transition hover:bg-border/60"
      >
        Отмена
      </button>
    </span>
  );
}

export function RestoreHubButton({ hubId }: { hubId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => restoreHub(hubId))}
      className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
    >
      {pending ? "…" : "Вернуть"}
    </button>
  );
}
