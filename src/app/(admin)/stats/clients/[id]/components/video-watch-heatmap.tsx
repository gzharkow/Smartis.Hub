import type { VideoWatchStat } from "@/lib/stats";
import { withPlural, WORDS } from "@/lib/plural";

// Тот же цветовой ряд, что и у PageHeatmap — одна визуальная система для
// обеих тепловых карт (страницы PDF / вехи видео), просто другая метрика.
const HEAT_BG = ["bg-heat-0", "bg-heat-1", "bg-heat-2", "bg-heat-3", "bg-heat-4"];

/**
 * Воронка глубины просмотра видео: 4 столбика — 25/50/75/100% ролика,
 * цвет пропорционален доле сеансов, дошедших до этой вехи. В отличие от
 * PageHeatmap (там ячейка — страница), здесь ячейка — фиксированная веха,
 * их всегда четыре, независимо от длины ролика.
 */
export function VideoWatchHeatmap({ watch }: { watch: VideoWatchStat }) {
  if (watch.sessions === 0) return null;

  return (
    <div className="mt-3">
      <div className="flex h-7 items-end gap-1">
        {watch.milestones.map((m) => (
          <i
            key={m.pct}
            title={`${m.pct}% ролика — досмотрели ${m.reached} из ${watch.sessions}`}
            className={`block h-full min-w-[2px] flex-1 rounded-sm not-italic motion-reduce:transition-none ${HEAT_BG[m.level]}`}
          />
        ))}
      </div>
      <div className="mt-1.5 flex items-center gap-3 font-mono text-[10px] text-muted">
        {watch.milestones.map((m) => (
          <span key={m.pct}>{m.pct}%</span>
        ))}
        <span className="ml-auto">{withPlural(watch.sessions, WORDS.visit)}</span>
      </div>
    </div>
  );
}
