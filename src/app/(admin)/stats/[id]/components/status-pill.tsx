// Пилюля в шапке карточки клиента: горит только когда есть однозначный
// сигнал (заходил недавно / давно не появлялся). В нейтральной зоне между
// порогами пилюля осознанно не рисуется — только дата последнего захода
// рядом (см. page.tsx), домысливать «тёплый/холодный» тут не за чем.
export function StatusPill({ tag }: { tag: "hot" | "cold" | null }) {
  if (tag === "hot") {
    return (
      <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
        Активный интерес
      </span>
    );
  }

  if (tag === "cold") {
    return (
      <span className="rounded-full border border-border bg-border/40 px-2.5 py-1 text-xs font-medium text-muted">
        Остыл
      </span>
    );
  }

  return null;
}
