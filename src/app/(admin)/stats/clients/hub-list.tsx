"use client";

import { useState } from "react";
import Link from "next/link";
import { plural, withPlural, WORDS } from "@/lib/plural";
import { VIEW_GRID_CLASS, VIEW_LIST_CLASS } from "@/lib/view-mode";

// Строки уже отформатированы на сервере (formatDuration/formatWhen живут
// в lib/stats.ts, а тот помечен "server-only" — тянуть его в клиентский
// компонент нельзя даже ради двух чистых функций форматирования).
export type ClientHubRow = {
  hubId: string;
  title: string;
  isDraft: boolean;
  itemsCount: number;
  linksCount: number;
  visits: number;
  durationLabel: string;
  lastSeenLabel: string;
};

/**
 * Список хабов вкладки «Статистика по клиентам» — вынесен в клиентский
 * компонент только ради строки поиска: сортировка и сами данные по-прежнему
 * считаются на сервере (rows уже в нужном порядке), поиск — просто фильтр
 * по тому, что и так уже загружено, без похода на сервер.
 */
export function ClientHubList({ rows, grid }: { rows: ClientHubRow[]; grid: boolean }) {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? rows.filter((r) => r.title.toLowerCase().includes(query.trim().toLowerCase()))
    : rows;

  return (
    <div>
      <div className="mb-4">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Найти хаб по названию…"
          className="w-full max-w-sm rounded-lg border border-border bg-background px-3 py-1.5 text-sm placeholder:text-muted"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted">
          Ничего не нашлось по запросу «{query}».
        </p>
      ) : (
        <ul className={grid ? VIEW_GRID_CLASS : VIEW_LIST_CLASS}>
          {filtered.map((row) => (
            <li key={row.hubId}>
              <Link
                href={`/stats/clients/${row.hubId}`}
                className={`rounded-xl border border-border bg-surface px-4 py-3 transition hover:border-muted grid gap-2 ${
                  grid
                    ? "sm:flex sm:h-[176px] sm:flex-col"
                    : "sm:grid-cols-[1fr_auto] sm:items-center"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{row.title}</p>
                  <p className="mt-0.5 text-sm text-muted">
                    {withPlural(row.itemsCount, WORDS.material)} ·{" "}
                    {withPlural(row.linksCount, WORDS.link)}
                    {row.isDraft ? " · черновик" : ""}
                  </p>
                </div>

                {row.visits === 0 ? (
                  <span
                    className={`text-sm text-muted ${grid ? "sm:mt-auto sm:pt-1" : ""}`}
                  >
                    не открывали
                  </span>
                ) : (
                  <div
                    className={`flex items-center gap-4 text-sm ${
                      grid
                        ? "sm:mt-auto sm:flex-wrap sm:pt-1"
                        : "justify-between shrink-0 sm:justify-end"
                    }`}
                  >
                    <span className="flex items-center gap-4">
                      <span>
                        <b className="font-semibold">{row.visits}</b>
                        <span className="text-muted"> {plural(row.visits, WORDS.visit)}</span>
                      </span>
                      <span title="Суммарное время просмотра">
                        <b className="font-semibold">{row.durationLabel}</b>
                      </span>
                    </span>
                    <span className={grid ? "text-muted" : "w-24 text-right text-muted"}>
                      {row.lastSeenLabel}
                    </span>
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
