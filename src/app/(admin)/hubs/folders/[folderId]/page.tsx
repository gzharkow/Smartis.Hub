import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseViewMode, VIEW_COOKIE } from "@/lib/view-mode";
import { hubOrderBy, HUB_SORT_COOKIE, parseHubSort } from "@/lib/hub-sort";
import { formatHubCreated } from "@/lib/hub-format";
import { ViewToggle } from "@/components/view-toggle";
import { HubSortControl } from "@/components/hub-sort-control";
import { HubList, type HubRow } from "../../hub-list";

export const dynamic = "force-dynamic";

export default async function FolderPage({
  params,
}: {
  params: Promise<{ folderId: string }>;
}) {
  const { folderId } = await params;
  const user = await requireUser();
  const jar = await cookies();
  const view = parseViewMode(jar.get(VIEW_COOKIE)?.value);
  const sort = parseHubSort(jar.get(HUB_SORT_COOKIE)?.value);

  const folder = await db.hubFolder.findUnique({ where: { id: folderId } });

  // Чужой организации папки «не существует».
  if (!folder || folder.organizationId !== user.organizationId) notFound();

  const hubs = await db.hub.findMany({
    where: {
      organizationId: user.organizationId,
      ...(user.role === "ADMIN" ? {} : { ownerId: user.id }),
      status: { not: "ARCHIVED" },
      folderId: folder.id,
    },
    include: { _count: { select: { items: true, shareLinks: true } } },
    orderBy: hubOrderBy(sort),
  });

  const rows: HubRow[] = hubs.map((h) => ({
    id: h.id,
    title: h.title,
    status: h.status,
    items: h._count.items,
    links: h._count.shareLinks,
    folderName: null,
    createdLabel: formatHubCreated(h.createdAt),
  }));

  return (
    <div>
      <Link
        href="/hubs/folders"
        className="text-sm text-muted transition hover:text-foreground"
      >
        ← Все папки
      </Link>

      <div className="mt-2 mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{folder.name}</h1>
        {rows.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <HubSortControl sort={sort} />
            <ViewToggle value={view} />
          </div>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="font-medium">В папке пусто</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Откройте нужный хаб и выберите эту папку в строке «Папка».
          </p>
        </div>
      ) : (
        // Название папки в строках не повторяем — оно в заголовке.
        <HubList hubs={rows} view={view} />
      )}
    </div>
  );
}
