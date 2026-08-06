// Сортировка списка КП. Устроено как lib/hub-sort.ts: тип и разбор нужны и
// серверу (собрать orderBy для запроса), и браузеру (панель выбора). Выбор
// запоминаем в cookie, как сортировку хабов.

export const QUOTE_SORT_COOKIE = "sf_quote_sort";
export const QUOTE_SORT_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

export type QuoteSortField = "updated" | "created" | "client" | "amount";
export type QuoteSortDir = "asc" | "desc";
export type QuoteSort = { field: QuoteSortField; dir: QuoteSortDir };

export const QUOTE_SORT_FIELDS: { value: QuoteSortField; label: string }[] = [
  { value: "updated", label: "Дате изменения" },
  { value: "created", label: "Дате создания" },
  { value: "client", label: "Клиенту" },
  { value: "amount", label: "Сумме" },
];

export const DEFAULT_QUOTE_SORT: QuoteSort = { field: "updated", dir: "desc" };

const FIELDS = new Set<QuoteSortField>(["updated", "created", "client", "amount"]);

/** Разбор значения cookie вида «updated-desc». Мусор → сортировка по умолчанию. */
export function parseQuoteSort(raw: string | undefined): QuoteSort {
  const [field, dir] = (raw ?? "").split("-");
  if (!FIELDS.has(field as QuoteSortField)) return DEFAULT_QUOTE_SORT;
  return {
    field: field as QuoteSortField,
    dir: dir === "asc" ? "asc" : "desc",
  };
}

export function serializeQuoteSort(sort: QuoteSort): string {
  return `${sort.field}-${sort.dir}`;
}

/**
 * orderBy для Prisma под выбранную сортировку.
 *
 * «Сумма» — это не поле в базе, а результат calculateQuote (гоняет Decimal
 * по секциям и строкам уже после выборки), поэтому Prisma по ней сортировать
 * не умеет. Для этого поля возвращаем null — страница сортирует уже готовые
 * строки в JS.
 */
export function quoteOrderBy(sort: QuoteSort) {
  switch (sort.field) {
    case "created":
      return { createdAt: sort.dir };
    case "client":
      return { clientName: sort.dir };
    case "amount":
      return null;
    default:
      return { updatedAt: sort.dir };
  }
}
