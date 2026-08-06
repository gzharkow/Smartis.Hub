import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import { logout } from "@/app/actions/auth";
import { LogoutIcon } from "../../nav-icons";
import { ThemeToggle } from "../../theme-toggle";
import { SettingsTabs } from "../settings-tabs";
import { ChangePasswordButton } from "./change-password-dialog";

export default async function GeneralSettingsPage() {
  const user = await requireUser();
  const jar = await cookies();
  const theme = parseTheme(jar.get(THEME_COOKIE)?.value);
  const isAdmin = user.role === "ADMIN";

  return (
    <div className="grid max-w-md gap-8">
      <div>
        <SettingsTabs current="general" isAdmin={isAdmin} />
        <h1 className="text-xl font-semibold tracking-tight">Общие</h1>
        <p className="mt-0.5 text-sm text-muted">Аккаунт, тема оформления и выход</p>
      </div>

      <section className="grid gap-3 rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm">Тема</span>
          <ThemeToggle initial={theme} />
        </div>

        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="text-sm text-muted">Вы вошли как</span>
          <span className="truncate text-sm font-medium" title={user.email}>
            {user.email}
          </span>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <ChangePasswordButton />
      </section>

      <form action={logout}>
        <button
          type="submit"
          className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-muted transition hover:bg-border/60 hover:text-foreground"
        >
          <LogoutIcon />
          Выйти
        </button>
      </form>
    </div>
  );
}
