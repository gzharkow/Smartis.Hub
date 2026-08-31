import type { ComponentProps } from "react";

/**
 * Поля ввода.
 *
 * Раньше эта строка классов была скопирована примерно в двадцать мест,
 * и в каждой копии стоял — то есть у полей снимали кольцо
 * фокуса и заменяли его изменением цвета рамки в один пиксель. Здесь
 * нет вовсе: кольцо приходит из базового слоя globals.css,
 * а смена цвета рамки осталась дополнительной подсказкой «сюда сейчас
 * печатают», а не единственным признаком фокуса.
 *
 * w-full сознательно НЕ в базе: поля в проекте стоят и в сетках, где ширину
 * задаёт колонка, и рядом с кнопкой, где растягивание сломало бы строку.
 * Кому нужно — передаёт классом.
 */

const FIELD =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm " +
  "text-foreground placeholder:text-muted transition-colors duration-100 " +
  "focus:border-accent disabled:opacity-50";

export function fieldClasses(className = "") {
  return `${FIELD} ${className}`.trim();
}

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={fieldClasses(className)} {...props} />;
}

export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return <textarea className={fieldClasses(className)} {...props} />;
}

export function Select({ className = "", ...props }: ComponentProps<"select">) {
  return <select className={fieldClasses(className)} {...props} />;
}
