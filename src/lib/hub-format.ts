// Единый формат «когда создан хаб»: дата и время. Вынесен отдельно, чтобы
// список хабов и содержимое папки показывали дату одинаково.

const fmt = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** «16.07.2026, 14:30» — дата в формате дд.мм.гггг со временем. */
export function formatHubCreated(date: Date): string {
  return fmt.format(date);
}
