// Чистые расчёты итогов KPI за период (месяц или квартал) — для экспорта в
// Excel. Правила те же, что на странице /kpi:
//  - итоги по сотрудникам: у менеджера по развитию месячный план фиксирован
//    (8 встреч и 3 квалификации на месяц), у ассистента план — сумма
//    недельных; факт = сумма недельных фактов, прочерк считается за 0;
//  - «Авто» — отдельный сегмент со своим планом, в общий план не входит;
//  - менеджеры сделок — свободный текст, группируем без учёта регистра.
// Без "server-only": файл работает только с готовыми данными.

import {
  MONTH_PLAN_MEETINGS,
  MONTH_PLAN_QUALIFIED,
  monthStartKey,
  splitByRole,
  type Ym,
} from "./kpi";
import type {
  KpiDealRow,
  KpiEntryRow,
  KpiMonthPlan,
  KpiPersonRow,
} from "./kpi-data";

export type PlanFact = { plan: number; fact: number };

export type PersonSummary = {
  person: KpiPersonRow;
  isAssistant: boolean;
  meetings: PlanFact;
  qualified: PlanFact;
  deals: PlanFact;
};

export type Segment = {
  /** Сумма сделок сегмента за период. */
  total: number;
  planOptimal: number;
  planMax: number;
};

export type ManagerSummary = {
  name: string;
  sum: number;
  count: number;
  autoSum: number;
  autoCount: number;
};

export type PeriodSummary = {
  people: PersonSummary[];
  general: Segment;
  auto: Segment;
  /** Сделки периода (без резерва) в порядке ввода. */
  deals: KpiDealRow[];
  managers: ManagerSummary[];
};

const sameMonth = (a: { year: number; month: number }, b: Ym) =>
  a.year === b.year && a.month === b.month;

const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");

/** Сотрудники, которые показываются в таблице активности: включены в неё и
 * не в архиве (или уже имеют данные). Менеджеры по развитию — сверху. */
export function activityPeopleOf(
  people: KpiPersonRow[],
  entries: KpiEntryRow[],
): KpiPersonRow[] {
  const shown = people.filter(
    (p) =>
      p.inActivity && (!p.archived || entries.some((e) => e.personId === p.id)),
  );
  const { development, assistants } = splitByRole(shown);
  return [...development, ...assistants];
}

export function summarizePeriod(
  data: {
    people: KpiPersonRow[];
    entries: KpiEntryRow[];
    plans: KpiMonthPlan[];
    deals: KpiDealRow[];
  },
  months: Ym[],
): PeriodSummary {
  const weekEntries = data.entries.filter((e) => e.scope === "WEEK");
  const monthKeys = new Set(months.map(monthStartKey));

  const sumWeeks = (personId: string, metric: string, field: "plan" | "fact") =>
    weekEntries
      .filter((e) => e.personId === personId && e.metric === metric)
      .reduce((s, e) => s + (e[field] ?? 0), 0);
  const sumDeals = (personId: string, field: "plan" | "fact") =>
    data.entries
      .filter(
        (e) =>
          e.personId === personId &&
          e.scope === "MONTH" &&
          e.metric === "DEALS" &&
          monthKeys.has(e.periodStart),
      )
      .reduce((s, e) => s + (e[field] ?? 0), 0);

  const people = activityPeopleOf(data.people, data.entries).map<PersonSummary>(
    (person) => {
      const isAssistant = person.role === "ASSISTANT";
      return {
        person,
        isAssistant,
        meetings: {
          plan: isAssistant
            ? sumWeeks(person.id, "MEETINGS", "plan")
            : MONTH_PLAN_MEETINGS * months.length,
          fact: sumWeeks(person.id, "MEETINGS", "fact"),
        },
        qualified: {
          plan: isAssistant ? 0 : MONTH_PLAN_QUALIFIED * months.length,
          fact: isAssistant ? 0 : sumWeeks(person.id, "QUALIFIED", "fact"),
        },
        deals: {
          plan: isAssistant ? 0 : sumDeals(person.id, "plan"),
          fact: isAssistant ? 0 : sumDeals(person.id, "fact"),
        },
      };
    },
  );

  const deals = data.deals.filter(
    (d) => !d.isReserve && months.some((m) => sameMonth(d, m)),
  );
  const sumPlan = (
    f: "planOptimal" | "planMax" | "planOptimalAuto" | "planMaxAuto",
  ) =>
    months.reduce(
      (s, m) => s + (data.plans.find((p) => sameMonth(p, m))?.[f] ?? 0),
      0,
    );
  const general: Segment = {
    total: deals
      .filter((d) => d.direction !== "AUTO")
      .reduce((s, d) => s + d.amount, 0),
    planOptimal: sumPlan("planOptimal"),
    planMax: sumPlan("planMax"),
  };
  const auto: Segment = {
    total: deals
      .filter((d) => d.direction === "AUTO")
      .reduce((s, d) => s + d.amount, 0),
    planOptimal: sumPlan("planOptimalAuto"),
    planMax: sumPlan("planMaxAuto"),
  };

  const byManager = new Map<string, ManagerSummary>();
  for (const d of deals) {
    const key = norm(d.managerName);
    const cur = byManager.get(key) ?? {
      name: key ? d.managerName.trim() : "Без менеджера",
      sum: 0,
      count: 0,
      autoSum: 0,
      autoCount: 0,
    };
    cur.sum += d.amount;
    cur.count += 1;
    if (d.direction === "AUTO") {
      cur.autoSum += d.amount;
      cur.autoCount += 1;
    }
    byManager.set(key, cur);
  }
  const managers = [...byManager.values()].sort((a, b) => b.sum - a.sum);

  return { people, general, auto, deals, managers };
}
