// Обобщение <dl>-плитки, уже использовавшейся на странице (и в
// QuoteTotalsSummary калькулятора) — плюс вариант `flag` для сигналов,
// требующих внимания менеджера (жёлтая плитка «время на материалах»).
export function KpiTile({
  label,
  value,
  sub,
  hint,
  flag = false,
}: {
  label: string;
  value: string;
  sub?: string;
  hint?: string;
  flag?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        flag
          ? "border-amber-300 bg-amber-500/10 dark:border-amber-700 dark:bg-amber-500/10"
          : "border-border bg-surface"
      }`}
      title={hint}
    >
      <p className="font-mono text-[11px] tracking-wide text-muted uppercase">{label}</p>
      <p
        className={`mt-1 font-mono text-2xl font-bold tabular-nums ${
          flag ? "text-amber-700 dark:text-amber-400" : ""
        }`}
      >
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-xs text-muted">{sub}</p> : null}
    </div>
  );
}
