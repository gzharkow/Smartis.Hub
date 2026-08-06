// Детерминированный цвет бейджа автора: один и тот же сотрудник получает
// один и тот же цвет во всех списках (Хабы, Генератор КП), где администратор
// видит записи вперемешку от разных людей. Без "server-only" — палитра нужна
// и серверным страницам (сборка списка), и клиентским строкам списка.

const PALETTE = [
  "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  "bg-pink-500/15 text-pink-700 dark:text-pink-400",
  "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400",
  "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400",
] as const;

export function ownerColorClass(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

/** Имя, если оно есть, иначе почта — то же правило, что уже используется в других местах. */
export function ownerLabel(owner: { name: string | null; email: string }): string {
  return owner.name || owner.email;
}
