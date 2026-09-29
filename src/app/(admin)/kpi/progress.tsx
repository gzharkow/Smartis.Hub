import { formatPct, toneOf, type KpiTone } from "@/lib/kpi";

// Классы литеральные, не собираются из тона строкой: Tailwind видит только
// буквальные строки в исходниках.
const TEXT: Record<KpiTone, string> = {
  ok: "text-ok",
  warn: "text-warn",
  danger: "text-danger",
  none: "text-muted",
};
const FILL: Record<KpiTone, string> = {
  ok: "bg-ok-fill",
  warn: "bg-warn-fill",
  danger: "bg-danger-fill",
  none: "bg-muted",
};

export const toneText = (t: KpiTone) => TEXT[t];

/** Полоса «сколько выполнено от плана». Цвет — по проценту, но не только
 * цветом: рядом всегда стоит число процентов. */
export function ProgressBar({
  pct,
  label,
}: {
  pct: number | null;
  label?: string;
}) {
  const tone = toneOf(pct);
  const width = pct === null ? 0 : Math.min(100, Math.max(0, pct));
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(width)}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${FILL[tone]}`}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className={`w-11 shrink-0 text-right text-sm font-medium tabular-nums ${TEXT[tone]}`}>
        {formatPct(pct)}
      </span>
    </div>
  );
}
