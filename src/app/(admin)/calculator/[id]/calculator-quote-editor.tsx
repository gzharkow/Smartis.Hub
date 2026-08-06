"use client";

import { useState, useTransition } from "react";
import { calculateQuote } from "@/lib/quote-calc";
import {
  deriveQuoteDocument,
  DEFAULT_BUILDER_CONFIG,
  DEFAULT_AUTO_DEALER_CONFIG,
  type QuoteCalculatorConfig,
} from "@/lib/quote-calculator";
import { updateQuoteCalculatorConfig } from "@/app/actions/quote-calculator";
import { QuoteMetaForm } from "./quote-meta-form";
import { QuoteTotalsSummary } from "./quote-totals-summary";
import { QuotePreview } from "./quote-preview";
import { ClientTypeControl } from "./client-type-control";
import { BuilderConfigPanel } from "./builder-config-panel";
import { AutoDealerConfigPanel } from "./auto-dealer-config-panel";
import type { QuoteData, QuoteSectionData } from "./quote-types";

// Редактор для КП с выбранным типом клиента — вместо ручного ввода цен
// продавец отмечает галочки и вводит количества, а секции/строки документа
// выводятся из конфига чистой функцией deriveQuoteDocument (та же, что
// использует и сервер при сохранении — см. src/lib/quote-calculator.ts).
// Смонтирован дispatcher'ом (quote-editor.tsx) с key={quote.clientType},
// поэтому смена типа клиента (ClientTypeControl → setQuoteClientType) даёт
// этому компоненту полностью новый инстанс с чистым состоянием — сброс
// конфига виден мгновенно, без ручной синхронизации стейта.
export function CalculatorQuoteEditor({
  quote,
  clientType,
}: {
  quote: QuoteData;
  clientType: "BUILDER" | "AUTO_DEALER";
}) {
  const [clientName, setClientName] = useState(quote.clientName);
  const [vatRatePct, setVatRatePct] = useState(quote.vatRatePct);
  const [documentDate, setDocumentDate] = useState(quote.documentDate);

  const initialConfig: QuoteCalculatorConfig =
    quote.calculatorConfig ??
    (clientType === "BUILDER" ? DEFAULT_BUILDER_CONFIG : DEFAULT_AUTO_DEALER_CONFIG);
  const [config, setConfig] = useState(initialConfig);
  const [, startSave] = useTransition();

  function commit(next: QuoteCalculatorConfig) {
    setConfig(next);
    startSave(() => updateQuoteCalculatorConfig(quote.id, next));
  }

  const derived = deriveQuoteDocument(config);
  // Строки калькулятора ещё не сохранены как QuoteLine — синтетические id
  // нужны только для React key/для сигнатуры calculateQuote, реальных строк
  // в базе на момент рендера предпросмотра может не быть (сохранение — по
  // отдельному запросу, см. commit выше).
  const previewSections: QuoteSectionData[] = derived.sections.map((section, si) => ({
    id: `s${si}`,
    title: section.title,
    countsTowardImplementationPayment: section.countsTowardImplementationPayment,
    lines: section.lines.map((l, li) => ({ id: `s${si}l${li}`, ...l })),
  }));

  const totals = calculateQuote(previewSections, vatRatePct, {
    boxIntegrationSelected: derived.boxIntegrationSelected,
  });

  return (
    <div className="grid grid-cols-1 gap-6">
      <QuoteMetaForm
        quoteId={quote.id}
        clientName={clientName}
        setClientName={setClientName}
        vatRatePct={vatRatePct}
        setVatRatePct={setVatRatePct}
        documentDate={documentDate}
        setDocumentDate={setDocumentDate}
      />

      <ClientTypeControl quoteId={quote.id} currentType={clientType} />

      {config.clientType === "BUILDER" ? (
        <BuilderConfigPanel config={config} onChange={commit} />
      ) : (
        <AutoDealerConfigPanel config={config} onChange={commit} />
      )}

      <QuoteTotalsSummary totals={totals} showImplementationNote={false} />

      <details open className="rounded-xl border border-border bg-surface">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">
          Предпросмотр документа — обновляется по мере ввода
        </summary>
        <div className="border-t border-border p-4">
          <QuotePreview
            clientName={clientName}
            vatRatePct={vatRatePct}
            documentDate={documentDate}
            sections={previewSections}
            boxIntegrationSelected={derived.boxIntegrationSelected}
          />
        </div>
      </details>
    </div>
  );
}
