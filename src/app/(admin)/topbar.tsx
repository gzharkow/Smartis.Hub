import { logout } from "@/app/actions/auth";
import { GlobalSearch } from "@/components/global-search";
import { LogoutIcon } from "./nav-icons";
import { ThemeToggle } from "./theme-toggle";
import type { Theme } from "@/lib/theme";

/**
 * Верхняя полоса над содержимым.
 *
 * Здесь живёт всё, что относится к самому кабинету, а не к разделу: тема,
 * почта вошедшего, выход.
 *
 * Полоса не тянется поверх бокового меню, а начинается справа от него —
 * логотип уже стоит в меню, дублировать его в двух местах незачем.
 */
export function Topbar({
  email,
  theme,
}: {
  email: string;
  theme: Theme | null;
}) {
  return (
    // bg-surface, тот же, что у бокового меню: вместе они читаются как одна
    // рамка вокруг содержимого. Полоса непрозрачная — просвечивающий текст
    // под ней при прокрутке выглядел грязно.
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-3 pr-6">
      {/* Переключатель темы — у самого стыка с боковым меню: он про вид
          всего кабинета, а не про то, что справа (кто вошёл и выход). */}
      <ThemeToggle initial={theme} />

      <div className="flex min-w-0 items-center gap-3">
        {/* Поиск сквозной — не про раздел, где сейчас находишься, поэтому
            живёт в шапке кабинета, слева от того, кто вошёл. */}
        <GlobalSearch />

        {/* На телефоне полю всё равно некуда влезать целиком — обрезанная
            почта нечитаема и бесполезна. С sm и шире места достаточно. */}
        <span className="hidden truncate text-sm text-muted sm:inline" title={email}>
          {email}
        </span>

        <form action={logout}>
          <button
            type="submit"
            className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-muted transition hover:bg-border/60 hover:text-foreground"
          >
            <LogoutIcon />
            Выйти
          </button>
        </form>
      </div>
    </header>
  );
}
