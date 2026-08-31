"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { archiveQuote, duplicateQuote } from "@/app/actions/quotes";
import { buttonClasses } from "@/components/ui/button";

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
        className={buttonClasses("secondary", "md")}
      >
        Скачать PDF
      </a>

      {spec?.ok ? (
        <Link
          href={`/calculator/${quoteId}/spec`}
          className={buttonClasses("secondary", "md")}
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
            className={buttonClasses("secondary", "md")}
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
                className={buttonClasses("danger", "md")}
              >
                {deleting ? "…" : "Удалить"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className={buttonClasses("ghost", "md")}
              >
                Отмена
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className={buttonClasses("ghostDanger", "md")}
            >
              Удалить
            </button>
          )}
        </>
      ) : null}
    </div>
  );
}
