import Link from "next/link";

/**
 * Разделы страницы калькулятора. Как и у хабов/материалов, дублируют
 * подпункты бокового меню: меню можно свернуть, а на узком экране в PWA
 * сайдбара нет вовсе (см. нижний таб-бар) — без этих вкладок раздел «Файлы»
 * стал бы недостижим.
 *
 * Обычные ссылки, без клиентского кода: что открыто — видно из адреса.
 */

export const CALCULATOR_TABS = [
  { key: "quotes", href: "/calculator", label: "Расчёты" },
  { key: "files", href: "/calculator/files", label: "Файлы" },
] as const;

export type CalculatorTabKey = (typeof CALCULATOR_TABS)[number]["key"];

export function CalculatorTabs({
  current,
  right,
}: {
  current: CalculatorTabKey;
  /** Правый край ряда вкладок — сюда кладём переключатель вида/сортировки. */
  right?: React.ReactNode;
}) {
  const tabs = CALCULATOR_TABS;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2">
      <nav className="flex shrink-0 gap-1.5">
        {tabs.map((tab) => {
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
