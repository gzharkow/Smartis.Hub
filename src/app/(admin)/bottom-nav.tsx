"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { under } from "./nav-link";
import {
  AssetsIcon,
  CalculatorIcon,
  HubsIcon,
  KpiIcon,
  MenuIcon,
  SearchIcon,
  SettingsIcon,
  StatsIcon,
} from "./nav-icons";
import { SearchOverlay } from "./search-overlay";
import { useVisualViewportBottomOffset } from "./use-visual-viewport-bottom-offset";

// В самом баре — только три основных раздела, чтобы он не переполнялся на
// телефоне. Остальное (KPI, Статистика, Поиск, Настройки) спрятано за
// кнопкой «Ещё» (меню-лист в BottomNav ниже). Порядок слева направо:
// Ещё, Генератор КП, Материалы, Хабы.
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
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`flex h-full flex-1 flex-col items-center justify-center gap-0.5 text-xs transition duration-100 ${
        active ? "text-accent" : "text-muted"
      }`}
    >
      {/* Уменьшение на нажатии — единственный отклик, который здесь вообще
          возможен: бар живёт только в установленном PWA, то есть всегда на
          тач-экране, где hover не бывает. Без него самый нажимаемый элемент
          приложения не отзывается на касание совсем. */}
      <span
        className={`transition duration-100 ease-out active:scale-[0.92] ${
          active ? "" : "opacity-80"
        }`}
      >
        {icon}
      </span>
    </Link>
  );
}

function BottomTabButton({
  label,
  icon,
  active,
  onClick,
  idempotent = true,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  /** pointerup + click вызывают onClick дважды — безопасно только для
   * идемпотентных действий; переключатель («Ещё») это ломает. */
  idempotent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      // На iOS synthetic click идёт с задержкой после реального касания —
      // если тап пришёлся на момент, когда JS ещё не успел «прогреться»,
      // click иногда вовсе не долетает, и нужен второй тап. pointerup
      // срабатывает раньше и надёжнее; onClick оставлен как есть для
      // клавиатуры/скринридеров. Двойной вызов безвреден — setPanel("search")
      // идемпотентен.
      onPointerUp={idempotent ? onClick : undefined}
      aria-label={label}
      aria-pressed={active}
      className={`flex h-full flex-1 flex-col items-center justify-center gap-0.5 text-xs transition duration-100 ${
        active ? "text-accent" : "text-muted"
      }`}
    >
      <span
        className={`transition duration-100 ease-out active:scale-[0.92] ${
          active ? "" : "opacity-80"
        }`}
      >
        {icon}
      </span>
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
type SectionAccess = { hubs: boolean; assets: boolean; stats: boolean; calculator: boolean; kpi: boolean };

export function BottomNav({ access }: { access: SectionAccess }) {
  const [panel, setPanel] = useState<"search" | "more" | null>(null);
  const navRef = useVisualViewportBottomOffset<HTMLElement>();
  const pathname = usePathname();

  // Переход по любой ссылке закрывает «Ещё» (сброс по смене адреса прямо в
  // рендере — так React рекомендует вместо setState в эффекте).
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    if (panel === "more") setPanel(null);
  }

  useEffect(() => {
    if (panel !== "more") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel]);

  const moreItems = [
    access.kpi ? { href: "/kpi", label: "KPI план/факт", icon: <KpiIcon /> } : null,
    access.stats ? { href: "/stats", label: "Статистика", icon: <StatsIcon /> } : null,
    { href: "/settings", label: "Настройки", icon: <SettingsIcon /> },
  ].filter((i) => i !== null);
  const moreActive =
    panel === "more" || moreItems.some((i) => under(pathname, i.href));

  return (
    <>
      {panel === "more" ? (
        // Подложка под баром (z-20 < z-30): тап мимо листа закрывает его.
        <div
          className="fixed inset-0 z-20 hidden standalone:max-md:block"
          onClick={() => setPanel(null)}
          aria-hidden="true"
        />
      ) : null}

      {/* fixed + visualViewport, не sticky: подробности — в истории файла;
          коротко: sticky/dvh на iOS разъезжается с реальным нижним краем во
          время скролла, visualViewport даёт живые размеры с первого кадра.
          Высота — 3.5rem полоса значков плюс вырез под ней; <main> в
          (admin)/layout.tsx компенсирует её нижним отступом. Лист «Ещё»
          лежит внутри бара (absolute bottom-full) и потому едет вместе с ним. */}
      <nav
        ref={navRef}
        className="fixed inset-x-0 bottom-0 z-30 hidden h-[calc(3.5rem+env(safe-area-inset-bottom))] w-full items-stretch border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] transition-[bottom] duration-200 ease-out standalone:max-md:flex"
      >
        {panel === "more" ? (
          <div
            role="menu"
            aria-label="Ещё"
            className="absolute inset-x-0 bottom-full grid gap-0.5 rounded-t-2xl border-t border-border bg-surface p-2 shadow-[0_-8px_24px_rgba(0,0,0,0.25)]"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => setPanel("search")}
              className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-left text-sm transition duration-100 active:scale-[0.98] active:bg-border/60"
            >
              <SearchIcon className="size-5" />
              Поиск
            </button>
            {moreItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                aria-current={under(pathname, item.href) ? "page" : undefined}
                className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm transition duration-100 active:scale-[0.98] active:bg-border/60 ${
                  under(pathname, item.href) ? "text-accent" : ""
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </div>
        ) : null}

        <BottomTabButton
          label="Ещё"
          icon={<MenuIcon size="lg" />}
          active={moreActive}
          idempotent={false}
          onClick={() => setPanel((p) => (p === "more" ? null : "more"))}
        />

        {ROUTE_TABS.filter(({ key }) => access[key as keyof SectionAccess]).map(({ key, ...tab }) => (
          <BottomTabLink key={key} {...tab} />
        ))}
      </nav>

      {panel === "search" ? (
        <SearchOverlay onClose={() => setPanel(null)} />
      ) : null}
    </>
  );
}
