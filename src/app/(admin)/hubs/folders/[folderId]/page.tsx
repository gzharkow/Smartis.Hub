import Link from "next/link";
import { requireSection } from "@/lib/auth";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { showsOtherOwners, visibleOwnerFilter } from "@/lib/permissions";
import { db } from "@/lib/db";
import { parseViewMode, VIEW_COOKIE } from "@/lib/view-mode";
import { DEFAULT_HUB_SORT, hubOrderBy, HUB_SORT_COOKIE, parseHubSort } from "@/lib/hub-sort";
import { ownerLabel } from "@/lib/owner-color";
import { ViewToggle } from "@/components/view-toggle";
import { HubSortControl } from "@/components/hub-sort-control";
import { HubList, type HubRow } from "../../hub-list";
import { DEFAULT_BRAND_COLOR } from "@/lib/brand-color";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export default async function FolderPage({
  params,
}: {
  params: Promise<{ folderId: string }>;
}) {
  const { folderId } = await params;
  const user = await requireSection("hubs");
  const isAdmin = user.role === "ADMIN";
  const jar = await cookies();
  const view = parseViewMode(jar.get(VIEW_COOKIE)?.value);
  let sort = parseHubSort(jar.get(HUB_SORT_COOKIE)?.value);
  if (sort.field === "creator" && !isAdmin) sort = DEFAULT_HUB_SORT;

  const folder = await db.hubFolder.findUnique({ where: { id: folderId } });

  // Чужой организации папки «не существует».
  if (!folder || folder.organizationId !== user.organizationId) notFound();

  const hubs = await db.hub.findMany({
    where: {
      organizationId: user.organizationId,
      ...visibleOwnerFilter(user),
      status: { not: "ARCHIVED" },
      folderId: folder.id,
    },
    include: {
      _count: { select: { items: true, shareLinks: true } },
      // Бренд организации — фоллбэк для плитки, если у хаба свой не задан.
      organization: { select: { brandColor: true, logoUrl: true } },
      ...(showsOtherOwners(user)
        ? { owner: { select: { id: true, name: true, email: true } } }
        : {}),
    },
    orderBy: hubOrderBy(sort),
  });

  const rows: HubRow[] = hubs.map((h) => ({
    id: h.id,
    title: h.title,
    status: h.status,
    items: h._count.items,
    links: h._count.shareLinks,
    folderName: null,
    createdAt: h.createdAt,
    owner:
      "owner" in h && h.owner
        ? { id: h.owner.id, label: ownerLabel(h.owner) }
        : null,
    brandColor: h.brandColor ?? h.organization.brandColor ?? DEFAULT_BRAND_COLOR,
    logoUrl: h.logoUrl ?? h.organization.logoUrl ?? "/logo.png",
    canManage: isAdmin || h.ownerId === user.id,
  }));

  return (
    <div>
      <Link
        href="/hubs/folders"
        className="text-sm text-muted transition hover:text-foreground"
      >
        ← Все папки
      </Link>

      <PageHeader
        className="mt-2 mb-6"
        title={folder.name}
        actions={
          rows.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <HubSortControl sort={sort} isAdmin={isAdmin} />
              <ViewToggle value={view} />
            </div>
          ) : null
        }
      />

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="font-medium">В папке пусто</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Откройте нужный хаб и выберите эту папку в строке «Папка».
          </p>
        </div>
      ) : (
        // Название папки в строках не повторяем — оно в заголовке.
        <HubList hubs={rows} view={view} backHref={`/hubs/folders/${folder.id}`} />
      )}
    </div>
  );
}
