import type { QuoteCalculatorConfig } from "@/lib/quote-calculator";

// Общие типы данных КП — используются и свободным редактором, и
// калькулятором, и предпросмотром/строками секций. Вынесены отдельно от
// quote-editor.tsx, чтобы freeform-quote-editor.tsx и
// calculator-quote-editor.tsx могли импортировать их напрямую, без цикла
// через диспетчер.

export type QuoteLineData = {
  id: string;
  title: string;
  description: string | null;
  quantity: number;
  unitPrice: number | null;
  autoStorageLimit: boolean;
};

export type QuoteSectionData = {
  id: string;
  title: string;
  countsTowardImplementationPayment: boolean;
  lines: QuoteLineData[];
};

export type QuoteData = {
  id: string;
  clientName: string;
  vatRatePct: number;
  /** "YYYY-MM-DD" — формат <input type="date">. См. Quote.documentDate в схеме. */
  documentDate: string;
  /** null — свободный КП (ручное редактирование). Иначе — калькулятор. */
  clientType: "BUILDER" | "AUTO_DEALER" | null;
  /** Разобранный и провалидированный Quote.calculatorConfig; null, пока
   * clientType не выбран (или если сохранённый JSON вдруг не прошёл Zod —
   * см. parseCalculatorConfig). */
  calculatorConfig: QuoteCalculatorConfig | null;
  boxIntegrationSelected: boolean;
  sections: QuoteSectionData[];
};
