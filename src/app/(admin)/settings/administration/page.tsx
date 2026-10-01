import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { CreateAccountForm } from "./create-account-form";
import { AccountsTable, type AccountRow } from "./accounts-table";
import { SecurityJournal, parseJournalParams } from "./security-journal";
import { AdminAccordion } from "./admin-accordion";
import { SettingsTabs } from "../settings-tabs";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export default async function AdministrationPage({
  searchParams,
}: {
  searchParams: Promise<{ journal?: string; n?: string }>;
}) {
  const admin = await requireAdmin();
  const journal = parseJournalParams(await searchParams);

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
    canAccessKpi: u.canAccessKpi,
    canManageKpi: u.canManageKpi,
    canAddAssets: u.canAddAssets,
    visibleOwnerIds: u.visibleOwners.map((o) => o.id),
    createdAt: u.createdAt,
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

      <AdminAccordion title="Новый аккаунт">
        <CreateAccountForm accountOptions={accountOptions} />
      </AdminAccordion>

      <AdminAccordion title="Аккаунты" hint={String(accounts.length)}>
        <AccountsTable
          accounts={accounts}
          accountOptions={accountOptions}
          currentUserEmail={admin.email}
          currentUserId={admin.id}
        />
      </AdminAccordion>

      <SecurityJournal
        organizationId={admin.organizationId}
        type={journal.type}
        limit={journal.limit}
      />
    </div>
  );
}
