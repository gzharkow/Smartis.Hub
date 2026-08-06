// Сортировка списка хабов. Файл без "use client"/"server-only": типы и разбор
// нужны и серверу (собрать orderBy для запроса), и браузеру (панель выбора).
// Выбор запоминаем в cookie, как вид списка (см. view-mode.ts).

export const HUB_SORT_COOKIE = "sf_hub_sort";
export const HUB_SORT_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

export type HubSortField = "created" | "updated" | "title" | "items";
export type HubSortDir = "asc" | "desc";
export type HubSort = { field: HubSortField; dir: HubSortDir };

export const HUB_SORT_FIELDS: { value: HubSortField; label: string }[] = [
  { value: "created", label: "Дате создания" },
  { value: "updated", label: "Дате изменения" },
  { value: "title", label: "Названию" },
  { value: "items", label: "Объёму материалов" },
];

export const DEFAULT_HUB_SORT: HubSort = { field: "created", dir: "desc" };

const FIELDS = new Set<HubSortField>(["created", "updated", "title", "items"]);

/** Разбор значения cookie вида «created-desc». Мусор → сортировка по умолчанию. */
export function parseHubSort(raw: string | undefined): HubSort {
  const [field, dir] = (raw ?? "").split("-");
  if (!FIELDS.has(field as HubSortField)) return DEFAULT_HUB_SORT;
  return {
    field: field as HubSortField,
    dir: dir === "asc" ? "asc" : "desc",
  };
}

export function serializeHubSort(sort: HubSort): string {
  return `${sort.field}-${sort.dir}`;
}

/**
 * orderBy для Prisma под выбранную сортировку.
 *
 * «Объём материалов» — это число связей, поэтому сортируем по счётчику
 * relation'а (`items._count`), а не по полю. Prisma это умеет напрямую.
 */
export function hubOrderBy(sort: HubSort) {
  switch (sort.field) {
    case "title":
      return { title: sort.dir };
    case "updated":
      return { updatedAt: sort.dir };
    case "items":
      return { items: { _count: sort.dir } };
    default:
      return { createdAt: sort.dir };
  }
}
