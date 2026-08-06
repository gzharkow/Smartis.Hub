"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  HUB_SORT_COOKIE,
  HUB_SORT_COOKIE_MAX_AGE,
  HUB_SORT_FIELDS,
  serializeHubSort,
  type HubSort,
  type HubSortDir,
  type HubSortField,
} from "@/lib/hub-sort";

/** Запоминаем выбор. Вне компонента — записью в cookie React не ведает. */
function remember(sort: HubSort) {
  document.cookie = `${HUB_SORT_COOKIE}=${serializeHubSort(sort)}; path=/; max-age=${HUB_SORT_COOKIE_MAX_AGE}; samesite=lax`;
}

function ArrowIcon({ dir }: { dir: HubSortDir }) {
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
 * Панель сортировки хабов: чем сортировать + направление.
 *
 * Как и переключатель вида, пишет cookie и перерисовывает страницу с сервера
 * — сама сортировка делается в запросе к базе, а не в браузере.
 */
export function HubSortControl({ sort }: { sort: HubSort }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function apply(next: HubSort) {
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
          apply({ ...sort, field: e.target.value as HubSortField })
        }
        className="rounded-lg border border-border bg-background px-2 py-1 text-sm disabled:opacity-50"
      >
        {HUB_SORT_FIELDS.map((f) => (
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
        className="grid size-7 shrink-0 place-items-center rounded-lg border border-border text-muted transition hover:text-foreground disabled:opacity-50"
      >
        <ArrowIcon dir={sort.dir} />
      </button>
    </div>
  );
}
