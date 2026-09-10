import { cookies } from "next/headers";
import { requireSection } from "@/lib/auth";
import { hasEdit } from "@/lib/permissions";
import { db } from "@/lib/db";
import { parseViewMode, VIEW_COOKIE, VIEW_LIST_CLASS } from "@/lib/view-mode";
import { ViewToggle } from "@/components/view-toggle";
import { HubTabs } from "../hub-tabs";
import { CreateFolderForm } from "./create-folder-form";
import { FolderRow } from "./folder-row";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

// Своя, более плотная сетка (не общая VIEW_GRID_CLASS): плитка папки —
// маленькая иконка с подписью, а не насыщенная карточка хаба, поэтому даже
// на экране телефона в ряд помещается две, а не одна.
const FOLDERS_GRID_CLASS =
  "grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6";

export default async function FoldersPage() {
  const user = await requireSection("hubs");
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

  const canEdit = hasEdit(user, "hubs.folders");

  return (
    <div>
      <PageHeader
        className="mb-4"
        title="Папки"
        subtitle="Чтобы под одним аккаунтом хабы разных сотрудников не терялись"
        actions={canEdit ? <CreateFolderForm /> : null}
      />

      <HubTabs
        current="folders"
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
        <ul className={view === "grid" ? FOLDERS_GRID_CLASS : VIEW_LIST_CLASS}>
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
    </div>
  );
}
