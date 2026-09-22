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
import { useVisualViewportBottomOffset } from "./use-visual-viewport-bottom-offset";

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
      // На iOS synthetic click идёт с задержкой после реального касания —
      // если тап пришёлся на момент, когда JS ещё не успел «прогреться»,
      // click иногда вовсе не долетает, и нужен второй тап. pointerup
      // срабатывает раньше и надёжнее; onClick оставлен как есть для
      // клавиатуры/скринридеров. Двойной вызов безвреден — setPanel("search")
      // идемпотентен.
      onPointerUp={onClick}
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
type SectionAccess = { hubs: boolean; assets: boolean; stats: boolean; calculator: boolean };

export function BottomNav({ access }: { access: SectionAccess }) {
  const [panel, setPanel] = useState<"search" | null>(null);
  const navRef = useVisualViewportBottomOffset<HTMLElement>();

  return (
    <>
      {/* fixed + visualViewport, не sticky: sticky (как обычный flex-child
          body, см. (admin)/layout.tsx) решал баг холодного старта (fixed
          резолвился против ещё не устоявшегося вьюпорта, бар "висел" выше
          нужного места до первого touch-скролла), но открыл другой — во
          время скролла WebKit на iOS анимирует скрытие/появление адресной
          строки, и sticky/dvh может на кадр-другой разъехаться с реальным
          нижним краем экрана (бар "отлетает" к середине). visualViewport
          не подвержен ни тому, ни другому: даёт живые фактические размеры
          видимой области с первого кадра, а не снимок/расчётную dvh-высоту
          (см. use-visual-viewport-bottom-offset.ts). bottom-0 в классе —
          запасное значение на случай недоступности API, хук его тут же
          перекрывает инлайн-стилем.
          fixed выходит из потока — <main> снова нужен компенсирующий
          нижний отступ той же высоты (см. (admin)/layout.tsx).
          flex-1 на каждом пункте сам делит ширину поровну — на 5 или 6
          пунктов, без явного grid-cols. */}
      {/* Высота считается ОТ полосы значков, а не до неё. Раньше стояло h-20
          с тем же нижним отступом под вырез: при box-sizing: border-box он
          вычитался из тех же 80px, и полоса значков выходила
          46px на iPhone с чертой против 80px на телефоне без неё — область
          нажатия у одного и того же бара отличалась почти вдвое. Теперь
          полоса всегда 3.5rem, а вырез добавляется под ней. */}
      {/* transition-[bottom] — подстраховка: хук пересчитывает bottom только
          на resize (см. use-visual-viewport-bottom-offset.ts), но если
          WebKit когда-нибудь всё же пришлёт переходное значение, скачок
          сгладится плавно, а не дёрнет бар рывком. */}
      <nav
        ref={navRef}
        className="fixed inset-x-0 bottom-0 z-30 hidden h-[calc(3.5rem+env(safe-area-inset-bottom))] w-full items-stretch border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] transition-[bottom] duration-200 ease-out standalone:max-md:flex"
      >
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

        {access.stats ? (
          <BottomTabLink
            href="/stats"
            label="Статистика"
            icon={<StatsIcon size="lg" />}
          />
        ) : null}

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
