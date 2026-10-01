// Форматирование дат/времени для экрана — БЕЗ "server-only" нарочно.
//
// Часовой пояс процесса Node (сервер/прод) никем не задан и не гарантирован
// (нет TZ ни в .env, ни в deploy/smartfollow.service) — полагаться на него
// для того, что видит пользователь, нельзя. Единственный часовой пояс,
// который точно тот, что нужен, — пояс устройства самого смотрящего.
// Поэтому все функции ниже обязаны вызываться из клиентского кода
// (через `src/components/local-datetime.tsx` или напрямую из "use client"
// компонента) — там `Intl.DateTimeFormat` без явного `timeZone` берёт
// локальный пояс браузера сам. Вызов этих же функций внутри Server
// Component воспроизведёт исходный баг («Хронология заходов» показывала
// пояс сервера, а не зрителя) — см. AGENTS.md.

/** «2 мин 30 сек», «45 сек», «1 ч 5 мин». Длительность, не точка во
 *  времени — часовому поясу не подвержена, но живёт здесь же: та же
 *  причина, по которой раньше не могла попасть в клиентский компонент
 *  (stats.ts был "server-only" целиком). */
export function formatDuration(ms: number): string {
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec} сек`;

  const min = Math.floor(sec / 60);
  if (min < 60) {
    const rest = sec % 60;
    return rest > 0 ? `${min} мин ${rest} сек` : `${min} мин`;
  }

  const hours = Math.floor(min / 60);
  const restMin = min % 60;
  return restMin > 0 ? `${hours} ч ${restMin} мин` : `${hours} ч`;
}

/** «только что», «12 минут назад», «вчера», «3 июля». */
export function formatWhen(date: Date | null): string {
  if (!date) return "—";

  const diffMs = Date.now() - date.getTime();
  const min = Math.round(diffMs / 60_000);

  if (min < 1) return "только что";
  if (min < 60) return `${min} мин назад`;

  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours} ч назад`;

  const days = Math.round(hours / 24);
  if (days === 1) return "вчера";
  if (days < 7) return `${days} дн. назад`;

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
  }).format(date);
}

const shortDateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });

/** «12 августа» — для подписи версии и хронологии заходов. */
export function formatShortDate(date: Date): string {
  return shortDateFmt.format(date);
}

const timeFmt = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });

/** «12 августа, 14:32» — точное время захода, в отличие от formatWhen. */
export function formatVisitWhen(date: Date): string {
  return `${formatShortDate(date)}, ${timeFmt.format(date)}`;
}

/** «14:32» — метка времени для чипа в хронологии заходов. */
export function formatEventTime(date: Date): string {
  return timeFmt.format(date);
}

const hubCreatedFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** «16.07.2026, 14:30» — дата в формате дд.мм.гггг со временем. */
export function formatHubCreated(date: Date): string {
  return hubCreatedFmt.format(date);
}

const securityEventFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** «16.07.2026, 14:30:05» — для журнала безопасности нужны секунды. */
export function formatSecurityEvent(date: Date): string {
  return securityEventFmt.format(date);
}
