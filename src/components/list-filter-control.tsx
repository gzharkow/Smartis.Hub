"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { INDUSTRIES, INDUSTRY_LABELS, parseIndustry } from "@/lib/industry";
import {
  LIST_FILTER_COOKIE_MAX_AGE,
  listFilterCookie,
  serializeListFilter,
  type ListFilter,
  type ListFilterScope,
} from "@/lib/list-filter";

const selectCls =
  "rounded-lg border border-border bg-background px-2 py-1 text-sm pointer-coarse:min-h-11 disabled:opacity-50";

/**
 * Фильтр списка: отрасль (всем) и создатель (только ADMIN — creators передаётся
 * лишь ему). Пишет cookie и перерисовывает страницу с сервера, как HubSortControl.
 */
export function ListFilterControl({
  scope,
  filter,
  creators,
}: {
  scope: ListFilterScope;
  filter: ListFilter;
  creators?: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function apply(next: ListFilter) {
    document.cookie = `${listFilterCookie(scope)}=${serializeListFilter(next)}; path=/; max-age=${LIST_FILTER_COOKIE_MAX_AGE}; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5 text-sm">
      <select
        value={filter.industry ?? ""}
        disabled={pending}
        aria-label="Отрасль"
        onChange={(e) => apply({ ...filter, industry: parseIndustry(e.target.value) })}
        className={selectCls}
      >
        <option value="">Все отрасли</option>
        {INDUSTRIES.map((i) => (
          <option key={i} value={i}>
            {INDUSTRY_LABELS[i]}
          </option>
        ))}
      </select>

      {creators ? (
        <select
          value={filter.creator ?? ""}
          disabled={pending}
          aria-label="Создатель"
          onChange={(e) => apply({ ...filter, creator: e.target.value || null })}
          className={selectCls}
        >
          <option value="">Все создатели</option>
          {creators.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
