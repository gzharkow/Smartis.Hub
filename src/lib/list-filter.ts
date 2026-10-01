// Фильтр списков (хабы, КП, файлы, спецификации). Файл без "use client"/
// "server-only": разбор нужен и серверу (условие запроса), и браузеру (панель).
// Выбор запоминаем в cookie, как сортировку (см. hub-sort.ts).

import { parseIndustry, type IndustryValue } from "./industry";

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

/** Условие для Prisma. Для файлов/спецификаций применяется к `quote`. */
export function listFilterWhere(f: ListFilter) {
  return {
    ...(f.industry ? { industry: f.industry } : {}),
    ...(f.creator ? { ownerId: f.creator } : {}),
  };
}
