import Link from "next/link";
import { SECTIONS, permissionKeyForSection } from "@/lib/asset-sections";
import { hasView } from "@/lib/permissions";
import type { CurrentUser } from "@/lib/auth";

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
/** Ключи разделов, доступные пользователю по матрице — прокидывать в `visibleKeys`. */
export function sectionTabVisibleKeys(user: CurrentUser): string[] {
  return [
    ...(hasView(user, "assets") ? ["assets"] : []),
    ...SECTIONS.filter((s) => hasView(user, permissionKeyForSection(s.value))).map((s) =>
      permissionKeyForSection(s.value),
    ),
  ];
}

export function SectionTabs({
  current,
  right,
  visibleKeys,
}: {
  current: string | null;
  /** Правый край ряда вкладок — сюда кладём переключатель вида. */
  right?: React.ReactNode;
  /** См. hubTabVisibleKeys в hubs/hub-tabs.tsx — не передан, значит показываем все. */
  visibleKeys?: string[];
}) {
  const allTabs = [
    { slug: null, key: "assets", label: "Все" },
    ...SECTIONS.map((s) => ({
      slug: s.slug,
      key: permissionKeyForSection(s.value),
      label: s.label,
    })),
  ];
  const tabs = allTabs.filter((tab) => !visibleKeys || visibleKeys.includes(tab.key));

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
