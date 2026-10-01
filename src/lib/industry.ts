// Отрасли клиентов. Файл без "server-only": подписи нужны и серверу, и браузеру.

export const INDUSTRIES = ["AUTO", "REALTY"] as const;
export type IndustryValue = (typeof INDUSTRIES)[number];

export const INDUSTRY_LABELS: Record<IndustryValue, string> = {
  AUTO: "Авторынок",
  REALTY: "Недвижимость",
};

export function parseIndustry(raw: unknown): IndustryValue | null {
  return INDUSTRIES.includes(raw as IndustryValue) ? (raw as IndustryValue) : null;
}
