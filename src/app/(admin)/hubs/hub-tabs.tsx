import { PendingLink } from "@/components/pending-link";

/**
 * Разделы страницы хабов. Как и у материалов, дублируют подпункты бокового
 * меню: меню можно свернуть, а на узком экране в нём остаются одни значки.
 *
 * Обычные ссылки, без клиентского кода: что открыто — видно из адреса.
 */

export const HUB_TABS = [
  { key: "all", href: "/hubs", label: "Все" },
  { key: "folders", href: "/hubs/folders", label: "Папки" },
  { key: "trash", href: "/hubs/trash", label: "Недавно удалённые" },
] as const;

export type HubTabKey = (typeof HUB_TABS)[number]["key"];

export function HubTabs({
  current,
  right,
}: {
  current: HubTabKey;
  /** Правый край ряда вкладок — сюда кладём переключатель вида. */
  right?: React.ReactNode;
}) {
  const tabs = HUB_TABS;

  return (
    // flex-wrap + nav shrink-0: когда места мало, вниз уезжает блок управления
    // целиком, а вкладки остаются в одну строку и не ломаются.
    <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2">
      <nav className="flex shrink-0 gap-1.5">
        {tabs.map((tab) => {
          const active = tab.key === current;
          return (
            <PendingLink
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
            </PendingLink>
          );
        })}
      </nav>

      {right ? <div className="ml-auto">{right}</div> : null}
    </div>
  );
}
