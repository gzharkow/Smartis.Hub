// Отрасли клиентов. Файл без "server-only": подписи нужны и серверу, и браузеру.

export const INDUSTRIES = ["AUTO", "REALTY"] as const;
export type IndustryValue = (typeof INDUSTRIES)[number];

export const INDUSTRY_LABELS: Record<IndustryValue, string> = {
  AUTO: "Авторынок",
  REALTY: "Недвижимость",
};

// Отрасль КП не хранится: она определяется типом клиента расчёта
// (Quote.clientType) — автодилер = Авторынок, застройщик = Недвижимость.
export const INDUSTRY_TO_CLIENT_TYPE = {
  AUTO: "AUTO_DEALER",
  REALTY: "BUILDER",
} as const satisfies Record<IndustryValue, string>;

export function parseIndustry(raw: unknown): IndustryValue | null {
  return INDUSTRIES.includes(raw as IndustryValue) ? (raw as IndustryValue) : null;
}
