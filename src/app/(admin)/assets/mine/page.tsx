import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatFileSize, KIND_LABELS } from "@/lib/assets";
import { formatHubCreated } from "@/lib/hub-format";
import { withPlural, WORDS } from "@/lib/plural";
import {
  parseViewMode,
  VIEW_COOKIE,
  VIEW_GRID_CLASS,
  VIEW_LIST_CLASS,
} from "@/lib/view-mode";
import { ViewToggle } from "@/components/view-toggle";
import { PersonalAssetUploader } from "../personal-asset-uploader";
import { PersonalAssetRow, type PersonalAssetRowData } from "../personal-asset-row";
import { SectionTabs } from "../section-tabs";
import { OwnerSwitcher } from "./owner-switcher";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

// «Мои материалы» — личная библиотека: каждый видит и грузит только свои
// материалы (canAccessAssets достаточно — canAddAssets тут не нужен, см.
// permissions.ts). ADMIN — исключение: у него полный доступ везде (см.
// комментарий роли ADMIN в schema.prisma), поэтому ?user=<id> открывает
// ему чужую личную библиотеку через переключатель ниже.

export default async function MyAssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string }>;
}) {
  const user = await requireSection("assets");
  const view = parseViewMode((await cookies()).get(VIEW_COOKIE)?.value);

  const { user: requestedUserId } = await searchParams;

  const orgMembers =
    user.role === "ADMIN"
      ? await db.user.findMany({
          where: { organizationId: user.organizationId },
          select: { id: true, name: true, email: true },
          orderBy: { name: "asc" },
        })
      : [];

  let targetUserId = user.id;
  if (user.role === "ADMIN" && requestedUserId && requestedUserId !== user.id) {
    if (!orgMembers.some((m) => m.id === requestedUserId)) notFound();
    targetUserId = requestedUserId;
  }

  const isOwnLibrary = targetUserId === user.id;

  const assets = await db.asset.findMany({
    where: {
      organizationId: user.organizationId,
      ownerId: targetUserId,
      quoteId: null,
    },
    include: { _count: { select: { hubItems: true } } },
    orderBy: { createdAt: "desc" },
  });

  const toRow = (a: (typeof assets)[number]): PersonalAssetRowData => ({
    id: a.id,
    title: a.title,
    kind: a.kind,
    kindLabel: KIND_LABELS[a.kind],
    pageCount: a.pageCount,
    meta: [
      a.pageCount ? `${a.pageCount} стр.` : null,
      a.sizeBytes ? formatFileSize(a.sizeBytes) : null,
    ]
      .filter(Boolean)
      .join(" · "),
    updatedAt: formatHubCreated(a.updatedAt),
    hubCount: a._count.hubItems,
    archived: a.archivedAt !== null,
    hasThumbnail: a.thumbnailKey !== null,
    canThumbnail:
      a.kind === "PDF" ||
      a.kind === "VIDEO" ||
      a.kind === "IMAGE" ||
      a.kind === "DOCUMENT" ||
      a.kind === "SPREADSHEET",
    // Страница уже отфильтровала assets по ownerId=targetUserId, и дойти
    // сюда с чужим targetUserId мог только ADMIN (см. проверку выше) —
    // оба случая (сам владелец или ADMIN) имеют право управлять.
    canEdit: true,
    validated: a.validatedAt !== null,
  });

  const active = assets.filter((a) => a.archivedAt === null).map(toRow);
  const archived = assets.filter((a) => a.archivedAt !== null).map(toRow);

  const targetLabel = orgMembers.find((m) => m.id === targetUserId);

  return (
    <div>
      <PageHeader
        className="mb-4"
        title="Мои материалы"
        subtitle={
          isOwnLibrary
            ? "Личная библиотека — эти материалы видны и доступны для хабов только вам"
            : `Личная библиотека сотрудника: ${targetLabel?.name ?? targetLabel?.email ?? ""}`
        }
      />

      <SectionTabs
        current="mine"
        right={active.length > 0 ? <ViewToggle value={view} /> : null}
      />

      {orgMembers.length > 0 ? (
        <OwnerSwitcher
          members={orgMembers}
          currentUserId={user.id}
          selectedUserId={targetUserId}
        />
      ) : null}

      {/* Загрузка идёт от имени того, кто сейчас вошёл (target=mine в
          api/assets/upload/route.ts ставит ownerId = текущий пользователь) —
          у чужой библиотеки уполномоченного способа загрузить «за сотрудника»
          нет, поэтому загрузчик показываем только в своей собственной. */}
      {isOwnLibrary ? <PersonalAssetUploader /> : null}

      {active.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="font-medium">
            {isOwnLibrary ? "Пока пусто" : "У сотрудника пока пусто"}
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Загруженные сюда материалы видны только владельцу — их можно
            добавлять в хабы после подтверждения «Файл валидирован с
            руководством?».
          </p>
        </div>
      ) : (
        <ul className={view === "grid" ? VIEW_GRID_CLASS : VIEW_LIST_CLASS}>
          {active.map((asset) => (
            <PersonalAssetRow key={asset.id} asset={asset} view={view} />
          ))}
        </ul>
      )}

      {archived.length > 0 ? (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm text-muted transition hover:text-foreground">
            Удалённые — {withPlural(archived.length, WORDS.material)}
          </summary>

          <p className="mt-2 mb-3 max-w-xl text-xs text-muted">
            Клиенты их не видят, но статистика по ним сохранена. Файлы не
            стёрты — материал можно вернуть.
          </p>

          <ul className={view === "grid" ? VIEW_GRID_CLASS : VIEW_LIST_CLASS}>
            {archived.map((asset) => (
              <PersonalAssetRow key={asset.id} asset={asset} view={view} />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
