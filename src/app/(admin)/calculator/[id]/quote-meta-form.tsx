"use client";

import { useActionState } from "react";
import { updateQuoteMeta, type UpdateQuoteMetaState } from "@/app/actions/quotes";

const inputCls =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-blue-500";

// Шапка КП (клиент/НДС/дата) — общая для свободного редактора и калькулятора,
// вынесена из quote-editor.tsx без изменения логики. Значения — контролируемые
// пропсами (родитель держит их в состоянии, т.к. они же нужны для живого
// предпросмотра справа), сама форма отвечает только за useActionState и разметку.
export function QuoteMetaForm({
  quoteId,
  clientName,
  setClientName,
  vatRatePct,
  setVatRatePct,
  documentDate,
  setDocumentDate,
}: {
  quoteId: string;
  clientName: string;
  setClientName: (value: string) => void;
  vatRatePct: number;
  setVatRatePct: (value: number) => void;
  documentDate: string;
  setDocumentDate: (value: string) => void;
}) {
  const [metaState, metaAction, metaPending] = useActionState<
    UpdateQuoteMetaState,
    FormData
  >(updateQuoteMeta, undefined);

  return (
    // flex-wrap, а не жёсткая сетка колонок — на промежуточных ширинах
    // (когда полям не хватает места в один ряд, но ещё не сработал бы
    // следующий брейкпоинт) поля переносятся на новую строку вместо того,
    // чтобы вылезать за рамку карточки: у жёсткой grid-[1fr_140px_150px_auto]
    // фиксированные колонки не сжимались и обрезали кнопку «Сохранить».
    <form
      action={metaAction}
      className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4"
    >
      <input type="hidden" name="quoteId" value={quoteId} />

      <label className="grid min-w-[200px] flex-1 gap-1">
        <span className="text-xs font-medium text-muted">Клиент</span>
        <input
          name="clientName"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          maxLength={160}
          required
          className={inputCls}
        />
      </label>

      <label className="grid w-[140px] shrink-0 gap-1">
        <span className="text-xs font-medium text-muted">Ставка НДС, %</span>
        <input
          name="vatRatePct"
          type="number"
          min={0}
          max={100}
          step="0.1"
          value={vatRatePct}
          onChange={(e) => setVatRatePct(Number(e.target.value) || 0)}
          className={inputCls}
        />
      </label>

      <label className="grid w-[160px] shrink-0 gap-1">
        <span className="text-xs font-medium text-muted">Дата в документе</span>
        <input
          name="documentDate"
          type="date"
          value={documentDate}
          onChange={(e) => setDocumentDate(e.target.value)}
          required
          className={inputCls}
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={metaPending}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          {metaPending ? "Сохраняем…" : "Сохранить"}
        </button>
        {metaState?.saved ? (
          <span className="text-sm text-green-600 dark:text-green-400">
            Сохранено
          </span>
        ) : null}
        {metaState?.error ? (
          <span role="alert" className="text-sm text-red-600 dark:text-red-400">
            {metaState.error}
          </span>
        ) : null}
      </div>
    </form>
  );
}
