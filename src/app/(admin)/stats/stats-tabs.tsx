import Link from "next/link";

// Две вкладки статистики — тот же паттерн, что у HubTabs: обычные ссылки,
// без клиентского кода, что открыто — видно из адреса. Слот `right` — под
// пикер периода на «Общей статистике» и сортировку/вид на «Клиентах».

export const STATS_TABS = [
  { key: "general", href: "/stats", label: "Общая статистика" },
  { key: "clients", href: "/stats/clients", label: "Статистика по клиентам" },
] as const;

export type StatsTabKey = (typeof STATS_TABS)[number]["key"];

export function StatsTabs({
  current,
  right,
}: {
  current: StatsTabKey;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2">
      <nav className="flex shrink-0 gap-1.5">
        {STATS_TABS.map((tab) => {
          const active = tab.key === current;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm transition duration-100 pointer-coarse:min-h-11 ${
                active
                  ? "bg-border font-medium"
                  : "text-muted hover:bg-border/50 hover:text-foreground"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {right ? <div className="ml-auto">{right}</div> : null}
    </div>
  );
}
