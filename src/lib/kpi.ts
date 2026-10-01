// Чистая логика раздела «KPI план/факт»: недели месяца, проценты, статусы.
// Без "server-only" — используется и в Server, и в Client Components.
//
// Все даты здесь — календарные (год/месяц/день без времени и пояса): неделя
// «05.10 – 09.10» одна и та же в любом часовом поясе, поэтому считаем в UTC
// и показываем строкой, а не через Date → локальное время.

export type KpiMetricKey = "MEETINGS" | "QUALIFIED" | "DEALS";

/** Названия показателей по умолчанию; организация может переименовать. */
export const DEFAULT_METRIC_LABELS: Record<KpiMetricKey, string> = {
  MEETINGS: "Встречи / демо",
  QUALIFIED: "Квалифицировано",
  DEALS: "Сделки",
};

/** Месячный план менеджера по развитию — фиксированный, не зависит от числа
 * недель в месяце: 8 демо/встреч и 3 квалификации. */
export const MONTH_PLAN_MEETINGS = 8;
export const MONTH_PLAN_QUALIFIED = 3;

/** Планы по умолчанию у менеджера по развитию (пока в ячейке нет записи):
 * на неделю 2 встречи и 1 квалификация, на месяц 1 сделка. У ассистента
 * ничего не предзаполняется. Сохранённое значение (в т. ч. 0 и прочерк)
 * всегда важнее. */
export const DEFAULT_WEEK_PLAN = { MEETINGS: 2, QUALIFIED: 1 } as const;
export const DEFAULT_DEALS_PLAN = 1;

export function defaultPlan(
  role: "DEVELOPMENT" | "ASSISTANT",
  metric: "MEETINGS" | "QUALIFIED" | "DEALS",
  scope: "WEEK" | "MONTH",
): number {
  if (role === "ASSISTANT") return 0;
  if (scope === "MONTH") return metric === "DEALS" ? DEFAULT_DEALS_PLAN : 0;
  if (metric === "MEETINGS") return DEFAULT_WEEK_PLAN.MEETINGS;
  if (metric === "QUALIFIED") return DEFAULT_WEEK_PLAN.QUALIFIED;
  return 0;
}

/** План ячейки: сохранённый или, если записи нет, значение по умолчанию. */
export function effectivePlan(
  entry: { plan: number | null } | undefined,
  role: "DEVELOPMENT" | "ASSISTANT",
  metric: "MEETINGS" | "QUALIFIED" | "DEALS",
  scope: "WEEK" | "MONTH",
): number | null {
  return entry ? entry.plan : defaultPlan(role, metric, scope);
}

export type KpiRole = "DEVELOPMENT" | "ASSISTANT";

export const ROLE_LABEL: Record<KpiRole, string> = {
  DEVELOPMENT: "Менеджер по развитию",
  ASSISTANT: "Менеджер-ассистент",
};

/** Какие показатели ведёт должность: у ассистента — только встречи. */
export function metricsFor(role: KpiRole): ("MEETINGS" | "QUALIFIED")[] {
  return role === "ASSISTANT" ? ["MEETINGS"] : ["MEETINGS", "QUALIFIED"];
}

/** Менеджеры по развитию сверху, ассистенты ниже; порядок внутри группы сохраняется. */
export function splitByRole<T extends { role: KpiRole }>(people: T[]) {
  return {
    development: people.filter((p) => p.role !== "ASSISTANT"),
    assistants: people.filter((p) => p.role === "ASSISTANT"),
  };
}

export type Ym = { year: number; month: number }; // month: 1–12

export const MONTH_NAMES = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

const pad = (n: number) => String(n).padStart(2, "0");

export function ymKey({ year, month }: Ym): string {
  return `${year}-${pad(month)}`;
}

export function parseYm(raw: string | undefined | null, fallback: Ym): Ym {
  const m = /^(\d{4})-(\d{1,2})$/.exec(raw ?? "");
  if (!m) return fallback;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12 || year < 2000 || year > 2100) return fallback;
  return { year, month };
}

export function addMonths({ year, month }: Ym, delta: number): Ym {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

export function quarterOf(ym: Ym): { q: number; months: Ym[] } {
  const q = Math.floor((ym.month - 1) / 3);
  return {
    q: q + 1,
    months: [1, 2, 3].map((i) => ({ year: ym.year, month: q * 3 + i })),
  };
}

export type KpiWeek = {
  /** Понедельник, YYYY-MM-DD — ключ недели в базе (KpiEntry.periodStart). */
  start: string;
  /** «05.10 – 09.10» (пн–пт). */
  label: string;
};

/** Недели месяца (пн–пт). Неделя принадлежит тому месяцу, на который
 * приходится большинство её рабочих дней — то есть месяцу её среды:
 * 28.09–02.10 (3 дня сентября, 2 октября) — сентябрь; 26.10–30.10 — октябрь. */
export function weeksOfMonth({ year, month }: Ym): KpiWeek[] {
  const weeks: KpiWeek[] = [];
  const first = Date.UTC(year, month - 1, 1);
  // Понедельник недели, в которой лежит 1-е число.
  const dow = (new Date(first).getUTCDay() + 6) % 7; // пн=0
  let monday = first - dow * 86400000;
  for (let i = 0; i < 6; i++, monday += 7 * 86400000) {
    const wed = new Date(monday + 2 * 86400000);
    if (wed.getUTCFullYear() !== year || wed.getUTCMonth() !== month - 1)
      continue;
    const mon = new Date(monday);
    const fri = new Date(monday + 4 * 86400000);
    const fmt = (d: Date) =>
      `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}`;
    weeks.push({
      start: `${mon.getUTCFullYear()}-${pad(mon.getUTCMonth() + 1)}-${pad(mon.getUTCDate())}`,
      label: `${fmt(mon)} – ${fmt(fri)}`,
    });
  }
  return weeks;
}

export function monthStartKey({ year, month }: Ym): string {
  return `${year}-${pad(month)}-01`;
}

export function toDateOnly(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

export function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Процент выполнения; null, если плана нет (делить не на что). */
export function pct(fact: number, plan: number): number | null {
  if (!(plan > 0)) return null;
  return Math.round((fact / plan) * 1000) / 10;
}

export type KpiTone = "ok" | "warn" | "danger" | "none";

/** ≥100% — зелёный, 70–99% — жёлтый, ниже — красный. */
export function toneOf(p: number | null): KpiTone {
  if (p === null) return "none";
  if (p >= 100) return "ok";
  if (p >= 70) return "warn";
  return "danger";
}

/** 1234567 → «1 234 567 ₽» (неразрывные пробелы; без Intl — чтобы сервер и
 * браузер гарантированно дали одну и ту же строку). */
export function formatRub(n: number): string {
  const sign = n < 0 ? "−" : "";
  const s = Math.round(Math.abs(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
  return `${sign}${s}\u00a0₽`;
}

export function formatPct(p: number | null): string {
  return p === null ? "—" : `${Math.round(p)}%`;
}
