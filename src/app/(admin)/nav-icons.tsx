// Значки бокового меню. Нарисованы здесь, как и значки редактора: их немного,
// ради них не нужна отдельная библиотека.

// "sm" — сайдбар (дефолт, как и раньше), "lg" — нижний PWA-бар, где значкам
// нужно быть заметнее. Классы литеральные (не size-[${n}px]) — Tailwind
// видит только буквальные строки в исходниках, интерполяция в className
// на этапе сборки просто не попала бы в CSS.
type IconSize = "sm" | "lg";

function Icon({
  children,
  size = "sm",
}: {
  children: React.ReactNode;
  size?: IconSize;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={size === "lg" ? "size-[26px]" : "size-5"}
    >
      {children}
    </svg>
  );
}

/** Хабы — стопка страниц: хаб собирается из нескольких материалов. */
export const HubsIcon = ({ size }: { size?: IconSize } = {}) => (
  <Icon size={size}>
    <path d="M12 3 3 7.5l9 4.5 9-4.5z" />
    <path d="M3 12.5 12 17l9-4.5" />
    <path d="M3 17.5 12 22l9-4.5" />
  </Icon>
);

/** Материалы — папка библиотеки. */
export const AssetsIcon = ({ size }: { size?: IconSize } = {}) => (
  <Icon size={size}>
    <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2.5h7A1.5 1.5 0 0 1 19 10v7a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 3 17z" />
  </Icon>
);

/** Статистика — столбики отчёта. */
export const StatsIcon = ({ size }: { size?: IconSize } = {}) => (
  <Icon size={size}>
    <path d="M4 20h16" />
    <path d="M7 20v-6" />
    <path d="M12 20V6" />
    <path d="M17 20v-9" />
  </Icon>
);

/** Калькулятор — сетка кнопок, как на калькуляторе. */
export const CalculatorIcon = ({ size }: { size?: IconSize } = {}) => (
  <Icon size={size}>
    <rect x="4" y="2.5" width="16" height="19" rx="2" />
    <path d="M8 6.5h8" />
    <path d="M7.5 11h1M7.5 15h1M7.5 19h1" />
    <path d="M12 11h1M12 15h1M12 19h1" />
    <path d="M16.5 11h1M16.5 15h1M16.5 19h1" />
  </Icon>
);

/** Свернуть/развернуть меню. Стрелка сама разворачивается через CSS. */
export const ChevronIcon = () => (
  <Icon>
    <path d="m14 6-6 6 6 6" />
  </Icon>
);

/** Раскрыть/спрятать список подразделов. Вниз — раскрыто, вверх — спрятано. */
export const ChevronDownIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="size-4"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

/** Выход. */
export const LogoutIcon = () => (
  <Icon>
    <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
    <path d="m15 16 4-4-4-4" />
    <path d="M19 12H9" />
  </Icon>
);

/** Настройки — шестерёнка. Открывает шторку с темой/почтой/выходом. */
export const SettingsIcon = ({ size }: { size?: IconSize } = {}) => (
  <Icon size={size}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </Icon>
);

/**
 * Поиск. Перенесена сюда из global-search.tsx: раньше нужна была только там,
 * теперь используется и в шапке, и в нижнем PWA-баре — единственный значок
 * в наборе, которому иногда нужны свои классы вместо фиксированных 18px
 * общей обёртки Icon (позиционирование внутри поля ввода), поэтому рисуется
 * отдельно, без Icon.
 */
export function SearchIcon({
  className = "size-[18px]",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
