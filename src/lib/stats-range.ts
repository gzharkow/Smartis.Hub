// Диапазон дат для страницы статистики хаба. Файл нарочно без "server-only":
// разбор параметров адреса нужен и на сервере (фильтр в базе), и в браузере
// (подпись на кнопке-календаре).

export type StatsRange = { from: Date; to: Date } | null;

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDateParam(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** «yyyy-mm-dd» из адреса → диапазон дат. Без обеих границ — весь период. */
export function parseStatsRange(params: {
  from?: string;
  to?: string;
}): StatsRange {
  const from = parseDateParam(params.from);
  const rawTo = parseDateParam(params.to);
  if (!from || !rawTo) return null;

  // «to» включительно — берём до конца дня, а не до его полуночи.
  const to = new Date(rawTo.getTime() + DAY_MS - 1);
  return from <= to ? { from, to } : { from: rawTo, to: new Date(from.getTime() + DAY_MS - 1) };
}

/** Дата в «yyyy-mm-dd» — для адреса и `<input type="date">`. */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const shortFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** «16.07.2026 – 30.07.2026» или «Весь период». */
export function formatStatsRange(range: StatsRange): string {
  if (!range) return "Весь период";
  return `${shortFmt.format(range.from)} – ${shortFmt.format(range.to)}`;
}
