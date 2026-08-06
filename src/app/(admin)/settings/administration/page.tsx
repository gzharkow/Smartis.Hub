import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatHubCreated } from "@/lib/hub-format";
import { parsePermissions } from "@/lib/access-levels";
import { CreateAccountForm } from "./create-account-form";
import { AccountsTable, type AccountRow, type AccessLevelOption } from "./accounts-table";
import { AccessLevelsPanel, type AccessLevelData } from "./access-levels-panel";
import { SettingsTabs } from "../settings-tabs";

export const dynamic = "force-dynamic";

export default async function AdministrationPage() {
  const admin = await requireAdmin();

  const [users, levels] = await Promise.all([
    db.user.findMany({
      where: { organizationId: admin.organizationId },
      include: { accessLevel: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.accessLevel.findMany({
      where: { organizationId: admin.organizationId },
      include: { _count: { select: { users: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const accounts: AccountRow[] = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    accessLevelId: u.accessLevel?.id ?? null,
    accessLevelName: u.accessLevel?.name ?? null,
    createdLabel: formatHubCreated(u.createdAt),
  }));

  const accessLevelOptions: AccessLevelOption[] = levels.map((l) => ({
    id: l.id,
    name: l.name,
    permissions: parsePermissions(l.permissions),
  }));

  const accessLevelData: AccessLevelData[] = levels.map((l) => ({
    id: l.id,
    name: l.name,
    permissions: parsePermissions(l.permissions),
    userCount: l._count.users,
  }));

  return (
    <div className="grid gap-8">
      <div>
        <SettingsTabs current="administration" isAdmin={true} />
        <h1 className="text-xl font-semibold tracking-tight">Администрирование</h1>
        <p className="mt-0.5 text-sm text-muted">
          Создание аккаунтов сотрудников и настройка их доступа к разделам сайта
        </p>
      </div>

      <section className="grid gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-muted uppercase">
          Новый аккаунт
        </h2>
        <CreateAccountForm accessLevels={accessLevelOptions} />
      </section>

      <section className="grid gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-muted uppercase">
          Аккаунты
        </h2>
        <AccountsTable accounts={accounts} accessLevels={accessLevelOptions} />
      </section>

      <section className="grid gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-muted uppercase">
          Уровни доступа
        </h2>
        <AccessLevelsPanel levels={accessLevelData} />
      </section>
    </div>
  );
}
