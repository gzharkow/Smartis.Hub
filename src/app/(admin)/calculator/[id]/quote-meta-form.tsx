"use client";

import { useActionState, useRef, useState } from "react";
import { updateQuoteMeta, type UpdateQuoteMetaState } from "@/app/actions/quotes";
import { buttonClasses } from "@/components/ui/button";
import { LicenseConfirmationModal } from "./license-confirmation-modal";

const inputCls =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent";

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
  requireLicenseConfirmation = false,
}: {
  quoteId: string;
  clientName: string;
  setClientName: (value: string) => void;
  vatRatePct: number;
  setVatRatePct: (value: number) => void;
  documentDate: string;
  setDocumentDate: (value: string) => void;
  // Только для застройщика: перед фактическим сохранением просим ещё раз
  // сверить стоимость лицензии с регионом (Enterprise-лицензия для
  // Москва+МО/СПб+ЛО/топ-3 региона) — само правило нигде в базе не
  // хранится, это чисто напоминание продавцу. См. license-confirmation-modal.tsx.
  requireLicenseConfirmation?: boolean;
}) {
  const [metaState, metaAction, metaPending] = useActionState<
    UpdateQuoteMetaState,
    FormData
  >(updateQuoteMeta, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [showLicenseModal, setShowLicenseModal] = useState(false);

  function handleSaveClick() {
    // reportValidity() даёт ту же гарантию, что раньше давал нативный
    // type="submit": без неё клик по кнопке-обёртке молча проскакивал бы
    // мимо required-полей формы.
    if (!formRef.current?.reportValidity()) return;
    if (requireLicenseConfirmation) {
      setShowLicenseModal(true);
    } else {
      formRef.current.requestSubmit();
    }
  }

  return (
    // flex-wrap, а не жёсткая сетка колонок — на промежуточных ширинах
    // (когда полям не хватает места в один ряд, но ещё не сработал бы
    // следующий брейкпоинт) поля переносятся на новую строку вместо того,
    // чтобы вылезать за рамку карточки: у жёсткой grid-[1fr_140px_150px_auto]
    // фиксированные колонки не сжимались и обрезали кнопку «Сохранить».
    <form
      ref={formRef}
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
          type="button"
          onClick={handleSaveClick}
          disabled={metaPending}
          className={buttonClasses("primary")}
        >
          {metaPending ? "Сохраняем…" : "Сохранить"}
        </button>
        {metaState?.saved ? (
          <span className="text-sm text-ok">
            Сохранено
          </span>
        ) : null}
        {metaState?.error ? (
          <span role="alert" className="text-sm text-danger">
            {metaState.error}
          </span>
        ) : null}
      </div>

      {showLicenseModal ? (
        <LicenseConfirmationModal
          onConfirm={() => {
            setShowLicenseModal(false);
            formRef.current?.requestSubmit();
          }}
          onClose={() => setShowLicenseModal(false)}
        />
      ) : null}
    </form>
  );
}
