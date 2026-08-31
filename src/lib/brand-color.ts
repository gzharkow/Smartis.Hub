/**
 * Фирменный цвет хаба и читаемость поверх него.
 *
 * Цвет витрины задаёт продавец — а значит он может оказаться каким угодно,
 * и захардкоженный белый текст на кнопке «Задать вопрос» перестаёт читаться,
 * как только выбран светлый тон. Раньше это спасало только тем, что цвет по
 * умолчанию был синий #2563eb (белый на нём — 5,17). Стоило поставить свой,
 * и проверять было некому.
 *
 * Поэтому цвет надписи считается от самого фона, а не задан заранее.
 * Чистые функции, без "server-only": нужны и странице витрины на сервере,
 * и её живому предпросмотру в браузере.
 */

/** Цвет по умолчанию — фирменный зелёный Smartis (тот же, что --brand в globals.css). */
export const DEFAULT_BRAND_COLOR = "#7ca82d";

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Относительная яркость по WCAG. Понимает #rgb и #rrggbb. */
export function luminance(hex: string): number {
  let h = hex.trim().replace("#", "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (!/^[0-9a-f]{6}$/i.test(h)) return 0.5; // мусор вместо цвета — считаем средним
  const r = channel(parseInt(h.slice(0, 2), 16));
  const g = channel(parseInt(h.slice(2, 4), 16));
  const b = channel(parseInt(h.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Контраст двух цветов, от 1 до 21. AA для текста — от 4.5. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const LIGHT = "#ffffff";
const DARK = "#0a0a0a";

/** Цвет надписи ПОВЕРХ заливки фирменным цветом — тот из двух, что читается лучше. */
export function textOnBrand(brand: string): string {
  return contrastRatio(LIGHT, brand) >= contrastRatio(DARK, brand) ? LIGHT : DARK;
}

/**
 * Фирменный цвет как ЦВЕТ ТЕКСТА на заданном фоне. Если он на этом фоне
 * не читается — возвращаем запасной, а фирменный остаётся в рамке/заливке
 * рядом, где контраст не критичен.
 */
export function brandTextOn(background: string, brand: string, fallback = LIGHT): string {
  return contrastRatio(brand, background) >= 4.5 ? brand : fallback;
}

/** Подложка витрины — она тёмная всегда, независимо от темы кабинета. */
export const SHOWCASE_BACKDROP = "#0b0f14";
