import type { ComponentProps, ElementType } from "react";

/**
 * Панель со скруглением и рамкой — та самая, что в проекте существовала
 * в трёх несогласованных вариантах отступов (p-4, p-5 и px-4 py-3) для
 * одной и той же роли. Теперь отступ выбирается ролью, а не тем, в каком
 * файле карточку писали.
 */

export type CardDensity = "row" | "card" | "panel";

const DENSITY: Record<CardDensity, string> = {
  /** Строка списка: невысокая, много таких подряд. */
  row: "px-4 py-3",
  /** Самостоятельная карточка внутри страницы. */
  card: "p-4",
  /** Крупный блок раздела — настройки, форма, сводка. */
  panel: "p-5",
};

export function cardClasses(density: CardDensity = "card", className = "") {
  return `rounded-xl border border-border bg-surface ${DENSITY[density]} ${className}`.trim();
}

export function Card<T extends ElementType = "div">({
  as,
  density = "card",
  className = "",
  ...props
}: { as?: T; density?: CardDensity } & Omit<
  ComponentProps<T>,
  "as" | "density"
>) {
  const Tag = (as ?? "div") as ElementType;
  return <Tag className={cardClasses(density, className)} {...props} />;
}
