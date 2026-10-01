// Фильтр списков (хабы, КП, файлы, спецификации). Файл без "use client"/
// "server-only": разбор нужен и серверу (условие запроса), и браузеру (панель).
// Выбор запоминаем в cookie, как сортировку (см. hub-sort.ts).

import { INDUSTRY_TO_CLIENT_TYPE, parseIndustry, type IndustryValue } from "./industry";

export const LIST_FILTER_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

export type ListFilterScope = "hubs" | "calculator" | "files" | "spec";
export type ListFilter = { industry: IndustryValue | null; creator: string | null };

export const EMPTY_LIST_FILTER: ListFilter = { industry: null, creator: null };

export function listFilterCookie(scope: ListFilterScope): string {
  return `sf_filter_${scope}`;
}

/** Cookie вида «AUTO|userId» (пустая часть = «все»). creator — только для ADMIN:
 * у MEMBER подделанное значение молча отбрасываем. */
export function parseListFilter(raw: string | undefined, isAdmin: boolean): ListFilter {
  const [industry, creator] = decodeURIComponent(raw ?? "").split("|");
  return {
    industry: parseIndustry(industry),
    creator: isAdmin && creator ? creator : null,
  };
}

export function serializeListFilter(f: ListFilter): string {
  return encodeURIComponent(`${f.industry ?? ""}|${f.creator ?? ""}`);
}

/** Условие для Prisma. У КП отрасль — тип клиента расчёта (для файлов и
 * спецификаций применяется к `quote`). Хаб относится к отрасли, если в нём
 * есть хотя бы один живой материал этой отрасли: из раздела библиотеки
 * «Авторынок»/«Недвижимость» или расчёт КП с подходящим типом клиента
 * (файлы КП лежат в «Общих», поэтому их отрасль берётся от КП). */
export function listFilterWhere(f: ListFilter, kind: "hub" | "quote") {
  return {
    ...(f.industry
      ? kind === "hub"
        ? {
            items: {
              some: {
                asset: {
                  archivedAt: null,
                  OR: [
                    { section: f.industry },
                    { quote: { clientType: INDUSTRY_TO_CLIENT_TYPE[f.industry] } },
                  ],
                },
              },
            },
          }
        : { clientType: INDUSTRY_TO_CLIENT_TYPE[f.industry] }
      : {}),
    ...(f.creator ? { ownerId: f.creator } : {}),
  };
}
