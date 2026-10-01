import Link from "next/link";
import { requireSection } from "@/lib/auth";
import { canManageKpi } from "@/lib/permissions";
import { loadKpi } from "@/lib/kpi-data";
import {
  addMonths,
  DEFAULT_METRIC_LABELS,
  effectivePlan,
  formatPct,
  formatRub,
  MONTH_NAMES,
  monthStartKey,
  parseYm,
  pct,
  MONTH_PLAN_MEETINGS,
  MONTH_PLAN_QUALIFIED,
  quarterOf,
  splitByRole,
  toneOf,
  weeksOfMonth,
  ymKey,
  type Ym,
} from "@/lib/kpi";
import { Card, PageHeader } from "@/components/ui";
import { CarryOverButton } from "./carry-over-button";
import { ExportPanel } from "./export-panel";
import { DealsForm, ReserveTable } from "./deals-table";
import { EntryNumber, MonthPlanMoney, type MonthPlanValues } from "./cells";
import { PeopleManager } from "./people-manager";
import { ProgressBar, toneText } from "./progress";
import { Weeks } from "./weeks";

const monthTitle = (ym: Ym) => `${MONTH_NAMES[ym.month - 1]} ${ym.year}`;

function pill(active: boolean) {
  return `inline-flex items-center rounded-full px-3 py-1.5 text-sm transition duration-100 pointer-coarse:min-h-11 ${
    active
      ? "bg-border font-medium"
      : "text-muted hover:bg-border/50 hover:text-foreground"
  }`;
}

function Metric({
  title,
  fact,
  plan,
}: {
  title: string;
  fact: number;
  plan: number;
}) {
  const p = pct(fact, plan);
  return (
    <Card density="panel" className="grid content-between gap-3">
      <p className="text-sm text-muted">{title}</p>
      <p className="text-2xl font-semibold tabular-nums">
        <span className={toneText(toneOf(p))}>{fact}</span>
        <span className="text-base font-normal text-muted"> из {plan}</span>
      </p>
      <ProgressBar pct={p} label={title} />
    </Card>
  );
}

/** Мелкая подпись под суммой: сколько из неё приходится на сегмент «Авто». */
function AutoNote({ sum, count }: { sum: number; count: number }) {
  if (count === 0) return null;
  return (
    <span className="mt-0.5 block text-xs font-normal text-muted">
      в т. ч. Авто {formatRub(sum)} · {count}
    </span>
  );
}

function RevenueCard({
  title,
  hint,
  total,
  optimal,
  max,
}: {
  title: string;
  hint: string;
  total: number;
  optimal: number;
  max: number;
}) {
  return (
    <Card density="panel" className="grid content-between gap-3">
      <p className="text-sm text-muted">
        {title} <span className="text-xs">· {hint}</span>
      </p>
      <p className="text-2xl font-semibold tabular-nums">{formatRub(total)}</p>
      <div className="grid gap-1.5 text-xs text-muted">
        <div className="grid gap-0.5">
          <span>Оптимум {formatRub(optimal)}</span>
          <ProgressBar
            pct={pct(total, optimal)}
            label={`${title}: оптимальный план`}
          />
        </div>
        <div className="grid gap-0.5">
          <span>Максимум {formatRub(max)}</span>
          <ProgressBar
            pct={pct(total, max)}
            label={`${title}: максимальный план`}
          />
        </div>
      </div>
    </Card>
  );
}

/** Сумма сегмента за месяц + формы плана «оптимум/максимум», отклонение и %. */
function SegmentPlan({
  title,
  total,
  m,
  plan,
  fields,
}: {
  title: string;
  total: number;
  m: Ym;
  plan: MonthPlanValues;
  fields: readonly [
    ["Оптимум", "planOptimal" | "planOptimalAuto"],
    ["Максимум", "planMax" | "planMaxAuto"],
  ];
}) {
  return (
    <div className="grid content-start gap-2">
      <div>
        <h3 className="text-sm font-medium text-muted">{title}</h3>
        <p className="mt-0.5 text-2xl font-semibold tabular-nums">
          {formatRub(total)}
        </p>
      </div>
      <div className="grid gap-1.5 text-sm">
        <div className="hidden gap-x-3 text-xs text-muted sm:flex">
          <span className="w-20 shrink-0" />
          <span className="w-28 shrink-0 pr-2 text-right">План</span>
          <span className="w-28 shrink-0 text-right">Отклонение</span>
          <span className="w-12 shrink-0 text-right">Выполн.</span>
        </div>
        {fields.map(([label, field]) => {
          const value = plan[field];
          return (
            <div
              key={field}
              className="flex flex-wrap items-center gap-x-3 gap-y-0.5"
            >
              <span className="w-20 shrink-0 text-muted">{label}</span>
              <MonthPlanMoney
                year={m.year}
                month={m.month}
                plan={plan}
                field={field}
                label={`План выручки (${title}), ${label.toLowerCase()}, ${monthTitle(m)}`}
              />
              <span
                className={`w-28 shrink-0 text-right tabular-nums ${total - value >= 0 ? "text-ok" : "text-danger"}`}
              >
                {value > 0
                  ? `${total - value > 0 ? "+" : ""}${formatRub(total - value)}`
                  : "—"}
              </span>
              <span
                className={`w-12 shrink-0 text-right font-medium tabular-nums ${toneText(toneOf(pct(total, value)))}`}
              >
                {formatPct(pct(total, value))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default async function KpiPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; view?: string }>;
}) {
  const user = await requireSection("kpi");
  const canManage = canManageKpi(user);
  const sp = await searchParams;

  const now = new Date();
  const ym = parseYm(sp.m, {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });
  const isQuarter = sp.view === "quarter";
  const quarter = quarterOf(ym);
  const months = isQuarter ? quarter.months : [ym];

  // Форма сделок сквозная по кварталу; резерв не сквозной — показывается на
  // выбранный месяц (в квартальном виде — на последний месяц квартала) и сам
  // «переезжает» вперёд, пока не станет сделкой.
  const reserveMonth = isQuarter ? quarter.months[2] : ym;
  const prevQuarter = quarterOf(addMonths(ym, -3));
  const data = await loadKpi(user.organizationId, months, {
    dealMonths: quarter.months,
    reserveUpTo: reserveMonth,
    prevQuarter: prevQuarter.months,
  });
  const { people, entries, plans, reserve, carryCount } = data;
  const labels = DEFAULT_METRIC_LABELS;

  // Менеджер сделки — свободный текст: группируем без учёта регистра и
  // лишних пробелов.
  const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");

  // ── итоги периода ──
  // Верхние итоги — только по менеджерам по развитию: встречи ассистентов
  // в них не входят (у ассистентов нет ни квалификации, ни сделок).
  const developmentIds = new Set(
    people.filter((p) => p.role !== "ASSISTANT").map((p) => p.id),
  );
  const weekEntries = entries.filter((e) => e.scope === "WEEK");
  const teamWeekEntries = weekEntries.filter((e) =>
    developmentIds.has(e.personId),
  );
  const sumOf = (metric: string, field: "plan" | "fact") =>
    teamWeekEntries
      .filter((e) => e.metric === metric)
      .reduce((s, e) => s + (e[field] ?? 0), 0);
  // Число сделок (факт) вносится вручную у каждого сотрудника из таблицы
  // активности, а не берётся из списка сделок ниже. Исключение — менеджеры
  // без «Активности»: ручных показателей у них нет, их факт — число их сделок.
  const manualDealsFact = entries
    .filter(
      (e) =>
        e.scope === "MONTH" &&
        e.metric === "DEALS" &&
        developmentIds.has(e.personId),
    )
    .reduce((s, e) => s + (e.fact ?? 0), 0);
  // Итоги, планы и менеджеры — по выбранному периоду (месяц или квартал);
  // в форму сделок уходит весь квартал.
  const realDeals = data.deals.filter((d) =>
    months.some((m) => m.year === d.year && m.month === d.month),
  );
  // План по сделкам: у каждого менеджера по развитию на каждый месяц периода —
  // сохранённый или, если записи нет, по умолчанию (1).
  const dealsPlan = people
    .filter(
      (p) =>
        p.inActivity &&
        p.role !== "ASSISTANT" &&
        (!p.archived || entries.some((e) => e.personId === p.id)),
    )
    .reduce(
      (sum, p) =>
        sum +
        months.reduce((acc, m) => {
          const e = entries.find(
            (x) =>
              x.personId === p.id &&
              x.scope === "MONTH" &&
              x.metric === "DEALS" &&
              x.periodStart === monthStartKey(m),
          );
          return acc + (effectivePlan(e, p.role, "DEALS", "MONTH") ?? 0);
        }, 0),
      0,
    );
  const planOf = (m: Ym) =>
    plans.find((p) => p.year === m.year && p.month === m.month);
  const sumPlan = (
    f: "planOptimal" | "planMax" | "planOptimalAuto" | "planMaxAuto",
  ) => months.reduce((s, m) => s + (planOf(m)?.[f] ?? 0), 0);
  const planOptimal = sumPlan("planOptimal");
  const planMax = sumPlan("planMax");
  const planOptimalAuto = sumPlan("planOptimalAuto");
  const planMaxAuto = sumPlan("planMaxAuto");
  // Сегмент «Авто» живёт отдельно: со своим планом и в общий план/итоги не
  // входит (ни выручкой, ни числом сделок).
  const generalDeals = realDeals.filter((d) => d.direction !== "AUTO");
  const autoDeals = realDeals.filter((d) => d.direction === "AUTO");
  const revenue = generalDeals.reduce((s, d) => s + d.amount, 0);
  const revenueAuto = autoDeals.reduce((s, d) => s + d.amount, 0);

  // Менеджеры только с галочкой «Менеджер» (без «Активности»), у которых есть
  // сделка за период: показываются в сводке активности с прочерками и числом
  // своих сделок; в недельных таблицах их нет.
  const salesOnlyRows = people
    .filter((p) => p.inSales && !p.inActivity && !p.archived)
    .map((p) => ({
      p,
      count: realDeals.filter((d) => norm(d.managerName) === norm(p.name))
        .length,
    }))
    .filter((r) => r.count > 0);
  const dealsFact =
    manualDealsFact + salesOnlyRows.reduce((sum, r) => sum + r.count, 0);

  // ── навигация по периоду ──
  const step = isQuarter ? 3 : 1;
  const href = (target: Ym, view = isQuarter ? "quarter" : "month") =>
    `/kpi?m=${ymKey(target)}${view === "quarter" ? "&view=quarter" : ""}`;
  const periodLabel = isQuarter
    ? `${quarter.q} квартал ${ym.year}`
    : monthTitle(ym);

  // ── менеджеры: общий план и сегмент «Авто» — отдельными колонками ──
  type Seg = { sum: number; count: number };
  const byManager = new Map<
    string,
    { name: string; general: Seg; auto: Seg }
  >();
  for (const d of realDeals) {
    const key = norm(d.managerName);
    const cur = byManager.get(key) ?? {
      name: key ? d.managerName.trim() : "Без менеджера",
      general: { sum: 0, count: 0 },
      auto: { sum: 0, count: 0 },
    };
    const seg = d.direction === "AUTO" ? cur.auto : cur.general;
    seg.sum += d.amount;
    seg.count += 1;
    byManager.set(key, cur);
  }
  const managerRows = [...byManager.entries()]
    .map(([id, v]) => ({ id, ...v }))
    .sort((x, y) => y.general.sum + y.auto.sum - (x.general.sum + x.auto.sum));

  // ── активность (только вид «месяц») ──
  const weeks = weeksOfMonth(ym);
  const todayKey = now.toISOString().slice(0, 10);
  const currentWeek = weeks.findIndex((w, i) => {
    const next = weeks[i + 1]?.start ?? "9999-12-31";
    return w.start <= todayKey && todayKey < next;
  });
  const activityPeople = people.filter(
    (p) =>
      p.inActivity && (!p.archived || entries.some((e) => e.personId === p.id)),
  );
  const { development, assistants } = splitByRole(activityPeople);
  // Строки сводной таблицы: менеджеры по развитию, менеджеры без «Активности»
  // (только со сделками), затем — под чертой — ассистенты.
  const summaryRows = [
    ...development.map((p) => ({ p, kind: "dev" as const, count: 0 })),
    ...salesOnlyRows.map((r) => ({
      p: r.p,
      kind: "sales" as const,
      count: r.count,
    })),
    ...assistants.map((p) => ({ p, kind: "assistant" as const, count: 0 })),
  ];
  const firstAssistantIndex = summaryRows.findIndex(
    (r) => r.kind === "assistant",
  );
  const entryBy = (
    personId: string,
    metric: string,
    scope: string,
    start: string,
  ) =>
    entries.find(
      (e) =>
        e.personId === personId &&
        e.metric === metric &&
        e.scope === scope &&
        e.periodStart === start,
    );
  // Менеджеров по развитию в таблице: месячный план у каждого фиксирован.
  const developmentActive = development.length;
  const personSum = (
    personId: string,
    metric: string,
    field: "plan" | "fact",
  ) =>
    weekEntries
      .filter((e) => e.personId === personId && e.metric === metric)
      .reduce((s, e) => s + (e[field] ?? 0), 0);

  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)] gap-8 p-4 sm:p-6 min-[1440px]:max-w-[1600px]">
      <PageHeader
        title="KPI план/факт"
        subtitle="Встречи, квалификации, сделки и выручка отдела: план против факта"
        actions={<ExportPanel year={ym.year} month={ym.month} />}
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex items-center gap-1">
          <Link
            href={href(addMonths(ym, -step))}
            aria-label="Предыдущий период"
            className="flex size-9 items-center justify-center rounded-lg text-muted transition hover:bg-border/60 hover:text-foreground pointer-coarse:size-11"
          >
            ‹
          </Link>
          <h2 className="min-w-44 text-center text-lg font-semibold">
            {periodLabel}
          </h2>
          <Link
            href={href(addMonths(ym, step))}
            aria-label="Следующий период"
            className="flex size-9 items-center justify-center rounded-lg text-muted transition hover:bg-border/60 hover:text-foreground pointer-coarse:size-11"
          >
            ›
          </Link>
        </div>
        <nav className="flex gap-1.5" aria-label="Вид">
          <Link
            href={href(ym, "month")}
            aria-current={!isQuarter ? "page" : undefined}
            className={pill(!isQuarter)}
          >
            Месяц
          </Link>
          <Link
            href={href(ym, "quarter")}
            aria-current={isQuarter ? "page" : undefined}
            className={pill(isQuarter)}
          >
            Квартал
          </Link>
        </nav>
      </div>

      {/* Итоги периода. Колонки заданы явно: grid без grid-cols на телефоне
          схлопывает карточки в одну неопределённую колонку. */}
      <section
        aria-label="Итоги"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <Metric
          title={labels.MEETINGS}
          fact={sumOf("MEETINGS", "fact")}
          plan={developmentActive * months.length * MONTH_PLAN_MEETINGS}
        />
        <Metric
          title={labels.QUALIFIED}
          fact={sumOf("QUALIFIED", "fact")}
          plan={developmentActive * months.length * MONTH_PLAN_QUALIFIED}
        />
        <Metric title={labels.DEALS} fact={dealsFact} plan={dealsPlan} />
      </section>

      {/* Выручка — два сегмента отдельно, у каждого свой план. */}
      <section
        aria-label="Выручка по сегментам"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <RevenueCard
          title="Выручка"
          hint="без сегмента «Авто»"
          total={revenue}
          optimal={planOptimal}
          max={planMax}
        />
        <RevenueCard
          title="Выручка · Авто"
          hint="отдельный план"
          total={revenueAuto}
          optimal={planOptimalAuto}
          max={planMaxAuto}
        />
      </section>

      {/* На широком экране «Выручка» стоит справа от активности; в
          квартальном виде активности нет — выручка на всю ширину. */}
      <div
        className={`grid grid-cols-[minmax(0,1fr)] gap-8 ${
          isQuarter ? "" : "min-[1440px]:grid-cols-2 min-[1440px]:items-start"
        }`}
      >
        {!isQuarter ? (
          <section
            className="grid grid-cols-[minmax(0,1fr)] gap-4"
            aria-labelledby="kpi-activity"
          >
            <h2 id="kpi-activity" className="text-lg font-semibold">
              Активность по сотрудникам
            </h2>

            {summaryRows.length > 0 ? (
              <Card density="row" className="overflow-x-auto !p-0">
                <table className="w-full min-w-[520px] table-fixed text-left">
                  <colgroup>
                    <col className="w-[34%]" />
                    <col className="w-[18%]" />
                    <col className="w-[22%]" />
                    <col className="w-[13%]" />
                    <col className="w-[13%]" />
                  </colgroup>
                  <thead>
                    <tr className="text-[11px] text-muted">
                      <th className="px-2 py-1.5 font-medium">Сотрудник</th>
                      <th className="px-1 py-1.5 text-center font-medium">
                        {labels.MEETINGS}
                      </th>
                      <th className="px-1 py-1.5 text-center font-medium">
                        {labels.QUALIFIED}
                      </th>
                      <th className="px-1 py-1.5 text-center font-medium">
                        Сделки: план
                      </th>
                      <th className="px-1 py-1.5 text-center font-medium">
                        Сделки: факт
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryRows.map(({ p, kind, count }, pi) => {
                      const isAssistant = kind === "assistant";
                      const isSales = kind === "sales";
                      const firstAssistant =
                        isAssistant && pi > 0 && pi === firstAssistantIndex;
                      const planMeetings = isAssistant
                        ? personSum(p.id, "MEETINGS", "plan")
                        : MONTH_PLAN_MEETINGS;
                      const planQualified = isAssistant
                        ? personSum(p.id, "QUALIFIED", "plan")
                        : MONTH_PLAN_QUALIFIED;
                      const mp = pct(
                        personSum(p.id, "MEETINGS", "fact"),
                        planMeetings,
                      );
                      const qp = pct(
                        personSum(p.id, "QUALIFIED", "fact"),
                        planQualified,
                      );
                      const dealEntry = entryBy(
                        p.id,
                        "DEALS",
                        "MONTH",
                        monthStartKey(ym),
                      );
                      const dealPlan = effectivePlan(
                        dealEntry,
                        p.role,
                        "DEALS",
                        "MONTH",
                      );
                      const dealFactValue = dealEntry ? dealEntry.fact : 0;
                      return (
                        <tr
                          key={p.id}
                          className={
                            firstAssistant
                              ? "border-t-2 border-muted/40"
                              : "border-t border-border"
                          }
                        >
                          <th
                            scope="row"
                            className="min-w-32 px-2 py-1 text-[13px] font-medium"
                          >
                            <span className="block px-1.5 py-0.5">
                              {p.name}
                            </span>
                          </th>
                          {isSales ? (
                            <>
                              <td className="px-1 py-1.5 text-center text-[13px] text-muted">
                                —
                              </td>
                              <td className="px-1 py-1.5 text-center text-[13px] text-muted">
                                —
                              </td>
                              <td className="px-1 py-1.5 text-center text-[13px] text-muted">
                                —
                              </td>
                              <td
                                className="px-1 py-1.5 text-center text-[13px] tabular-nums"
                                title="Число его сделок за период (из формы сделок)"
                              >
                                {count}
                              </td>
                            </>
                          ) : (
                            <>
                              <td
                                className={`px-1 py-1.5 text-center text-[13px] tabular-nums ${toneText(toneOf(mp))}`}
                              >
                                {personSum(p.id, "MEETINGS", "fact")} /{" "}
                                {planMeetings}{" "}
                                <span className="text-[11px]">
                                  ({formatPct(mp)})
                                </span>
                              </td>
                              {isAssistant ? (
                                <>
                                  <td className="px-1 py-1.5 text-center text-[13px] text-muted">
                                    —
                                  </td>
                                  <td className="px-1 py-1.5 text-center text-[13px] text-muted">
                                    —
                                  </td>
                                  <td className="px-1 py-1.5 text-center text-[13px] text-muted">
                                    —
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td
                                    className={`px-1 py-1.5 text-center text-[13px] tabular-nums ${toneText(toneOf(qp))}`}
                                  >
                                    {personSum(p.id, "QUALIFIED", "fact")} /{" "}
                                    {planQualified}{" "}
                                    <span className="text-[11px]">
                                      ({formatPct(qp)})
                                    </span>
                                  </td>
                                  <td className="px-2 py-1 text-center">
                                    <EntryNumber
                                      entry={{
                                        personId: p.id,
                                        metric: "DEALS",
                                        scope: "MONTH",
                                        periodStart: monthStartKey(ym),
                                      }}
                                      field="plan"
                                      value={dealPlan}
                                      label={`${p.name}: план по сделкам на месяц`}
                                    />
                                  </td>
                                  <td className="px-2 py-1 text-center">
                                    <EntryNumber
                                      entry={{
                                        personId: p.id,
                                        metric: "DEALS",
                                        scope: "MONTH",
                                        periodStart: monthStartKey(ym),
                                      }}
                                      field="fact"
                                      value={dealFactValue}
                                      label={`${p.name}: факт по сделкам за месяц`}
                                    />
                                  </td>
                                </>
                              )}
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            ) : null}

            <Weeks
              weeks={weeks}
              people={activityPeople}
              entries={entries}
              openIndex={currentWeek >= 0 ? currentWeek : 0}
              canManage={canManage}
            />
          </section>
        ) : null}

        <section
          className="grid grid-cols-[minmax(0,1fr)] gap-4"
          aria-labelledby="kpi-revenue"
        >
          <h2 id="kpi-revenue" className="text-lg font-semibold">
            Выручка
          </h2>

          {/* Планы и суммы по месяцам периода: общий план и сегмент «Авто». */}
          {months.map((m) => {
            const stored = planOf(m);
            const plan: MonthPlanValues = {
              planOptimal: stored?.planOptimal ?? 0,
              planMax: stored?.planMax ?? 0,
              planOptimalAuto: stored?.planOptimalAuto ?? 0,
              planMaxAuto: stored?.planMaxAuto ?? 0,
            };
            const monthDeals = realDeals.filter(
              (d) => d.year === m.year && d.month === m.month,
            );
            const totalGeneral = monthDeals
              .filter((d) => d.direction !== "AUTO")
              .reduce((s, d) => s + d.amount, 0);
            const totalAuto = monthDeals
              .filter((d) => d.direction === "AUTO")
              .reduce((s, d) => s + d.amount, 0);
            return (
              <Card
                key={ymKey(m)}
                density="panel"
                className="grid grid-cols-[minmax(0,1fr)] gap-4"
              >
                <h3 className="font-medium">{monthTitle(m)}</h3>
                <div
                  className={`grid gap-6 ${isQuarter ? "lg:grid-cols-2" : "lg:max-[1439px]:grid-cols-2"}`}
                >
                  <SegmentPlan
                    title="Общий план (без Авто)"
                    total={totalGeneral}
                    m={m}
                    plan={plan}
                    fields={[
                      ["Оптимум", "planOptimal"],
                      ["Максимум", "planMax"],
                    ]}
                  />
                  <SegmentPlan
                    title="Авто"
                    total={totalAuto}
                    m={m}
                    plan={plan}
                    fields={[
                      ["Оптимум", "planOptimalAuto"],
                      ["Максимум", "planMaxAuto"],
                    ]}
                  />
                </div>
              </Card>
            );
          })}

          {/* Сквозная форма сделок квартала: разбивка по месяцам внутри. */}
          <Card
            density="panel"
            className="grid grid-cols-[minmax(0,1fr)] gap-3 !p-0"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
              <div>
                <h3 className="font-medium">
                  Сделки · {quarter.q} квартал {ym.year}
                </h3>
                <p className="text-sm text-muted">
                  Месяц выбирается в строке. Галочка «Подписан» — пометка, что
                  договор подписан; в итоги входят все сделки.
                </p>
              </div>
              <CarryOverButton
                year={ym.year}
                month={ym.month}
                count={carryCount}
                fromLabel={`${prevQuarter.q} квартал ${prevQuarter.months[0].year}`}
              />
            </div>
            <DealsForm
              key={ymKey(ym)}
              deals={data.deals}
              months={quarter.months}
              selected={ym}
              managers={people
                .filter((p) => p.inSales && !p.archived)
                .map((p) => p.name)}
            />
          </Card>

          {/* Резерв относится к выручке, но нигде не учитывается. Он не сквозной:
            виден резерв выбранного месяца, не ставший сделкой — переезжает на
            следующие. */}
          <Card
            density="panel"
            className="grid grid-cols-[minmax(0,1fr)] gap-3 !p-0"
          >
            <div className="px-5 pt-5">
              <h3 className="font-medium">
                Резерв · {monthTitle(reserveMonth)}
              </h3>
              <p className="text-sm text-muted">
                Ожидаемые сделки — нигде не учитываются. Не ставшие сделкой сами
                переходят на следующий месяц.
              </p>
            </div>
            <ReserveTable deals={reserve} selected={reserveMonth} />
          </Card>
        </section>
      </div>

      <section
        className="grid grid-cols-[minmax(0,1fr)] gap-4"
        aria-labelledby="kpi-managers"
      >
        <div>
          <h2 id="kpi-managers" className="text-lg font-semibold">
            Менеджеры
          </h2>
          <p className="text-sm text-muted">
            Все сделки; часть, относящаяся к сегменту «Авто», подписана под
            суммой.
          </p>
        </div>
        <Card density="row" className="overflow-x-auto !p-0">
          <table className="w-full min-w-[420px] text-left">
            <thead>
              <tr className="text-xs text-muted">
                <th className="px-4 py-2 font-medium">Менеджер</th>
                <th className="px-2 py-2 text-right font-medium">Чек</th>
                <th className="px-2 py-2 text-right font-medium">Сделок</th>
                <th className="px-4 py-2 text-right font-medium">
                  Средний чек
                </th>
              </tr>
            </thead>
            <tbody>
              {managerRows.map((r) => {
                const sum = r.general.sum + r.auto.sum;
                const count = r.general.count + r.auto.count;
                return (
                  <tr
                    key={r.id || "none"}
                    className="border-t border-border text-sm"
                  >
                    <th scope="row" className="px-4 py-2 font-medium">
                      {r.name}
                    </th>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {formatRub(sum)}
                      <AutoNote sum={r.auto.sum} count={r.auto.count} />
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {count}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatRub(count ? sum / count : 0)}
                    </td>
                  </tr>
                );
              })}
              {managerRows.length === 0 ? (
                <tr className="border-t border-border text-sm text-muted">
                  <td colSpan={4} className="px-4 py-3">
                    Сделок за период пока нет.
                  </td>
                </tr>
              ) : (
                <tr className="border-t border-border bg-background/40 text-sm font-medium">
                  <th scope="row" className="px-4 py-2">
                    Всего
                  </th>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatRub(revenue + revenueAuto)}
                    <AutoNote sum={revenueAuto} count={autoDeals.length} />
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {generalDeals.length + autoDeals.length}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatRub(
                      generalDeals.length + autoDeals.length
                        ? (revenue + revenueAuto) /
                            (generalDeals.length + autoDeals.length)
                        : 0,
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </section>

      {canManage ? (
        <details className="group rounded-xl border border-border bg-surface">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 font-medium [&::-webkit-details-marker]:hidden">
            <span
              aria-hidden="true"
              className="text-muted transition-transform duration-150 group-open:rotate-90"
            >
              ▸
            </span>
            Участники
          </summary>
          <div className="border-t border-border p-5">
            <PeopleManager people={people} />
          </div>
        </details>
      ) : null}
    </div>
  );
}
