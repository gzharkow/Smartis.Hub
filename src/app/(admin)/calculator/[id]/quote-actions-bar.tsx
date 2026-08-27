"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { archiveQuote, duplicateQuote } from "@/app/actions/quotes";

export function QuoteActionsBar({
  quoteId,
  canEdit = true,
  spec,
}: {
  quoteId: string;
  /** Право «Изменение» на «Генератор КП» — «Скачать PDF» остаётся всегда, это чтение. */
  canEdit?: boolean;
  /** Доступность Спецификации считается на сервере: она зависит от шаблона на
   * диске, коробки в расчёте и ставки НДС. Причина отказа показывается
   * подсказкой, а не молчанием — иначе неактивная кнопка выглядит поломкой. */
  spec?: { ok: true } | { ok: false; reason: string };
}) {
  const router = useRouter();
  const [duplicating, startDuplicate] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [deleting, startDelete] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={`/api/quotes/${quoteId}/pdf`}
        className="rounded-lg border border-border px-3 py-1.5 text-sm transition hover:bg-border/60"
      >
        Скачать PDF
      </a>

      {spec?.ok ? (
        <Link
          href={`/calculator/${quoteId}/spec`}
          className="rounded-lg border border-border px-3 py-1.5 text-sm transition hover:bg-border/60"
        >
          Спецификация
        </Link>
      ) : spec ? (
        <span
          title={spec.reason}
          className="cursor-default rounded-lg border border-dashed border-border px-3 py-1.5 text-sm text-muted"
        >
          Спецификация
        </span>
      ) : null}

      {canEdit ? (
        <>
          <button
            type="button"
            disabled={duplicating}
            onClick={() => startDuplicate(() => duplicateQuote(quoteId))}
            title="Создать копию со всеми секциями и строками"
            className="rounded-lg border border-border px-3 py-1.5 text-sm transition hover:bg-border/60 disabled:opacity-50"
          >
            {duplicating ? "Копируем…" : "Сделать копию"}
          </button>

          {confirming ? (
            <span className="flex items-center gap-2">
              <span className="text-xs text-muted">Удалить расчёт?</span>
              <button
                type="button"
                disabled={deleting}
                onClick={() =>
                  startDelete(async () => {
                    await archiveQuote(quoteId);
                    router.push("/calculator");
                  })
                }
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400"
              >
                {deleting ? "…" : "Удалить"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-lg px-3 py-1.5 text-sm text-muted transition hover:bg-border/60"
              >
                Отмена
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="rounded-lg px-3 py-1.5 text-sm text-muted transition hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
            >
              Удалить
            </button>
          )}
        </>
      ) : null}
    </div>
  );
}
