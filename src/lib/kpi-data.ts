import "server-only";

import { db } from "./db";
import {
  dateKey,
  monthStartKey,
  toDateOnly,
  weeksOfMonth,
  type KpiRole,
  type Ym,
} from "./kpi";

export type KpiPersonRow = {
  id: string;
  name: string;
  inActivity: boolean;
  inSales: boolean;
  role: KpiRole;
  archived: boolean;
};

export type KpiEntryRow = {
  personId: string;
  metric: "MEETINGS" | "QUALIFIED" | "DEALS";
  scope: "WEEK" | "MONTH";
  periodStart: string; // YYYY-MM-DD
  /** null — прочерк. */
  plan: number | null;
  fact: number | null;
  /** Своё название строки; "" — по умолчанию. */
  label: string;
  companies: string[];
  /** Примечания «!» к факту и к плану; "" — нет. */
  factNote: string;
  planNote: string;
};

export type KpiDealRow = {
  id: string;
  year: number;
  month: number;
  client: string;
  amount: number;
  direction: "AUTO" | "REALTY" | null;
  managerName: string;
  note: string;
  isReserve: boolean;
  /** «Договор подписан» — пометка, в итоги не влияет. */
  confirmed: boolean;
};

export type KpiMonthPlan = {
  year: number;
  month: number;
  planOptimal: number;
  planMax: number;
  /** Отдельный план сегмента «Авто». */
  planOptimalAuto: number;
  planMaxAuto: number;
};

export type KpiLoadOptions = {
  /** Месяцы, сделки которых грузим для сквозной формы (квартал). */
  dealMonths: Ym[];
  /** Резерв показывается по этот месяц включительно: не ставший сделкой
   * резерв автоматически «переезжает» на следующие месяцы. */
  reserveUpTo: Ym;
  /** Месяцы прошлого квартала — считаем неподписанные сделки для переноса. */
  prevQuarter: Ym[];
};

/** Всё, что нужно странице: активность/планы — за `months` (месяц или
 * квартал), сделки — за квартал целиком, резерв — накопительно. */
export async function loadKpi(
  organizationId: string,
  months: Ym[],
  opts: KpiLoadOptions,
) {
  const weekStarts = months.flatMap((m) => weeksOfMonth(m).map((w) => w.start));
  const monthStarts = months.map(monthStartKey);
  const periodStarts = [...weekStarts, ...monthStarts].map(toDateOnly);
  const ymFilter = months.map((m) => ({ year: m.year, month: m.month }));

  const dealFilter = opts.dealMonths.map((m) => ({ year: m.year, month: m.month }));
  const prevFilter = opts.prevQuarter.map((m) => ({ year: m.year, month: m.month }));
  const upTo = opts.reserveUpTo;

  const [people, entries, plans, deals, reserve, carryCount] = await Promise.all([
    db.kpiPerson.findMany({
      where: { organizationId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    }),
    db.kpiEntry.findMany({
      where: { organizationId, periodStart: { in: periodStarts } },
    }),
    db.kpiMonth.findMany({ where: { organizationId, OR: ymFilter } }),
    db.kpiDeal.findMany({
      where: { organizationId, isReserve: false, OR: dealFilter },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    }),
    db.kpiDeal.findMany({
      where: {
        organizationId,
        isReserve: true,
        OR: [
          { year: { lt: upTo.year } },
          { year: upTo.year, month: { lte: upTo.month } },
        ],
      },
      orderBy: [{ year: "asc" }, { month: "asc" }, { position: "asc" }],
    }),
    db.kpiDeal.count({
      where: { organizationId, isReserve: false, confirmed: false, OR: prevFilter },
    }),
  ]);

  const toRow = (d: (typeof deals)[number]): KpiDealRow => ({
    id: d.id,
    year: d.year,
    month: d.month,
    client: d.client,
    amount: Number(d.amount),
    direction: d.direction,
    managerName: d.managerName ?? "",
    note: d.note ?? "",
    isReserve: d.isReserve,
    confirmed: d.confirmed,
  });

  return {
    people: people.map<KpiPersonRow>((p) => ({
      id: p.id,
      name: p.name,
      inActivity: p.inActivity,
      inSales: p.inSales,
      role: p.role,
      archived: p.archived,
    })),
    entries: entries.map<KpiEntryRow>((e) => ({
      personId: e.personId,
      metric: e.metric,
      scope: e.scope,
      periodStart: dateKey(e.periodStart),
      plan: e.plan,
      fact: e.fact,
      label: e.label ?? "",
      companies: e.companies,
      factNote: e.factNote ?? "",
      planNote: e.planNote ?? "",
    })),
    plans: plans.map<KpiMonthPlan>((p) => ({
      year: p.year,
      month: p.month,
      planOptimal: Number(p.planOptimal),
      planMax: Number(p.planMax),
      planOptimalAuto: Number(p.planOptimalAuto),
      planMaxAuto: Number(p.planMaxAuto),
    })),
    deals: deals.map(toRow),
    reserve: reserve.map(toRow),
    carryCount,
  };
}

export type KpiData = Awaited<ReturnType<typeof loadKpi>>;
