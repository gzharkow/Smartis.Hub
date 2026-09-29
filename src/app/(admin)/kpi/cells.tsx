"use client";

import { useRef, useState, useTransition } from "react";
import { saveEntry, saveMonthPlan } from "@/app/actions/kpi";

// Инлайн-ячейки: правка по месту, сохранение по потере фокуса или Enter.
// Пока сохраняется — ячейка чуть притушена; при ошибке возвращаем старое
// значение и показываем красную рамку.

const INPUT =
  "rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-[13px] tabular-nums " +
  "transition duration-100 hover:border-border focus:border-accent focus:bg-background focus:outline-none " +
  "pointer-coarse:py-2";

/** Прочерк в ячейке: «-», «–», «—» (после обрезки пробелов). */
const isDash = (raw: string) => /^[-–—]$/.test(raw.trim());

function digits(raw: string): number {
  const n = Number(raw.replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

const spaced = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

function useSave() {
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  function run(fn: () => Promise<void>) {
    setFailed(false);
    start(async () => {
      try {
        await fn();
      } catch {
        setFailed(true);
      }
    });
  }
  return { pending, failed, run };
}

type EntryRef = {
  personId: string;
  metric: "MEETINGS" | "QUALIFIED" | "DEALS";
  scope: "WEEK" | "MONTH";
  periodStart: string;
};

/** Число: план или факт записи. Можно поставить «-» (прочерк): значение
 * пустое, в итоги идёт как 0, процент не считается. */
export function EntryNumber({
  entry,
  field,
  value,
  label,
}: {
  entry: EntryRef;
  field: "plan" | "fact";
  value: number | null;
  label: string;
}) {
  const { pending, failed, run } = useSave();
  const shown = value === null ? "-" : String(value);
  return (
    <input
      key={shown}
      defaultValue={shown}
      inputMode="text"
      aria-label={label}
      aria-invalid={failed}
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      onBlur={(e) => {
        const raw = e.currentTarget.value;
        const next = isDash(raw) ? null : digits(raw);
        e.currentTarget.value = next === null ? "-" : String(next);
        if (next !== value) run(() => saveEntry({ ...entry, [field]: next }));
      }}
      className={`${INPUT} w-12 text-center ${pending ? "opacity-50" : ""} ${failed ? "border-danger" : ""}`}
    />
  );
}

/** Примечание к ячейке: значок «!» рядом с планом/фактом. По клику — окошко
 * с текстом (например, названия компаний, из которых сложилась цифра).
 * Сохраняется при закрытии, если текст изменился; пустой текст стирает
 * примечание. Окошко — position: fixed, чтобы не обрезаться границей таблицы. */
export function NoteButton({
  entry,
  kind,
  value,
  label,
}: {
  entry: EntryRef;
  kind: "fact" | "plan";
  value: string;
  label: string;
}) {
  const { pending, failed, run } = useSave();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [pos, setPos] = useState({ left: 8, top: 8, width: 288 });
  const btn = useRef<HTMLButtonElement>(null);
  const has = value.trim() !== "";

  function show() {
    const r = btn.current?.getBoundingClientRect();
    if (r) {
      const width = Math.min(288, window.innerWidth - 16);
      const left = Math.min(
        Math.max(8, r.right - width),
        window.innerWidth - width - 8,
      );
      // Не помещается снизу — открываем над кнопкой.
      const top =
        r.bottom + 6 + 190 > window.innerHeight
          ? Math.max(8, r.top - 196)
          : r.bottom + 6;
      setPos({ left, top, width });
    }
    setDraft(value);
    setOpen(true);
  }

  function close() {
    setOpen(false);
    const next = draft.trim();
    if (next !== value.trim()) {
      run(() =>
        saveEntry({
          ...entry,
          [kind === "fact" ? "factNote" : "planNote"]: next,
        }),
      );
    }
  }

  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={show}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={has ? value : "Добавить примечание"}
        className={`flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] leading-none font-bold transition duration-100 pointer-coarse:size-8 ${
          has
            ? "border-accent bg-accent-fill text-on-accent"
            : "border-border text-muted hover:border-muted hover:text-foreground"
        } ${pending ? "opacity-50" : ""} ${failed ? "border-danger" : ""}`}
      >
        !
      </button>
      {open ? (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={close}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-label={label}
            style={{ left: pos.left, top: pos.top, width: pos.width }}
            className="fixed z-50 grid gap-2 rounded-xl border border-border bg-surface p-3 text-left shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
          >
            <textarea
              autoFocus
              value={draft}
              rows={4}
              maxLength={500}
              placeholder="Примечание, например названия компаний"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Escape" ||
                  (e.key === "Enter" && (e.ctrlKey || e.metaKey))
                ) {
                  e.preventDefault();
                  close();
                }
              }}
              className="w-full resize-none rounded-md border border-border bg-background p-2 text-[13px] leading-snug placeholder:text-muted focus:border-accent focus:outline-none"
            />
            <div className="flex items-center justify-between gap-2 text-xs text-muted">
              <span>{draft.length}/500</span>
              <div className="flex gap-1">
                {draft.trim() ? (
                  <button
                    type="button"
                    onClick={() => setDraft("")}
                    className="rounded-md px-2 py-1 transition hover:bg-border/60 hover:text-foreground"
                  >
                    Очистить
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={close}
                  className="rounded-md bg-accent-fill px-2.5 py-1 font-medium text-on-accent transition hover:bg-accent-fill-hover"
                >
                  Готово
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}

export type MonthPlanValues = {
  planOptimal: number;
  planMax: number;
  planOptimalAuto: number;
  planMaxAuto: number;
};

/** Деньги: план месяца (общий и «Авто», оптимум и максимум). Четвёрка
 * сохраняется целиком, меняется одно поле. */
export function MonthPlanMoney({
  year,
  month,
  plan,
  field,
  label,
}: {
  year: number;
  month: number;
  plan: MonthPlanValues;
  field: keyof MonthPlanValues;
  label: string;
}) {
  const { pending, failed, run } = useSave();
  const value = plan[field];
  return (
    <input
      key={value}
      defaultValue={spaced(value)}
      inputMode="numeric"
      aria-label={label}
      aria-invalid={failed}
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      onBlur={(e) => {
        const next = digits(e.currentTarget.value);
        e.currentTarget.value = spaced(next);
        if (next === value) return;
        run(() => saveMonthPlan({ year, month, ...plan, [field]: next }));
      }}
      className={`${INPUT} w-24 text-right ${pending ? "opacity-50" : ""} ${failed ? "border-danger" : ""}`}
    />
  );
}
