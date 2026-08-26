// Сортировка списка статистики. Устроено как lib/hub-sort.ts: тип и разбор
// нужны и серверу (компаратор для готовых строк), и браузеру (панель
// выбора). Выбор запоминаем в cookie, как сортировку хабов/КП.
//
// В отличие от hub-sort.ts, orderBy-функции для Prisma здесь нет: visits/
// totalMs/lastSeenAt считаются в hubStats() уже после выборки, а не хранятся
// колонками — сортировка целиком в JS на странице (см. stats/page.tsx).

export const STATS_SORT_COOKIE = "sf_stats_sort";
export const STATS_SORT_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

export type StatsSortField = "lastSeen" | "visits" | "duration" | "title";
export type StatsSortDir = "asc" | "desc";
export type StatsSort = { field: StatsSortField; dir: StatsSortDir };

export const STATS_SORT_FIELDS: { value: StatsSortField; label: string }[] = [
  { value: "lastSeen", label: "Последнему визиту" },
  { value: "visits", label: "Числу визитов" },
  { value: "duration", label: "Времени просмотра" },
  { value: "title", label: "Названию" },
];

export const DEFAULT_STATS_SORT: StatsSort = { field: "lastSeen", dir: "desc" };

const FIELDS = new Set<StatsSortField>(["lastSeen", "visits", "duration", "title"]);

/** Разбор значения cookie вида «visits-desc». Мусор → сортировка по умолчанию. */
export function parseStatsSort(raw: string | undefined): StatsSort {
  const [field, dir] = (raw ?? "").split("-");
  if (!FIELDS.has(field as StatsSortField)) return DEFAULT_STATS_SORT;
  return {
    field: field as StatsSortField,
    dir: dir === "asc" ? "asc" : "desc",
  };
}

export function serializeStatsSort(sort: StatsSort): string {
  return `${sort.field}-${sort.dir}`;
}
