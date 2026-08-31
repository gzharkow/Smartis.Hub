import type { ComponentProps } from "react";

/**
 * Кнопка без подписи — «карандашик», крестик, стрелка.
 *
 * label обязателен по типу, а не «желателен по договорённости»: без него
 * такую кнопку не видно ни программе чтения с экрана, ни человеку, который
 * не узнал значок. Отсюда же title — подсказка при наведении мышью.
 *
 * Область нажатия расширяется отступом, а не размером самого значка:
 * значок остаётся 16px, палец получает свои 44px.
 */

export type IconButtonTone = "muted" | "danger";

const TONE: Record<IconButtonTone, string> = {
  muted: "text-muted hover:bg-border/60 hover:text-foreground",
  danger: "text-muted hover:bg-danger/10 hover:text-danger",
};

export function iconButtonClasses(tone: IconButtonTone = "muted", className = "") {
  return (
    "inline-grid shrink-0 place-items-center rounded-lg p-1.5 " +
    "min-h-8 min-w-8 pointer-coarse:min-h-11 pointer-coarse:min-w-11 " +
    "transition duration-100 ease-out active:scale-[0.92] " +
    "disabled:pointer-events-none disabled:opacity-50 " +
    `${TONE[tone]} ${className}`
  ).trim();
}

export function IconButton({
  label,
  tone = "muted",
  className = "",
  type = "button",
  ...props
}: Omit<ComponentProps<"button">, "aria-label" | "title"> & {
  /** Что делает кнопка. Уходит и в aria-label, и в подсказку. */
  label: string;
  tone?: IconButtonTone;
}) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={iconButtonClasses(tone, className)}
      {...props}
    />
  );
}
