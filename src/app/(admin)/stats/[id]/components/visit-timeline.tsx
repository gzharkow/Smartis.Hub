import {
  formatDuration,
  formatEventTime,
  formatVisitWhen,
  type VisitTimelineEntry,
} from "@/lib/stats";

// Заходов может накопиться много (десятки за пару недель) — список тогда
// сам по себе растягивает дашборд на полстраницы. Секцию целиком тоже
// сворачиваем, коротким спискам оставляем сразу открытыми: их и так удобно
// проглядеть, а разворачивать одну строку ради того, чтобы что-то увидеть,
// лишнее действие.
const COMPACT_THRESHOLD = 5;

// <details>/<summary> вместо самодельного аккордеона на клиенте: данные уже
// посчитаны на сервере целиком, а нативный элемент бесплатно даёт
// клавиатурную доступность и фокус, которых просит ТЗ — и для строк визитов,
// и для всей секции.
export function VisitTimeline({ visits }: { visits: VisitTimelineEntry[] }) {
  if (visits.length === 0) return null;

  return (
    <details className="group/section" open={visits.length <= COMPACT_THRESHOLD}>
      <summary className="mb-2 flex cursor-pointer list-none items-center gap-2 text-sm font-semibold tracking-tight text-muted uppercase marker:content-none">
        Хронология заходов ({visits.length})
        <span className="font-mono text-[10px] normal-case group-open/section:hidden">
          показать →
        </span>
      </summary>

      <ul className="grid gap-2">
        {visits
          .slice()
          .reverse()
          .map((visit) => {
            const durationMs = visit.lastSeenAt.getTime() - visit.startedAt.getTime();
            return (
              <li key={visit.visitId}>
                <details className="group rounded-lg border border-border px-3 py-2">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 text-sm marker:content-none">
                    <span className="font-medium">{visit.personOrdinal}-й посетитель</span>
                    <span className="text-muted">{formatVisitWhen(visit.startedAt)}</span>
                    <span className="font-mono text-xs tabular-nums text-muted">
                      {formatDuration(Math.max(0, durationMs))}
                    </span>
                    <span className="ml-auto text-xs text-muted group-open:hidden">
                      Показать →
                    </span>
                  </summary>

                  {visit.chips.length > 0 ? (
                    <ol className="mt-2 grid gap-1 border-t border-border pt-2">
                      {visit.chips.map((chip, idx) => (
                        <li key={idx} className="flex items-baseline gap-2 text-xs">
                          <span className="font-mono text-muted">
                            {formatEventTime(chip.at)}
                          </span>
                          <span>{chip.label}</span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="mt-2 border-t border-border pt-2 text-xs text-muted">
                      Заходил, но не открывал материалы.
                    </p>
                  )}
                </details>
              </li>
            );
          })}
      </ul>
    </details>
  );
}
