import type { DonutSegment } from "@/lib/stats";

// Кольцевая диаграмма от руки — в проекте нет библиотеки графиков и ТЗ
// прямо просит не заводить новую. Сегменты — через stroke-dasharray/-offset,
// начало в 12 часов за счёт поворота -90°. `total` может быть больше суммы
// сегментов (кольцо «глубина прочтения»): непокрытый остаток само собой
// остаётся цветом трека — рисовать «недостающий» сегмент отдельно не нужно.
export function DonutChart({
  segments,
  total,
  centerLabel,
  centerSub,
  size = 132,
  strokeWidth = 18,
  legend = true,
}: {
  segments: DonutSegment[];
  total?: number;
  centerLabel: string;
  centerSub?: string;
  size?: number;
  strokeWidth?: number;
  legend?: boolean;
}) {
  const sum = segments.reduce((s, seg) => s + seg.value, 0);
  const denom = total && total > sum ? total : sum;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;

  let cumulative = 0;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
      <div className="relative mx-auto shrink-0 sm:mx-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90 motion-reduce:transition-none"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={strokeWidth}
            className="text-heat-0"
            stroke="currentColor"
          />
          {denom > 0
            ? segments.map((seg, idx) => {
                if (seg.value <= 0) return null;
                const dash = (seg.value / denom) * circumference;
                const offset = -cumulative;
                cumulative += dash;
                return (
                  <circle
                    key={`${seg.label}-${idx}`}
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${dash} ${circumference - dash}`}
                    strokeDashoffset={offset}
                    className={seg.colorClass}
                    stroke="currentColor"
                  />
                );
              })
            : null}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="font-mono text-xl font-bold tabular-nums">{centerLabel}</p>
          {centerSub ? <p className="mt-0.5 text-[11px] text-muted">{centerSub}</p> : null}
        </div>
      </div>

      {legend && segments.length > 0 ? (
        <ul className="grid w-full min-w-0 gap-1.5 sm:flex-1">
          {segments.map((seg, idx) => (
            <li key={`${seg.label}-${idx}`} className="flex min-w-0 items-center gap-2 text-xs">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-sm bg-current ${seg.colorClass}`} />
              <span className="min-w-0 flex-1 truncate">{seg.label}</span>
              <span className="shrink-0 font-mono tabular-nums text-muted">{seg.valueLabel}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
