import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatHubCreated } from "@/lib/hub-format";
import { CreateAccountForm } from "./create-account-form";
import { AccountsTable, type AccountRow } from "./accounts-table";
import { SettingsTabs } from "../settings-tabs";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export default async function AdministrationPage() {
  const admin = await requireAdmin();

  const users = await db.user.findMany({
    where: { organizationId: admin.organizationId },
    include: { visibleOwners: { select: { id: true } } },
    orderBy: { createdAt: "desc" },
  });

  const accounts: AccountRow[] = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    canAccessHubs: u.canAccessHubs,
    canAccessAssets: u.canAccessAssets,
    canAccessStats: u.canAccessStats,
    canAccessCalculator: u.canAccessCalculator,
    canAddAssets: u.canAddAssets,
    visibleOwnerIds: u.visibleOwners.map((o) => o.id),
    createdLabel: formatHubCreated(u.createdAt),
  }));

  // Для выбора «чьи хабы/расчёты видит новый аккаунт» — все остальные
  // аккаунты организации, каждому свой список выбирать не из чего.
  const accountOptions = accounts.map((a) => ({ id: a.id, email: a.email, name: a.name }));

  return (
    <div className="grid gap-8">
      <div>
        <SettingsTabs current="administration" isAdmin={true} />
        <PageHeader title="Администрирование" subtitle="Создание аккаунтов сотрудников и настройка их доступа" />
      </div>

      <section className="grid gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-muted uppercase">
          Новый аккаунт
        </h2>
        <CreateAccountForm accountOptions={accountOptions} />
      </section>

      <section className="grid gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-muted uppercase">
          Аккаунты
        </h2>
        <AccountsTable
          accounts={accounts}
          accountOptions={accountOptions}
          currentUserEmail={admin.email}
          currentUserId={admin.id}
        />
      </section>
    </div>
  );
}
