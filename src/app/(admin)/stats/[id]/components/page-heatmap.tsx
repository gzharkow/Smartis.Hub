import { formatDuration, type PageHeat } from "@/lib/stats";

// Полный список литералов — важно, чтобы Tailwind нашёл их сканером
// исходников: собранный из шаблонной строки класс он не увидит.
const HEAT_BG = ["bg-heat-0", "bg-heat-1", "bg-heat-2", "bg-heat-3", "bg-heat-4"];

const LEGEND = [
  { level: 0, label: "не открывали" },
  { level: 4, label: "дольше всего" },
];

// Тепловая карта страниц PDF — по одной ячейке-столбику на страницу. Цвет
// пропорционален самой залипчивой странице документа (не абсолютной шкале),
// поэтому она читается одинаково и для 5-страничного, и для 80-страничного
// файла. `title` на каждой ячейке — это и есть доступность, которую просит
// ТЗ (скринридер/тултип со страницей и временем), без наведения мышью
// ничего не потеряно.
export function PageHeatmap({ pages }: { pages: PageHeat[] }) {
  if (pages.length === 0) return null;

  return (
    <div className="mt-3">
      <div className="flex h-7 items-end gap-[2px]">
        {pages.map((p) => (
          <i
            key={p.page}
            title={`Стр. ${p.page} — ${p.ms > 0 ? formatDuration(p.ms) : "не открывали"}`}
            className={`block h-full min-w-[2px] flex-1 rounded-sm not-italic motion-reduce:transition-none ${HEAT_BG[p.level]}`}
          />
        ))}
      </div>
      <div className="mt-1.5 flex items-center gap-3 font-mono text-[10px] text-muted">
        <span className="flex items-center gap-1">
          <span className={`block h-2 w-3 rounded-sm ${HEAT_BG[LEGEND[0].level]}`} />
          {LEGEND[0].label}
        </span>
        <span className="flex items-center gap-1">
          <span className={`block h-2 w-3 rounded-sm ${HEAT_BG[LEGEND[1].level]}`} />
          {LEGEND[1].label}
        </span>
        <span className="ml-auto">{pages.length} стр.</span>
      </div>
    </div>
  );
}
