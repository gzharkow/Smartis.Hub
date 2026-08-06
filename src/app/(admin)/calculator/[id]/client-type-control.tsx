"use client";

import { useState, useTransition } from "react";
import { setQuoteClientType } from "@/app/actions/quote-calculator";

const LABELS = { BUILDER: "Застройщик", AUTO_DEALER: "Автодилер" } as const;

/**
 * Выбор/смена типа клиента. Без выбранного типа — приглашение включить
 * калькулятор («Застройщик»/«Автодилер»); с выбранным — компактный
 * переключатель на другой тип. Оба случая зовут один и тот же
 * setQuoteClientType, который полностью пересобирает секции/строки из
 * дефолтного конфига нового типа — поэтому и то, и другое требует
 * подтверждения (тот же confirm-then-commit приём, что и у удаления
 * секции/КП).
 */
export function ClientTypeControl({
  quoteId,
  currentType,
}: {
  quoteId: string;
  currentType: "BUILDER" | "AUTO_DEALER" | null;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmType, setConfirmType] = useState<"BUILDER" | "AUTO_DEALER" | null>(null);

  function commit() {
    if (!confirmType) return;
    const type = confirmType;
    startTransition(() => setQuoteClientType(quoteId, type));
    setConfirmType(null);
  }

  if (confirmType) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
        <span>
          {currentType
            ? `Сменить тип клиента на «${LABELS[confirmType]}»? Все выбранные параметры калькулятора сбросятся.`
            : `Включить калькулятор «${LABELS[confirmType]}»? Текущие секции и строки будут заменены.`}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={commit}
            className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-700 disabled:opacity-50"
          >
            {pending ? "Применяем…" : "Подтвердить"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmType(null)}
            className="rounded-lg px-3 py-1.5 text-xs text-muted transition hover:bg-border/60"
          >
            Отмена
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
      <span className="text-sm text-muted">
        {currentType
          ? "Тип клиента:"
          : "Использовать калькулятор вместо ручного редактирования:"}
      </span>
      <div className="flex items-center gap-2">
        {(["BUILDER", "AUTO_DEALER"] as const).map((type) => (
          <button
            key={type}
            type="button"
            disabled={pending || type === currentType}
            onClick={() => setConfirmType(type)}
            className={
              type === currentType
                ? "rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-100"
                : "rounded-lg border border-border px-3 py-1.5 text-sm transition hover:bg-border/60 disabled:opacity-50"
            }
          >
            {LABELS[type]}
          </button>
        ))}
      </div>
    </div>
  );
}
