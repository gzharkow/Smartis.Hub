import { calculateQuote } from "@/lib/quote-calc";
import { FreeformQuoteEditor } from "./freeform-quote-editor";
import { CalculatorQuoteEditor } from "./calculator-quote-editor";
import { ClientTypeControl } from "./client-type-control";
import { QuoteTotalsSummary } from "./quote-totals-summary";
import { QuotePreview } from "./quote-preview";
import type { QuoteData } from "./quote-types";

export type { QuoteLineData, QuoteSectionData, QuoteData } from "./quote-types";

// Диспетчер: без выбранного типа клиента — сегодняшний свободный редактор
// (плюс приглашение включить калькулятор сверху), с выбранным — редактор
// на основе конфига. key={clientType} на CalculatorQuoteEditor — намеренно:
// при смене типа клиента (см. ClientTypeControl → setQuoteClientType) новый
// clientType меняет key и React монтирует чистый инстанс редактора вместо
// частичного обновления, так что локальный стейт формы гарантированно не
// «доживает» старый тип клиента.
export function QuoteEditor({
  quote,
  canEdit = true,
}: {
  quote: QuoteData;
  /** Право «Изменение» на «Генератор КП» — см. calculator/[id]/page.tsx. */
  canEdit?: boolean;
}) {
  // Без права редактирования — ни один интерактивный узел (формы, кнопки
  // ±секция/±строка, конфиг-панели калькулятора) не рендерится вовсе:
  // только итоги и тот же живой предпросмотр документа, который и так есть
  // у обоих редакторов, но здесь — от сохранённых данных, а не от набора.
  if (!canEdit) {
    const totals = calculateQuote(quote.sections, quote.vatRatePct, {
      boxIntegrationSelected: quote.boxIntegrationSelected,
    });
    return (
      <div className="grid grid-cols-1 gap-6">
        <QuoteTotalsSummary totals={totals} showImplementationNote={false} />
        <QuotePreview
          clientName={quote.clientName}
          vatRatePct={quote.vatRatePct}
          documentDate={quote.documentDate}
          sections={quote.sections}
          boxIntegrationSelected={quote.boxIntegrationSelected}
        />
      </div>
    );
  }

  if (quote.clientType) {
    return (
      <CalculatorQuoteEditor
        key={quote.clientType}
        quote={quote}
        clientType={quote.clientType}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <ClientTypeControl quoteId={quote.id} currentType={null} />

      {/* Ручной ввод — на виду только пока продавец не выбрал тип клиента
          выше; свёрнут по умолчанию, чтобы калькулятор с галочками не
          соседствовал визуально со свободными полями цены. */}
      <details className="rounded-xl border border-border bg-surface">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">
          Кастомный расчет вручную
        </summary>
        <div className="border-t border-border p-4">
          <FreeformQuoteEditor quote={quote} />
        </div>
      </details>
    </div>
  );
}
