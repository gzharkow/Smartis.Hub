import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import { logout } from "@/app/actions/auth";
import { LogoutIcon } from "../../nav-icons";
import { ThemeToggle } from "../../theme-toggle";
import { SettingsTabs } from "../settings-tabs";
import { ChangePasswordButton } from "./change-password-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { cardClasses } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";

export default async function GeneralSettingsPage() {
  const user = await requireUser();
  const jar = await cookies();
  const theme = parseTheme(jar.get(THEME_COOKIE)?.value);
  const isAdmin = user.role === "ADMIN";

  return (
    <div className="grid max-w-md gap-8">
      <div>
        <SettingsTabs current="general" isAdmin={isAdmin} />
        <PageHeader title="Общие" subtitle="Аккаунт, тема оформления и выход" />
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

      <section className={cardClasses("panel")}>
        <ChangePasswordButton />
      </section>

      <form action={logout}>
        <button
          type="submit"
          className={buttonClasses("secondary", "md", "text-muted hover:text-foreground")}
        >
          <LogoutIcon />
          Выйти
        </button>
      </form>
    </div>
  );
}
