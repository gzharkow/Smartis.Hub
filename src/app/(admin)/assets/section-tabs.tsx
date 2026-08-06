import Link from "next/link";
import { SECTIONS } from "@/lib/asset-sections";

/**
 * Переключатель разделов на самой странице материалов.
 *
 * Дублирует подпункты бокового меню намеренно: меню можно свернуть, а на
 * узком экране подписей в нём нет вовсе — тогда разделы остались бы
 * недоступны. Здесь же они видны всегда и рядом с тем, что переключают.
 *
 * Обычные ссылки, без клиентского кода: какая вкладка выбрана, видно
 * из адреса, и страница всё равно перерисовывается на сервере.
 */
export function SectionTabs({
  current,
  right,
}: {
  current: string | null;
  /** Правый край ряда вкладок — сюда кладём переключатель вида. */
  right?: React.ReactNode;
}) {
  const tabs = [
    { slug: null, label: "Все" },
    ...SECTIONS.map((s) => ({ slug: s.slug, label: s.label })),
  ];

  return (
    <div className="mb-6 flex items-center gap-3">
      <nav className="flex flex-wrap gap-1.5">
        {tabs.map((tab) => {
          const active = current === tab.slug;
          return (
            <Link
              key={tab.label}
              href={tab.slug ? `/assets/${tab.slug}` : "/assets"}
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

      {right ? <div className="ml-auto">{right}</div> : null}
    </div>
  );
}
