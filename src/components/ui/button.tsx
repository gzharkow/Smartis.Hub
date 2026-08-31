import type { ComponentProps } from "react";

/**
 * Кнопка кабинета.
 *
 * До неё строка первичной кнопки была скопирована в проекте примерно
 * двадцать раз и успела разъехаться: где-то hover уходил в blue-700,
 * где-то в blue-500, а disabled:opacity встречался в пяти значениях
 * (30/40/50/60/100). Поэтому здесь не «удобная обёртка», а единственное
 * место, где вообще решается, как выглядит и ведёт себя нажатие.
 *
 * Варианты заданы полными классами через Record, а не сборкой строки
 * вида `bg-${color}-600`: Tailwind ищет классы в исходниках текстом и
 * собранное на лету имя просто не увидит.
 */

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "link"
  | "danger"
  | "ghostDanger";
export type ButtonSize = "sm" | "md";

// duration-100, а не дефолтные 150: отклик на нажатие должен ощущаться
// мгновенным. Само нажатие показывается уменьшением на 3% — на тач-экране
// это единственный отклик, который вообще возможен, там нет hover.
const BASE =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium " +
  "transition duration-100 ease-out active:scale-[0.97] " +
  "disabled:pointer-events-none disabled:opacity-50";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent-fill text-on-accent hover:bg-accent-fill-hover",
  secondary:
    "border border-border bg-background text-foreground hover:border-muted",
  ghost: "text-muted hover:bg-border/60 hover:text-foreground",
  // Действие-подсказка в строке списка: «Открыть», «Скачать», «В хаб».
  link: "text-accent hover:bg-accent/10",
  // Разрушающее действие в этом проекте почти всегда текстовое («Удалить»
  // рядом со строкой), а не залитая красная кнопка, — поэтому по умолчанию
  // именно такое. Для подтверждения в модалке есть dangerSolid.
  danger: "text-danger hover:bg-danger/10",
  // «Удалить» в строке списка: в покое неприметное, красным становится
  // под курсором — чтобы ряд одинаковых строк не пестрел красным.
  ghostDanger: "text-muted hover:bg-danger/10 hover:text-danger",
};

/** Залитая красная — только для подтверждения необратимого действия. */
const DANGER_SOLID = "bg-danger-fill text-white hover:opacity-90";

// pointer-coarse — реальный тач, а не узкий экран: на телефоне палец требует
// 44px, мышью на десктопе такая кнопка выглядела бы неоправданно крупной.
const SIZE: Record<ButtonSize, string> = {
  sm: "min-h-8 px-3 py-1.5 text-xs pointer-coarse:min-h-11",
  md: "min-h-9 px-4 py-2 text-sm pointer-coarse:min-h-11",
};

export function buttonClasses(
  variant: ButtonVariant | "dangerSolid" = "primary",
  size: ButtonSize = "md",
  className = "",
): string {
  const look = variant === "dangerSolid" ? DANGER_SOLID : VARIANT[variant];
  return `${BASE} ${look} ${SIZE[size]} ${className}`.trim();
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ComponentProps<"button"> & {
  variant?: ButtonVariant | "dangerSolid";
  size?: ButtonSize;
}) {
  // type="button" по умолчанию: без него кнопка внутри формы отправляет её.
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, className)}
      {...props}
    />
  );
}
