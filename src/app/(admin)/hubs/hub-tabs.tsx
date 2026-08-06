import Link from "next/link";
import { hasView } from "@/lib/permissions";
import type { CurrentUser } from "@/lib/auth";

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

/** Ключи подразделов, доступные пользователю по матрице — прокидывать в `visibleKeys`. */
export function hubTabVisibleKeys(user: CurrentUser): string[] {
  return HUB_TABS.filter(
    (t) => t.key !== "all" && hasView(user, `hubs.${t.key}`),
  ).map((t) => `hubs.${t.key}`);
}

export function HubTabs({
  current,
  right,
  visibleKeys,
}: {
  current: HubTabKey;
  /** Правый край ряда вкладок — сюда кладём переключатель вида. */
  right?: React.ReactNode;
  /**
   * Ключи из permission-sections.ts, доступные пользователю ("hubs.folders",
   * "hubs.trash") — по матрице доступа. "all" не проверяется: раз страница
   * вообще открылась, значит "hubs" уже разрешён. Не передан — показываем
   * все вкладки (сохраняет прежнее поведение там, где вызывающая страница
   * ещё не прокинула матрицу).
   */
  visibleKeys?: string[];
}) {
  const tabs = HUB_TABS.filter(
    (tab) =>
      tab.key === "all" ||
      !visibleKeys ||
      visibleKeys.includes(`hubs.${tab.key}`),
  );

  return (
    // flex-wrap + nav shrink-0: когда места мало, вниз уезжает блок управления
    // целиком, а вкладки остаются в одну строку и не ломаются.
    <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2">
      <nav className="flex shrink-0 gap-1.5">
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

      {right ? <div className="ml-auto">{right}</div> : null}
    </div>
  );
}
