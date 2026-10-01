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
  effectivePlan,
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
  /** Менеджер без «Активности»: показатели — прочерки, факт сделок — число
   * его сделок за период. */
  salesOnly: boolean;
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
  // План по сделкам: на каждый месяц периода — сохранённый или по умолчанию (1).
  const dealsPlan = (person: KpiPersonRow) =>
    months.reduce((acc, m) => {
      const e = data.entries.find(
        (x) =>
          x.personId === person.id &&
          x.scope === "MONTH" &&
          x.metric === "DEALS" &&
          x.periodStart === monthStartKey(m),
      );
      return acc + (effectivePlan(e, person.role, "DEALS", "MONTH") ?? 0);
    }, 0);

  const people = activityPeopleOf(data.people, data.entries).map<PersonSummary>(
    (person) => {
      const isAssistant = person.role === "ASSISTANT";
      return {
        person,
        isAssistant,
        salesOnly: false,
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
          plan: isAssistant ? 0 : dealsPlan(person),
          fact: isAssistant ? 0 : sumDeals(person.id, "fact"),
        },
      };
    },
  );

  const deals = data.deals.filter(
    (d) => !d.isReserve && months.some((m) => sameMonth(d, m)),
  );

  // Менеджеры только с галочкой «Менеджер» и сделкой за период — после
  // менеджеров по развитию, до ассистентов.
  const salesOnly = data.people
    .filter((p) => p.inSales && !p.inActivity && !p.archived)
    .map<PersonSummary | null>((person) => {
      const count = deals.filter(
        (d) => norm(d.managerName) === norm(person.name),
      ).length;
      if (count === 0) return null;
      return {
        person,
        isAssistant: false,
        salesOnly: true,
        meetings: { plan: 0, fact: 0 },
        qualified: { plan: 0, fact: 0 },
        deals: { plan: 0, fact: count },
      };
    })
    .filter((r): r is PersonSummary => r !== null);
  const firstAssistantAt = people.findIndex((p) => p.isAssistant);
  people.splice(
    firstAssistantAt === -1 ? people.length : firstAssistantAt,
    0,
    ...salesOnly,
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
