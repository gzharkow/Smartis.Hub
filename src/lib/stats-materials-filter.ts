// Какие материалы исключены из «Общей статистики». Как и view-mode.ts/
// stats-sort.ts: имя cookie и разбор нужны и серверу (отфильтровать список
// перед подсчётом), и браузеру (пикер материалов). Храним ИСКЛЮЧЁННЫЕ id,
// а не включённые — так пустая cookie значит «показаны все» без того,
// чтобы знать весь набор id заранее (новый материал по умолчанию виден).

export const STATS_MATERIALS_COOKIE = "sf_stats_materials_excluded";
export const STATS_MATERIALS_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

export function parseExcludedAssetIds(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function serializeExcludedAssetIds(ids: string[]): string {
  return encodeURIComponent(JSON.stringify(ids));
}
