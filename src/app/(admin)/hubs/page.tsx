import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseViewMode, VIEW_COOKIE } from "@/lib/view-mode";
import {
  hubOrderBy,
  HUB_SORT_COOKIE,
  parseHubSort,
} from "@/lib/hub-sort";
import { formatHubCreated } from "@/lib/hub-format";
import { ViewToggle } from "@/components/view-toggle";
import { HubSortControl } from "@/components/hub-sort-control";
import { CreateHubForm } from "./create-hub-form";
import { HubList, type HubRow } from "./hub-list";
import { HubTabs } from "./hub-tabs";

export default async function HubsPage() {
  const user = await requireUser();
  const jar = await cookies();
  const view = parseViewMode(jar.get(VIEW_COOKIE)?.value);
  const sort = parseHubSort(jar.get(HUB_SORT_COOKIE)?.value);

  const hubs = await db.hub.findMany({
    where: {
      organizationId: user.organizationId,
      // Продавец видит свои хабы, администратор — все.
      ...(user.role === "ADMIN" ? {} : { ownerId: user.id }),
      // Удалённые живут в своём разделе — здесь они только мешали бы.
      status: { not: "ARCHIVED" },
    },
    include: {
      _count: { select: { items: true, shareLinks: true } },
      folder: { select: { name: true } },
    },
    orderBy: hubOrderBy(sort),
  });

  const rows: HubRow[] = hubs.map((h) => ({
    id: h.id,
    title: h.title,
    status: h.status,
    items: h._count.items,
    links: h._count.shareLinks,
    folderName: h.folder?.name ?? null,
    createdLabel: formatHubCreated(h.createdAt),
  }));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Хабы</h1>
          <p className="mt-0.5 text-sm text-muted">
            Подборки материалов, которые вы отправляете клиентам
          </p>
        </div>
        <CreateHubForm />
      </div>

      <HubTabs
        current="all"
        right={
          rows.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <HubSortControl sort={sort} />
              <ViewToggle value={view} />
            </div>
          ) : null
        }
      />

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="font-medium">Пока ни одного хаба</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Хаб — это брендированная страница с подборкой материалов, которую вы
            отправляете клиенту одной ссылкой.
          </p>
        </div>
      ) : (
        // Папку показываем здесь: на общем списке хабы вперемешку, и без
        // подписи непонятно, чей это хаб.
        <HubList hubs={rows} showFolder view={view} />
      )}
    </div>
  );
}
