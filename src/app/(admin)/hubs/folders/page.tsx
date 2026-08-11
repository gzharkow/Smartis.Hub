import { cookies } from "next/headers";
import { requireSectionView, hasEdit } from "@/lib/permissions";
import { db } from "@/lib/db";
import { withPlural, WORDS } from "@/lib/plural";
import {
  parseViewMode,
  VIEW_COOKIE,
  VIEW_GRID_CLASS,
  VIEW_LIST_CLASS,
} from "@/lib/view-mode";
import { ViewToggle } from "@/components/view-toggle";
import { HubTabs, hubTabVisibleKeys } from "../hub-tabs";
import { CreateFolderForm } from "./create-folder-form";
import { FolderRow } from "./folder-row";

export const dynamic = "force-dynamic";

export default async function FoldersPage() {
  const user = await requireSectionView("hubs.folders");
  const view = parseViewMode((await cookies()).get(VIEW_COOKIE)?.value);

  const folders = await db.hubFolder.findMany({
    where: { organizationId: user.organizationId },
    include: {
      _count: {
        // Считаем только живые хабы: удалённые лежат в своём разделе,
        // и подписывать папку «3 хаба», когда два из них в корзине, — вранье.
        select: { hubs: { where: { status: { not: "ARCHIVED" } } } },
      },
    },
    orderBy: { name: "asc" },
  });

  const looseCount = await db.hub.count({
    where: {
      organizationId: user.organizationId,
      status: { not: "ARCHIVED" },
      folderId: null,
    },
  });

  const canEdit = hasEdit(user, "hubs.folders");

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Папки</h1>
          <p className="mt-0.5 text-sm text-muted">
            Чтобы под одним аккаунтом хабы разных сотрудников не терялись
          </p>
        </div>
        {canEdit ? <CreateFolderForm /> : null}
      </div>

      <HubTabs
        current="folders"
        visibleKeys={hubTabVisibleKeys(user)}
        right={folders.length > 0 ? <ViewToggle value={view} /> : null}
      />

      {folders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="font-medium">Папок пока нет</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Заведите папку на каждого сотрудника — и складывайте туда хабы его
            клиентов. Папку видят все, доступ она не ограничивает.
          </p>
        </div>
      ) : (
        <ul className={view === "grid" ? VIEW_GRID_CLASS : VIEW_LIST_CLASS}>
          {folders.map((folder) => (
            <FolderRow
              key={folder.id}
              view={view}
              canEdit={canEdit}
              folder={{
                id: folder.id,
                name: folder.name,
                hubCount: folder._count.hubs,
                color: folder.color,
              }}
            />
          ))}
        </ul>
      )}

      {looseCount > 0 ? (
        <p className="mt-4 text-sm text-muted">
          Вне папок — {withPlural(looseCount, WORDS.hub)}. Папка выбирается на
          странице самого хаба.
        </p>
      ) : null}
    </div>
  );
}
