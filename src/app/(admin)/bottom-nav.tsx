"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { under } from "./nav-link";
import {
  AssetsIcon,
  CalculatorIcon,
  HubsIcon,
  SearchIcon,
  SettingsIcon,
  StatsIcon,
} from "./nav-icons";
import { SearchOverlay } from "./search-overlay";

// Порядок — зеркальный тому, что был в сайдбаре (решение владельца):
// Настройки → Поиск → (Статистика) → Генератор КП → Материалы → Хабы.
// Здесь — только маршруты, кнопки поиска/настроек рисуются в самом баре.
const ROUTE_TABS = [
  {
    key: "calculator",
    href: "/calculator",
    label: "Генератор КП",
    icon: <CalculatorIcon size="lg" />,
  },
  { key: "assets", href: "/assets", label: "Материалы", icon: <AssetsIcon size="lg" /> },
  { key: "hubs", href: "/hubs", label: "Хабы", icon: <HubsIcon size="lg" /> },
] as const;

function BottomTabLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = under(pathname, href);

  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`flex h-full flex-1 flex-col items-center justify-center gap-0.5 text-xs transition ${
        active ? "text-brand" : "text-muted"
      }`}
    >
      <span className={active ? "" : "opacity-80"}>{icon}</span>
    </Link>
  );
}

function BottomTabButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`flex h-full flex-1 flex-col items-center justify-center gap-0.5 text-xs transition ${
        active ? "text-brand" : "text-muted"
      }`}
    >
      <span className={active ? "" : "opacity-80"}>{icon}</span>
    </button>
  );
}

/**
 * Нижний таб-бар — замена сайдбара+шапки на узком экране установленного
 * PWA (см. standalone:max-md: в globals.css/layout.tsx). Подразделы Хабов
 * и Материалов сюда не попадают: у обеих страниц уже есть своя постраничная
 * навигация (HubTabs/SectionTabs), заведённая именно для узких экранов —
 * дублировать её здесь незачем. У Генератора КП такая же навигация
 * (CalculatorTabs) заведена отдельно вместе с этой задачей.
 */
export function BottomNav({
  visibleSections,
}: {
  /** Ключи разделов/подразделов из permission-sections.ts, доступные этому пользователю. */
  visibleSections: string[];
}) {
  const [panel, setPanel] = useState<"search" | null>(null);
  const visible = new Set(visibleSections);
  const routeTabs = ROUTE_TABS.filter((tab) => visible.has(tab.key));

  return (
    <>
      {/* sticky, не fixed: на холодном запуске standalone-PWA WebKit иногда
          не сразу применяет полный экран под статус-баром, и fixed;bottom:0
          резолвился относительно ещё не устоявшегося вьюпорта — бар "висел"
          выше нужного места до первого touch-скролла (замерено debug-панелью,
          не догадка). sticky работает через обычную раскладку/скролл, не
          через привязку к моментальному снимку вьюпорта — этого класса бага
          у него нет. Бар теперь — обычный элемент потока (прямой flex-child
          body, см. (admin)/layout.tsx), поэтому сам резервирует место —
          компенсирующий отступ у <main> больше не нужен.
          flex-1 на каждом пункте сам делит ширину поровну — на 5 или 6
          пунктов, без явного grid-cols. */}
      <nav className="sticky bottom-0 z-30 hidden w-full standalone:max-md:flex h-20 items-stretch border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
        {/* Ведёт в раздел «Настройки»: подраздел «Общие» (тема/аккаунт/выход/
            смена пароля) виден всем, «Администрирование» — только админу. */}
        <BottomTabLink
          href="/settings"
          label="Настройки"
          icon={<SettingsIcon size="lg" />}
        />

        <BottomTabButton
          label="Поиск"
          icon={<SearchIcon className="size-6" />}
          active={panel === "search"}
          onClick={() => setPanel("search")}
        />

        {visible.has("stats") ? (
          <BottomTabLink
            href="/stats"
            label="Статистика"
            icon={<StatsIcon size="lg" />}
          />
        ) : null}

        {routeTabs.map(({ key, ...tab }) => (
          <BottomTabLink key={key} {...tab} />
        ))}
      </nav>

      {panel === "search" ? (
        <SearchOverlay onClose={() => setPanel(null)} />
      ) : null}
    </>
  );
}
