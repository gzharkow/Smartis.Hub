import { formatDuration, type ItemStats } from "@/lib/stats";

// Горизонтальный бар-чарт «рейтинг материалов по времени» — тот же паттерн
// трека, что и в PageHeatmap/старой полосе дочитывания (bg-heat-0 трек +
// закрашенная полоса), просто вынесенный в переиспользуемый компонент.
// `items` приходит уже отсортированным по totalMs (см. hubDetail) — здесь
// только масштабирование ширины под максимум, это презентационная, не
// метрическая величина.
export function RankedBarChart({ items }: { items: ItemStats[] }) {
  const withTime = items.filter((i) => i.totalMs > 0);
  if (withTime.length === 0) return null;

  const max = withTime[0].totalMs;

  return (
    <ul className="grid gap-2">
      {withTime.map((item) => (
        <li key={item.assetId} className="grid grid-cols-[1fr_auto] items-center gap-3 text-sm">
          <div className="min-w-0">
            <p className="truncate">{item.title}</p>
            <span className="block h-2 overflow-hidden rounded-full bg-heat-0">
              <span
                className="block h-full rounded-full bg-heat-3"
                style={{ width: `${Math.max(2, Math.round((item.totalMs / max) * 100))}%` }}
              />
            </span>
          </div>
          <span className="shrink-0 font-mono text-xs tabular-nums text-muted">
            {formatDuration(item.totalMs)}
          </span>
        </li>
      ))}
    </ul>
  );
}
