import Link from "next/link";

// По образцу CalculatorTabs (../calculator/calculator-tabs.tsx): обычные
// ссылки без клиентского кода, что открыто — видно из адреса.
const SETTINGS_TABS = [
  { key: "general", href: "/settings/general", label: "Общие" },
  { key: "administration", href: "/settings/administration", label: "Администрирование" },
] as const;

export type SettingsTabKey = (typeof SETTINGS_TABS)[number]["key"];

export function SettingsTabs({
  current,
  isAdmin,
}: {
  current: SettingsTabKey;
  isAdmin: boolean;
}) {
  const tabs = SETTINGS_TABS.filter((tab) => tab.key === "general" || isAdmin);

  // Обычному пользователю доступна только «Общие» — ряд из одной вкладки
  // только занимал бы место, ничего не давая выбрать.
  if (tabs.length < 2) return null;

  return (
    <nav className="mb-6 flex gap-1.5">
      {tabs.map((tab) => {
        const active = tab.key === current;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 text-sm transition ${
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
  );
}
