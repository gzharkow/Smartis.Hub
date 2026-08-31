import type { ReactNode } from "react";

/**
 * Заголовок страницы раздела.
 *
 * Собран из строки, повторённой в проекте шестнадцать раз слово в слово.
 * Вынесен не ради экономии символов, а чтобы у страницы физически не мог
 * пропасть <h1>: до этого четыре страницы кабинета обходились без него
 * вовсе, и человек с программой чтения с экрана не понимал, куда попал.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  className = "",
}: {
  title: ReactNode;
  /** Одна строка под заголовком — чем этот раздел занимается. */
  subtitle?: ReactNode;
  /** Правая часть строки заголовка: кнопка создания, фильтр. */
  actions?: ReactNode;
  className?: string;
}) {
  return (
    // flex-wrap обязателен: на телефоне кнопка справа не помещается в строку
    // с заголовком и должна уходить под него, а не растягивать страницу вбок.
    <div
      className={`flex flex-wrap items-start justify-between gap-4 ${className}`.trim()}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions}
    </div>
  );
}
