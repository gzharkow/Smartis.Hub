"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatStatsRange, toISODate, type StatsRange } from "@/lib/stats-range";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTHS = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

const PRESETS = [
  { label: "7 дней", days: 7 },
  { label: "14 дней", days: 14 },
  { label: "30 дней", days: 30 },
  { label: "90 дней", days: 90 },
];

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Сетка одного месяца: null — клетки до 1-го числа, неделя с понедельника. */
function monthGrid(monthDate: Date): (Date | null)[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  return cells;
}

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-4 shrink-0 text-muted"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
    </svg>
  );
}

/**
 * Поле «за какой период смотреть статистику»: показывает выбранный диапазон,
 * по нажатию раскрывает календарь. Период живёт в адресе (`?from=&to=`),
 * применяется на сервере — здесь только выбор дат и переход по ссылке.
 */
export function StatsRangePicker({ range }: { range: StatsRange }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState<Date | null>(range?.from ?? null);
  const [draftTo, setDraftTo] = useState<Date | null>(
    range ? startOfDay(range.to) : null,
  );
  const [cursor, setCursor] = useState<Date>(
    range?.from ?? new Date(),
  );

  const boxRef = useRef<HTMLDivElement>(null);
  const outsideHandlerRef = useRef<((e: MouseEvent) => void) | null>(null);

  function closeDropdown() {
    setOpen(false);
    if (outsideHandlerRef.current) {
      document.removeEventListener("mousedown", outsideHandlerRef.current);
      outsideHandlerRef.current = null;
    }
  }

  function openDropdown() {
    // Открываем заново от текущего применённого диапазона — прошлый черновик
    // не должен пережить закрытие без применения.
    setDraftFrom(range?.from ?? null);
    setDraftTo(range ? startOfDay(range.to) : null);
    setCursor(range?.from ?? new Date());
    setOpen(true);
    if (outsideHandlerRef.current) return;
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    };
    outsideHandlerRef.current = handler;
    document.addEventListener("mousedown", handler);
  }

  function goTo(from: Date | null, to: Date | null) {
    const params = new URLSearchParams(searchParams);
    if (from && to) {
      params.set("from", toISODate(from));
      params.set("to", toISODate(to));
    } else {
      params.delete("from");
      params.delete("to");
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    closeDropdown();
  }

  function pickDay(day: Date) {
    // Первый клик — начало нового диапазона. Второй — конец, в любом
    // порядке (более ранняя дата сама встаёт вперёд).
    if (!draftFrom || draftTo) {
      setDraftFrom(day);
      setDraftTo(null);
      return;
    }
    if (day < draftFrom) {
      setDraftTo(draftFrom);
      setDraftFrom(day);
    } else {
      setDraftTo(day);
    }
  }

  function pickPreset(days: number) {
    const to = startOfDay(new Date());
    const from = new Date(to.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
    goTo(from, to);
  }

  const grid = monthGrid(cursor);

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => (open ? closeDropdown() : openDropdown())}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm transition hover:border-muted"
      >
        <CalendarIcon />
        {formatStatsRange(range)}
      </button>

      {open ? (
        // Кнопка стоит у правого края шапки только на широких экранах — там
        // и якорим вправо (right-0). На узких шапка переносится, и кнопка
        // уезжает к левому краю: якорь вправо в этом случае утаскивал бы
        // календарь за пределы экрана влево (right-0 отсчитывает от левого
        // края кнопки, а не от края экрана). left-0 + ограничение по ширине
        // экрана держат его в видимой области на любом устройстве.
        <div className="absolute top-full left-0 z-20 mt-1.5 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-surface p-3 shadow-lg sm:left-auto sm:right-0">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => pickPreset(p.days)}
                className="rounded-full border border-border px-2.5 py-1 text-xs transition hover:bg-border/60"
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => goTo(null, null)}
              className="rounded-full border border-border px-2.5 py-1 text-xs text-muted transition hover:bg-border/60"
            >
              Весь период
            </button>
          </div>

          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() =>
                setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
              }
              aria-label="Предыдущий месяц"
              className="grid size-6 place-items-center rounded text-muted transition hover:bg-border/60 hover:text-foreground"
            >
              ‹
            </button>
            <span className="text-sm font-medium">
              {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
            </span>
            <button
              type="button"
              onClick={() =>
                setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
              }
              aria-label="Следующий месяц"
              className="grid size-6 place-items-center rounded text-muted transition hover:bg-border/60 hover:text-foreground"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-y-0.5 text-center text-xs">
            {WEEKDAYS.map((w) => (
              <span key={w} className="py-1 text-muted">
                {w}
              </span>
            ))}

            {grid.map((day, i) => {
              if (!day) return <span key={`empty-${i}`} />;

              const isFrom = draftFrom && sameDay(day, draftFrom);
              const isTo = draftTo && sameDay(day, draftTo);
              const inRange =
                draftFrom && draftTo && day > draftFrom && day < draftTo;
              const isToday = sameDay(day, new Date());

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => pickDay(day)}
                  className={`grid size-8 place-items-center rounded-full text-sm transition ${
                    isFrom || isTo
                      ? "bg-blue-600 font-medium text-white"
                      : inRange
                        ? "bg-blue-500/15"
                        : "hover:bg-border/60"
                  } ${isToday && !isFrom && !isTo ? "font-semibold text-blue-600 dark:text-blue-400" : ""}`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-xs text-muted">
              {draftFrom
                ? draftTo
                  ? formatStatsRange({ from: draftFrom, to: draftTo })
                  : "Выберите конец периода"
                : "Выберите начало периода"}
            </span>
            <button
              type="button"
              disabled={!draftFrom || !draftTo}
              onClick={() => goTo(draftFrom, draftTo)}
              className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              Применить
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
