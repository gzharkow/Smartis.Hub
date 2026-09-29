"use client";

import { useState, useTransition } from "react";
import { deleteDeal, promoteReserve, saveDeal } from "@/app/actions/kpi";
import { plural } from "@/lib/plural";
import { MONTH_NAMES, formatRub, type Ym } from "@/lib/kpi";
import type { KpiDealRow } from "@/lib/kpi-data";

type Direction = "AUTO" | "REALTY" | null;

// Компактно: шрифт 13px, узкие отступы. Строка сделки — две линии (клиент и
// сумма; месяц, направление, менеджер, заметка), а в широком контейнере
// (@3xl, ≥768px) обе линии сливаются в одну. Так форма умещается в половину
// экрана без горизонтальной прокрутки и без обрезания текста.
const FIELD =
  "min-w-0 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-[13px] " +
  "transition duration-100 hover:border-border focus:border-accent focus:bg-background focus:outline-none " +
  "pointer-coarse:py-2";

const digits = (raw: string) => Number(raw.replace(/[^\d]/g, "")) || 0;
const spaced = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

const monthKey = (m: Ym) => `${m.year}-${m.month}`;
const monthTitle = (m: Ym) => `${MONTH_NAMES[m.month - 1]} ${m.year}`;

// Раскладка строки: линия 1 — главное, линия 2 — детали.
const ROW =
  "flex flex-wrap items-center gap-x-1 gap-y-0.5 border-t border-border px-2 py-1 @3xl:flex-nowrap";
const LINE1 =
  "flex min-w-0 basis-full items-center gap-1 @3xl:flex-[3_1_0%] @3xl:basis-0";
const LINE2 =
  "flex min-w-0 basis-full flex-wrap items-center gap-1 pl-6 @3xl:flex-[4_1_0%] @3xl:basis-0 @3xl:flex-nowrap @3xl:pl-0";

type Draft = {
  client: string;
  amount: number;
  direction: Direction;
  managerName: string;
  note: string;
};

function DirectionSelect({
  value,
  onChange,
}: {
  value: Direction;
  onChange: (v: Direction) => void;
}) {
  return (
    <select
      value={value ?? ""}
      aria-label="Направление"
      onChange={(e) => onChange((e.target.value || null) as Direction)}
      className={`${FIELD} w-[9rem] shrink-0`}
    >
      <option value="">Направление</option>
      <option value="AUTO">Авто</option>
      <option value="REALTY">Недвижимость</option>
    </select>
  );
}

/** Выбор месяца сделки из месяцев квартала. */
function MonthSelect({
  value,
  months,
  onChange,
  label,
}: {
  value: Ym;
  months: Ym[];
  onChange: (m: Ym) => void;
  label: string;
}) {
  return (
    <select
      value={monthKey(value)}
      aria-label={label}
      onChange={(e) => {
        const m = months.find((x) => monthKey(x) === e.target.value);
        if (m) onChange(m);
      }}
      className={`${FIELD} w-[6.75rem] shrink-0`}
    >
      {months.map((m) => (
        <option key={monthKey(m)} value={monthKey(m)}>
          {MONTH_NAMES[m.month - 1]}
        </option>
      ))}
    </select>
  );
}

function RowActions({
  reserve,
  deal,
  selected,
  start,
}: {
  reserve: boolean;
  deal: KpiDealRow;
  selected: Ym;
  start: (cb: () => Promise<void>) => void;
}) {
  return (
    <>
      {reserve ? (
        <button
          type="button"
          title={`Превратить в сделку: ${monthTitle(selected)}`}
          onClick={() =>
            start(() => promoteReserve(deal.id, selected.year, selected.month))
          }
          className="rounded-md px-1.5 py-0.5 text-xs text-accent transition hover:bg-accent/10 pointer-coarse:py-2"
        >
          → В сделки
        </button>
      ) : null}
      <button
        type="button"
        aria-label={`Удалить «${deal.client}»`}
        onClick={() => {
          if (!window.confirm(`Удалить «${deal.client}»?`)) return;
          start(() => deleteDeal(deal.id));
        }}
        className="rounded-md px-1.5 py-0.5 text-muted transition hover:bg-danger/10 hover:text-danger pointer-coarse:px-2.5 pointer-coarse:py-2"
      >
        ×
      </button>
    </>
  );
}

/** Выбор менеджера сделки из участников с галочкой «Менеджер». Если у сделки
 * уже записано имя, которого нет в списке (например, участника переименовали),
 * оно остаётся отдельным пунктом, чтобы данные не терялись. */
function ManagerSelect({
  value,
  managers,
  onChange,
  label,
}: {
  value: string;
  managers: string[];
  onChange: (v: string) => void;
  label: string;
}) {
  const options =
    value && !managers.includes(value) ? [value, ...managers] : managers;
  return (
    <select
      value={value}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
      className={`${FIELD} min-w-28 flex-1`}
    >
      <option value="">Менеджер</option>
      {options.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
  );
}

function DealRow({
  deal,
  months,
  selected,
  reserve,
  managers,
}: {
  deal: KpiDealRow;
  /** Имена менеджеров для выпадающего списка. */
  managers: string[];
  /** Месяцы квартала (для выбора месяца сделки); у резерва не нужны. */
  months: Ym[];
  /** Выбранный на странице месяц — куда «→ В сделки» переводит резерв. */
  selected: Ym;
  reserve: boolean;
}) {
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Draft>({
    client: deal.client,
    amount: deal.amount,
    direction: deal.direction,
    managerName: deal.managerName,
    note: deal.note,
  });

  function save(patch: Partial<Draft> & { month?: Ym; confirmed?: boolean }) {
    const next = { ...draft, ...patch };
    setDraft({
      client: next.client,
      amount: next.amount,
      direction: next.direction,
      managerName: next.managerName,
      note: next.note,
    });
    if (!next.client.trim()) {
      setDraft(draft);
      return;
    }
    const month = patch.month ?? { year: deal.year, month: deal.month };
    const confirmed = patch.confirmed ?? deal.confirmed;
    const same =
      next.client === deal.client &&
      next.amount === deal.amount &&
      next.direction === deal.direction &&
      next.managerName === deal.managerName &&
      next.note === deal.note &&
      month.year === deal.year &&
      month.month === deal.month &&
      confirmed === deal.confirmed;
    if (same) return;
    start(async () => {
      try {
        await saveDeal({
          id: deal.id,
          year: month.year,
          month: month.month,
          isReserve: deal.isReserve,
          confirmed,
          client: next.client,
          amount: next.amount,
          direction: next.direction,
          managerName: next.managerName,
          note: next.note,
        });
      } catch {
        setDraft(draft);
      }
    });
  }

  const pendingSign = !reserve && !deal.confirmed;
  const fromEarlier =
    reserve && (deal.year !== selected.year || deal.month !== selected.month);
  const actions = (
    <RowActions
      reserve={reserve}
      deal={deal}
      selected={selected}
      start={start}
    />
  );

  return (
    <div
      className={`${ROW} ${pending ? "opacity-50" : ""} ${pendingSign ? "bg-warn/5" : ""}`}
    >
      <div className={LINE1}>
        {reserve ? null : (
          <input
            type="checkbox"
            className="size-4 shrink-0 accent-[var(--accent-fill)]"
            checked={deal.confirmed}
            aria-label={`Договор подписан: ${deal.client}`}
            title={
              deal.confirmed
                ? "Договор подписан — сделка остаётся в этом месяце"
                : "Ожидает подписания: отметьте, когда договор подписан"
            }
            onChange={(e) => save({ confirmed: e.target.checked })}
          />
        )}
        <div className="min-w-0 flex-1">
          <input
            value={draft.client}
            aria-label="Клиент"
            placeholder="Клиент"
            onChange={(e) => setDraft({ ...draft, client: e.target.value })}
            onBlur={() => save({})}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            className={`${FIELD} w-full font-medium`}
          />
          {fromEarlier ? (
            <span className="block px-1.5 text-[11px] leading-tight text-muted">
              в резерве с {monthTitle({ year: deal.year, month: deal.month })}
            </span>
          ) : null}
        </div>
        <input
          defaultValue={spaced(draft.amount)}
          key={deal.amount}
          inputMode="numeric"
          aria-label="Сумма"
          onFocus={(e) => e.currentTarget.select()}
          onBlur={(e) => {
            const n = digits(e.currentTarget.value);
            e.currentTarget.value = spaced(n);
            save({ amount: n });
          }}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className={`${FIELD} w-24 shrink-0 text-right tabular-nums`}
        />
        <span className="shrink-0 whitespace-nowrap @3xl:hidden">
          {actions}
        </span>
      </div>
      <div className={LINE2}>
        {reserve ? null : (
          <MonthSelect
            value={{ year: deal.year, month: deal.month }}
            months={months}
            label={`Месяц сделки: ${deal.client}`}
            onChange={(m) => save({ month: m })}
          />
        )}
        <DirectionSelect
          value={draft.direction}
          onChange={(v) => save({ direction: v })}
        />
        {reserve ? null : (
          <ManagerSelect
            value={draft.managerName}
            managers={managers}
            label="Менеджер"
            onChange={(v) => save({ managerName: v })}
          />
        )}
        <input
          value={draft.note}
          placeholder="Заметка"
          aria-label="Заметка"
          onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          onBlur={() => save({})}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className={`${FIELD} min-w-24 flex-1 placeholder:text-muted`}
        />
        <span className="hidden shrink-0 whitespace-nowrap @3xl:inline">
          {actions}
        </span>
      </div>
    </div>
  );
}

function AddRow({
  months,
  selected,
  reserve,
  managers,
}: {
  managers: string[];
  months: Ym[];
  selected: Ym;
  reserve: boolean;
}) {
  const [pending, start] = useTransition();
  const [month, setMonth] = useState<Ym>(selected);
  const [client, setClient] = useState("");
  const [amount, setAmount] = useState(0);
  const [direction, setDirection] = useState<Direction>(null);
  const [managerName, setManagerName] = useState("");
  const [note, setNote] = useState("");

  function add() {
    if (!client.trim()) return;
    start(async () => {
      try {
        await saveDeal({
          year: reserve ? selected.year : month.year,
          month: reserve ? selected.month : month.month,
          client,
          amount,
          direction,
          managerName,
          note,
          isReserve: reserve,
          confirmed: false,
        });
        setClient("");
        setAmount(0);
        setNote("");
        setManagerName("");
      } catch {
        /* остаёмся с введёнными данными */
      }
    });
  }

  const addButton = (
    <button
      type="button"
      onClick={add}
      disabled={!client.trim()}
      aria-label="Добавить"
      className="shrink-0 rounded-md px-2 py-0.5 text-lg leading-none text-accent transition hover:bg-accent/10 disabled:opacity-30 pointer-coarse:px-3 pointer-coarse:py-1.5"
    >
      +
    </button>
  );

  return (
    <div
      className={`${ROW} border-t-2 bg-background/40 ${pending ? "opacity-50" : ""}`}
    >
      <div className={LINE1}>
        {reserve ? null : (
          <span className="size-4 shrink-0" aria-hidden="true" />
        )}
        <input
          value={client}
          placeholder={reserve ? "Клиент в резерве" : "Новая сделка: клиент"}
          aria-label="Клиент новой сделки"
          onChange={(e) => setClient(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          className={`${FIELD} min-w-0 flex-1 placeholder:text-muted`}
        />
        <input
          value={amount ? spaced(amount) : ""}
          placeholder="Сумма"
          inputMode="numeric"
          aria-label="Сумма новой сделки"
          onChange={(e) => setAmount(digits(e.target.value))}
          onKeyDown={(e) => e.key === "Enter" && add()}
          className={`${FIELD} w-24 shrink-0 text-right tabular-nums placeholder:text-muted`}
        />
        <span className="@3xl:hidden">{addButton}</span>
      </div>
      <div className={LINE2}>
        {reserve ? null : (
          <MonthSelect
            value={month}
            months={months}
            label="Месяц новой сделки"
            onChange={setMonth}
          />
        )}
        <DirectionSelect value={direction} onChange={setDirection} />
        {reserve ? null : (
          <ManagerSelect
            value={managerName}
            managers={managers}
            label="Менеджер новой сделки"
            onChange={setManagerName}
          />
        )}
        <input
          value={note}
          placeholder="Заметка"
          aria-label="Заметка новой сделки"
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          className={`${FIELD} min-w-24 flex-1 placeholder:text-muted`}
        />
        <span className="hidden @3xl:inline">{addButton}</span>
      </div>
    </div>
  );
}

/** Сквозная форма сделок квартала: одна форма, внутри — разбивка по месяцам
 * (заголовок с суммой). Месяц сделки выбирается в её строке; галочка
 * «Подписан» — пометка, что договор подписан (в итоги не влияет). */
export function DealsForm({
  deals,
  months,
  selected,
  managers,
}: {
  deals: KpiDealRow[];
  /** Имена участников с галочкой «Менеджер» — пункты выпадающего списка. */
  managers: string[];
  /** Месяцы квартала. */
  months: Ym[];
  /** Выбранный на странице месяц — раскрыт и подсвечен, остальные свёрнуты. */
  selected: Ym;
}) {
  const [open, setOpen] = useState<Set<string>>(
    () => new Set([monthKey(selected)]),
  );
  const toggle = (k: string) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  return (
    <div className="@container">
      {months.map((m) => {
        const k = monthKey(m);
        const rows = deals.filter(
          (d) => d.year === m.year && d.month === m.month,
        );
        const sum = rows.reduce((s, d) => s + d.amount, 0);
        const unsigned = rows.filter((d) => !d.confirmed).length;
        const isOpen = open.has(k);
        const isSelected = k === monthKey(selected);
        return (
          <div key={k} className="border-t-2 border-border">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => toggle(k)}
              className={`flex w-full flex-wrap items-center gap-x-3 gap-y-0.5 bg-surface px-3 py-1.5 text-left text-[13px] transition hover:bg-border/30 ${
                isSelected ? "font-medium text-foreground" : "text-muted"
              }`}
            >
              <span
                aria-hidden="true"
                className={`transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`}
              >
                ▸
              </span>
              <span>{monthTitle(m)}</span>
              <span className="tabular-nums">{formatRub(sum)}</span>
              <span className="text-xs">
                {rows.length}{" "}
                {plural(rows.length, ["сделка", "сделки", "сделок"])}
                {unsigned > 0 ? ` · ожидают подписания: ${unsigned}` : ""}
              </span>
            </button>
            {isOpen
              ? rows.map((d) => (
                  <DealRow
                    key={`${d.id}-${d.client}-${d.amount}-${d.direction}-${d.managerName}-${d.note}-${d.confirmed}-${d.year}-${d.month}`}
                    deal={d}
                    months={months}
                    selected={selected}
                    reserve={false}
                    managers={managers}
                  />
                ))
              : null}
          </div>
        );
      })}
      <AddRow
        months={months}
        selected={selected}
        reserve={false}
        managers={managers}
      />
    </div>
  );
}

/** Резерв выбранного месяца (не сквозной): ожидаемые сделки; не ставшие
 * сделкой автоматически видны и в следующих месяцах. В итоги не входят. */
export function ReserveTable({
  deals,
  selected,
}: {
  deals: KpiDealRow[];
  selected: Ym;
}) {
  return (
    <div className="@container">
      {deals.map((d) => (
        <DealRow
          key={`${d.id}-${d.client}-${d.amount}-${d.direction}-${d.note}-${d.year}-${d.month}`}
          deal={d}
          months={[]}
          selected={selected}
          reserve
          managers={[]}
        />
      ))}
      <AddRow months={[]} selected={selected} reserve managers={[]} />
    </div>
  );
}
