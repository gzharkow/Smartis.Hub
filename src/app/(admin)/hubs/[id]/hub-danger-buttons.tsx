"use client";

import { useState, useTransition } from "react";
import { archiveHub, restoreHub } from "@/app/actions/hubs";
import { plural, withPlural, WORDS } from "@/lib/plural";
import { buttonClasses } from "@/components/ui/button";

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
        className={buttonClasses("ghostDanger", "md")}
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
        className={buttonClasses("danger", "md")}
      >
        {pending ? "…" : "Удалить"}
      </button>

      <button
        type="button"
        onClick={() => setConfirming(false)}
        className={buttonClasses("ghost", "md")}
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
      className={buttonClasses("primary", "sm")}
    >
      {pending ? "…" : "Вернуть"}
    </button>
  );
}
