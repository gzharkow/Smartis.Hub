// Те же 8 оттенков, что и в owner-color.ts (бейдж автора), но здесь нужны
// сами HEX-значения: цвет плитки папки задаётся инлайн-стилем, а не готовым
// классом Tailwind. Фиксированный набор, а не свободный выбор цвета — так
// плитка гарантированно остаётся читаемой в любой теме.

export const FOLDER_COLOR_PRESETS = [
  { label: "Синий", value: "#3b82f6" },
  { label: "Фиолетовый", value: "#a855f7" },
  { label: "Янтарный", value: "#f59e0b" },
  { label: "Изумрудный", value: "#10b981" },
  { label: "Розовый", value: "#ec4899" },
  { label: "Голубой", value: "#06b6d4" },
  { label: "Оранжевый", value: "#f97316" },
  { label: "Индиго", value: "#6366f1" },
] as const;

export function isValidFolderColor(value: string): boolean {
  return FOLDER_COLOR_PRESETS.some((p) => p.value === value);
}
