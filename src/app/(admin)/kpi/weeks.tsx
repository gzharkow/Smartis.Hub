import {
  DEFAULT_METRIC_LABELS,
  formatPct,
  metricsFor,
  pct,
  splitByRole,
  toneOf,
  type KpiWeek,
} from "@/lib/kpi";
import type { KpiEntryRow, KpiPersonRow } from "@/lib/kpi-data";
import { EntryNumber, NoteButton } from "./cells";
import { toneText } from "./progress";

const SUMMARY_METRICS = ["MEETINGS", "QUALIFIED"] as const;

/** Недели месяца: у каждой — сетка «сотрудник × показатель» с планом, фактом
 * и компаниями. Сверху менеджеры по развитию, под чертой — ассистенты (у них
 * только встречи). Итог в шапке недели — по менеджерам по развитию. */
export function Weeks({
  weeks,
  people,
  entries,
  openIndex,
  canManage,
}: {
  weeks: KpiWeek[];
  people: KpiPersonRow[];
  entries: KpiEntryRow[];
  openIndex: number;
  /** Можно менять названия и должности (см. canManageKpi). */
  canManage: boolean;
}) {
  const byKey = new Map(
    entries.map((e) => [
      `${e.personId}|${e.metric}|${e.scope}|${e.periodStart}`,
      e,
    ]),
  );
  const get = (personId: string, metric: string, start: string) =>
    byKey.get(`${personId}|${metric}|WEEK|${start}`);

  const { development, assistants } = splitByRole(people);
  const ordered = [...development, ...assistants];

  if (people.length === 0) {
    return (
      <p className="text-sm text-muted">
        В таблице пока нет сотрудников
        {canManage ? " — добавьте их в блоке «Участники» внизу страницы." : "."}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      {weeks.map((week, i) => {
        const totals = SUMMARY_METRICS.map((key) => {
          let plan = 0;
          let fact = 0;
          for (const p of development) {
            const e = get(p.id, key, week.start);
            plan += e?.plan ?? 0;
            fact += e?.fact ?? 0;
          }
          return {
            key,
            label: DEFAULT_METRIC_LABELS[key],
            plan,
            fact,
            p: pct(fact, plan),
          };
        });

        return (
          <details
            key={week.start}
            open={i === openIndex}
            className="group rounded-xl border border-border bg-surface"
          >
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-5 gap-y-1 px-4 py-3 pointer-coarse:py-4 [&::-webkit-details-marker]:hidden">
              <span
                aria-hidden="true"
                className="text-muted transition-transform duration-150 group-open:rotate-90"
              >
                ▸
              </span>
              <span className="font-medium">Неделя {week.label}</span>
              <span className="flex flex-wrap gap-x-4 text-sm text-muted">
                {totals.map((t) => (
                  <span key={t.key}>
                    {t.label}:{" "}
                    <span
                      className={`font-medium tabular-nums ${toneText(toneOf(t.p))}`}
                    >
                      {t.fact}/{t.plan}
                    </span>{" "}
                    <span className="tabular-nums">({formatPct(t.p)})</span>
                  </span>
                ))}
              </span>
            </summary>

            <div className="overflow-x-auto border-t border-border">
              <table className="w-full min-w-[520px] table-fixed text-left">
                <colgroup>
                  <col className="w-[36%]" />
                  <col />
                  <col className="w-[4.5rem]" />
                  <col className="w-28" />
                </colgroup>
                <thead>
                  <tr className="text-[11px] text-muted">
                    <th className="px-2 py-1 font-medium">Сотрудник</th>
                    <th className="px-1 py-1 font-medium">Показатель</th>
                    <th className="px-1 py-1 text-center font-medium">План</th>
                    <th className="px-1 py-1 text-center font-medium">Факт</th>
                  </tr>
                </thead>
                <tbody>
                  {ordered.flatMap((person, pi) => {
                    const metrics = metricsFor(person.role);
                    // Первая строка первого ассистента — под жирной чертой,
                    // отделяющей их от менеджеров по развитию.
                    const firstAssistant =
                      development.length > 0 && pi === development.length;
                    return metrics.map((metric, mi) => {
                      const e = get(person.id, metric, week.start);
                      const ref = {
                        personId: person.id,
                        metric,
                        scope: "WEEK",
                        periodStart: week.start,
                      } as const;
                      const fallback = DEFAULT_METRIC_LABELS[metric];
                      const p = pct(e?.fact ?? 0, e?.plan ?? 0);
                      return (
                        <tr
                          key={`${person.id}-${metric}`}
                          className={
                            mi === 0
                              ? firstAssistant
                                ? "border-t-2 border-muted/40"
                                : "border-t border-border"
                              : "border-t border-border/50"
                          }
                        >
                          {mi === 0 ? (
                            <th
                              scope="row"
                              rowSpan={metrics.length}
                              className="px-1 py-1 align-top text-[13px] font-medium"
                            >
                              <span className="block px-1.5 py-0.5">
                                {person.name}
                              </span>
                            </th>
                          ) : null}
                          <td className="px-0.5 py-0.5">
                            <span className="block px-1.5 py-0.5 text-[13px] text-muted">
                              {e?.label || fallback}
                            </span>
                          </td>
                          <td className="px-0.5 py-0.5 text-center">
                            <div className="flex items-center justify-center gap-0.5">
                              <EntryNumber
                                entry={ref}
                                field="plan"
                                value={e ? e.plan : 0}
                                label={`${person.name}: ${fallback}, план, ${week.label}`}
                              />
                              {/* Примечание к плану — только у ассистента. */}
                              {person.role === "ASSISTANT" ? (
                                <NoteButton
                                  entry={ref}
                                  kind="plan"
                                  value={e?.planNote ?? ""}
                                  label={`${person.name}: примечание к плану, ${week.label}`}
                                />
                              ) : null}
                            </div>
                          </td>
                          <td className="px-0.5 py-0.5 text-center">
                            <div className="flex items-center justify-center gap-0.5">
                              <EntryNumber
                                entry={ref}
                                field="fact"
                                value={e ? e.fact : 0}
                                label={`${person.name}: ${fallback}, факт, ${week.label}`}
                              />
                              <span
                                className={`w-8 shrink-0 text-[11px] tabular-nums ${toneText(toneOf(p))}`}
                              >
                                {p === null ? "" : formatPct(p)}
                              </span>
                              <NoteButton
                                entry={ref}
                                kind="fact"
                                value={e?.factNote ?? ""}
                                label={`${person.name}: ${fallback}, примечание к факту, ${week.label}`}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>
            </div>
          </details>
        );
      })}
    </div>
  );
}
