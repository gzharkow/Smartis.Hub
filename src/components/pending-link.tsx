"use client";

import Link, { useLinkStatus } from "next/link";

/** Крутилка внутри ссылки: видна, пока идёт переход по ней. */
function Pending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      aria-hidden="true"
      className="ml-1.5 size-3 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

/**
 * Ссылка-вкладка с видимой реакцией на нажатие. Страницы динамические и
 * открываются после ответа сервера; без отклика на телефоне кажется, что
 * нажатие не сработало. Остальное — как у обычного Link.
 */
export function PendingLink({
  children,
  ...props
}: React.ComponentProps<typeof Link>) {
  return (
    <Link {...props}>
      {children}
      <Pending />
    </Link>
  );
}
