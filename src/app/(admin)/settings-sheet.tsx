"use client";

import { logout } from "@/app/actions/auth";
import { LogoutIcon } from "./nav-icons";
import { ThemeToggle } from "./theme-toggle";
import type { Theme } from "@/lib/theme";

/**
 * Шторка снизу под шестерёнкой нижнего PWA-бара — то же, что раньше жило
 * в шапке (тема, почта, выход), кроме поиска: у него в баре своя кнопка.
 *
 * Паттерн подложки — как у ContactDialog на витрине (fixed inset-0 + клик
 * по фону закрывает), только панель прижата к низу экрана, а не к центру.
 * ThemeToggle безопасно рендерить второй раз одновременно со скрытым
 * Topbar — оба слушают один и тот же модульный стор темы и не разъедутся.
 *
 * BottomNav монтирует этот компонент, только когда шторка открыта — своего
 * open-пропа не нужно.
 */
export function SettingsSheet({
  onClose,
  email,
  theme,
}: {
  onClose: () => void;
  email: string;
  theme: Theme | null;
}) {
  return (
    <div
      role="presentation"
      className="fixed inset-0 z-40 bg-black/40"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Настройки"
        onClick={(e) => e.stopPropagation()}
        className="fixed inset-x-0 bottom-0 rounded-t-2xl border-t border-border bg-surface pt-2 pb-[env(safe-area-inset-bottom)] shadow-2xl"
      >
        {/* Полоска-ручка — визуальная подсказка «это шторка», как в нативных
            приложениях, чисто декоративная. */}
        <div
          aria-hidden="true"
          className="mx-auto mb-2 h-1 w-10 rounded-full bg-border"
        />

        <div className="flex items-center justify-between px-5 py-3">
          <span className="text-sm font-medium">Тема</span>
          <ThemeToggle initial={theme} />
        </div>

        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <span className="truncate text-sm text-muted" title={email}>
            {email}
          </span>
        </div>

        <form action={logout} className="border-t border-border px-2 py-2">
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-muted transition hover:bg-border/60 hover:text-foreground"
          >
            <LogoutIcon />
            Выйти
          </button>
        </form>
      </div>
    </div>
  );
}
