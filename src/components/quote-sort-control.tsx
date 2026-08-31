"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  QUOTE_SORT_COOKIE,
  QUOTE_SORT_COOKIE_MAX_AGE,
  QUOTE_SORT_FIELDS,
  serializeQuoteSort,
  type QuoteSort,
  type QuoteSortDir,
  type QuoteSortField,
} from "@/lib/quote-sort";

/** Запоминаем выбор. Вне компонента — записью в cookie React не ведает. */
function remember(sort: QuoteSort) {
  document.cookie = `${QUOTE_SORT_COOKIE}=${serializeQuoteSort(sort)}; path=/; max-age=${QUOTE_SORT_COOKIE_MAX_AGE}; samesite=lax`;
}

function ArrowIcon({ dir }: { dir: QuoteSortDir }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      // Стрелка вверх = по возрастанию; для убывания переворачиваем.
      className={`size-4 transition-transform ${dir === "desc" ? "rotate-180" : ""}`}
    >
      <path d="M12 5v14" />
      <path d="m6 11 6-6 6 6" />
    </svg>
  );
}

/**
 * Панель сортировки КП: чем сортировать + направление.
 *
 * Как и HubSortControl, пишет cookie и перерисовывает страницу с сервера.
 */
export function QuoteSortControl({ sort }: { sort: QuoteSort }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function apply(next: QuoteSort) {
    remember(next);
    startTransition(() => router.refresh());
  }

  const dirLabel = sort.dir === "asc" ? "По возрастанию" : "По убыванию";

  return (
    <div className="flex shrink-0 items-center gap-1.5 text-sm">
      <span className="hidden text-muted sm:inline">Сортировать по</span>
      <select
        value={sort.field}
        disabled={pending}
        aria-label="Сортировать по"
        onChange={(e) =>
          apply({ ...sort, field: e.target.value as QuoteSortField })
        }
        className="rounded-lg border border-border bg-background px-2 py-1 text-sm pointer-coarse:min-h-11 disabled:opacity-50"
      >
        {QUOTE_SORT_FIELDS.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        disabled={pending}
        onClick={() =>
          apply({ ...sort, dir: sort.dir === "asc" ? "desc" : "asc" })
        }
        title={dirLabel}
        aria-label={dirLabel}
        className="grid size-7 pointer-coarse:size-11 shrink-0 place-items-center rounded-lg border border-border text-muted transition duration-100 hover:text-foreground active:scale-[0.92] disabled:opacity-50"
      >
        <ArrowIcon dir={sort.dir} />
      </button>
    </div>
  );
}
