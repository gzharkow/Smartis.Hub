"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { MONTH_NAMES } from "@/lib/kpi";

const pad = (n: number) => String(n).padStart(2, "0");

/** Кнопка «Экспорт в Excel»: панель с выбором месяцев и кварталов. Каждый
 * выбранный месяц и каждый выбранный квартал попадает в файл отдельным листом.
 * Файл отдаёт GET /api/kpi/export (сервер проверяет доступ к разделу). */
export function ExportPanel({ year, month }: { year: number; month: number }) {
  const [open, setOpen] = useState(false);
  const [shownYear, setShownYear] = useState(year);
  // Выбор хранится по всем годам сразу: можно отметить месяцы разных лет.
  const [months, setMonths] = useState<Set<string>>(
    () => new Set([`${year}-${pad(month)}`]),
  );
  const [quarters, setQuarters] = useState<Set<string>>(() => new Set());

  const toggle = (
    set: Set<string>,
    setter: (s: Set<string>) => void,
    key: string,
  ) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setter(next);
  };

  const total = months.size + quarters.size;
  const tooMany = total > 24;

  function download() {
    if (total === 0 || tooMany) return;
    const params = new URLSearchParams();
    if (months.size) params.set("months", [...months].sort().join(","));
    if (quarters.size) params.set("quarters", [...quarters].sort().join(","));
    // Ссылка-скачивание: браузер сохранит файл, страница не перезагрузится.
    const link = document.createElement("a");
    link.href = `/api/kpi/export?${params.toString()}`;
    link.download = "";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setOpen(false);
  }

  const box =
    "flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-sm transition duration-100 cursor-pointer select-none pointer-coarse:min-h-11";

  return (
    <div className="relative">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Экспорт в Excel
      </Button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-label="Экспорт KPI в Excel"
            className="absolute right-0 top-full z-40 mt-2 grid w-[min(24rem,calc(100vw-2rem))] gap-4 rounded-xl border border-border bg-surface p-4 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Что выгрузить</p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Предыдущий год"
                  onClick={() => setShownYear((y) => y - 1)}
                  className="flex size-8 items-center justify-center rounded-lg text-muted transition hover:bg-border/60 hover:text-foreground pointer-coarse:size-11"
                >
                  ‹
                </button>
                <span className="min-w-12 text-center text-sm font-medium tabular-nums">
                  {shownYear}
                </span>
                <button
                  type="button"
                  aria-label="Следующий год"
                  onClick={() => setShownYear((y) => y + 1)}
                  className="flex size-8 items-center justify-center rounded-lg text-muted transition hover:bg-border/60 hover:text-foreground pointer-coarse:size-11"
                >
                  ›
                </button>
              </div>
            </div>

            <fieldset className="grid gap-1.5">
              <legend className="mb-1 text-xs text-muted">
                Месяцы — каждый отдельным листом
              </legend>
              <div className="grid grid-cols-3 gap-1.5">
                {MONTH_NAMES.map((name, i) => {
                  const key = `${shownYear}-${pad(i + 1)}`;
                  const on = months.has(key);
                  return (
                    <label
                      key={key}
                      className={`${box} ${on ? "border-accent bg-accent/10" : "border-border hover:border-muted"}`}
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-[var(--accent-fill)]"
                        checked={on}
                        onChange={() => toggle(months, setMonths, key)}
                      />
                      {name}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="grid gap-1.5">
              <legend className="mb-1 text-xs text-muted">
                Кварталы — сводка отдельным листом
              </legend>
              <div className="grid grid-cols-4 gap-1.5">
                {[1, 2, 3, 4].map((q) => {
                  const key = `${shownYear}-${q}`;
                  const on = quarters.has(key);
                  return (
                    <label
                      key={key}
                      className={`${box} justify-center ${on ? "border-accent bg-accent/10" : "border-border hover:border-muted"}`}
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-[var(--accent-fill)]"
                        checked={on}
                        onChange={() => toggle(quarters, setQuarters, key)}
                      />
                      Q{q}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted">
                {tooMany
                  ? "Не больше 24 листов за раз"
                  : total === 0
                    ? "Отметьте месяцы или кварталы"
                    : `Листов в файле: ${total}`}
              </span>
              <div className="flex gap-1.5">
                {total > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setMonths(new Set());
                      setQuarters(new Set());
                    }}
                  >
                    Сбросить
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  disabled={total === 0 || tooMany}
                  onClick={download}
                >
                  Скачать .xlsx
                </Button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
