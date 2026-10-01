import { cookies } from "next/headers";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseViewMode, VIEW_COOKIE } from "@/lib/view-mode";
import {
  DEFAULT_HUB_SORT,
  hubOrderBy,
  HUB_SORT_COOKIE,
  parseHubSort,
} from "@/lib/hub-sort";
import { hasEdit, showsOtherOwners, visibleOwnerFilter } from "@/lib/permissions";
import { ownerLabel } from "@/lib/owner-color";
import { ViewToggle } from "@/components/view-toggle";
import { HubSortControl } from "@/components/hub-sort-control";
import { ListFilterControl } from "@/components/list-filter-control";
import { loadListFilter } from "@/lib/list-filter-server";
import { listFilterWhere } from "@/lib/list-filter";
import { CreateHubForm } from "./create-hub-form";
import { HubList, type HubRow } from "./hub-list";
import { HubTabs } from "./hub-tabs";
import { DEFAULT_BRAND_COLOR } from "@/lib/brand-color";
import { PageHeader } from "@/components/ui/page-header";

export default async function HubsPage() {
  const user = await requireSection("hubs");
  const isAdmin = user.role === "ADMIN";
  const jar = await cookies();
  const view = parseViewMode(jar.get(VIEW_COOKIE)?.value);
  let sort = parseHubSort(jar.get(HUB_SORT_COOKIE)?.value);
  // «Создателю» — только для ADMIN; подделанную cookie у MEMBER молча
  // откатываем на дефолт, а не падаем и не даём подглядывать порядок.
  if (sort.field === "creator" && !isAdmin) sort = DEFAULT_HUB_SORT;

  const { filter, creators, active } = await loadListFilter("hubs", user);

  const hubs = await db.hub.findMany({
    where: {
      organizationId: user.organizationId,
      // Продавец видит свои хабы плюс те, что явно открыл суперадмин.
      ...visibleOwnerFilter(user),
      // Удалённые живут в своём разделе — здесь они только мешали бы.
      status: { not: "ARCHIVED" },
      ...listFilterWhere(filter, "hub"),
    },
    include: {
      _count: { select: { items: true, shareLinks: true } },
      folder: { select: { name: true } },
      // Бренд организации — фоллбэк для плитки, если у хаба свой не задан.
      organization: { select: { brandColor: true, logoUrl: true } },
      // Только чтобы показать бейдж автора — список может содержать хабы
      // разных сотрудников вперемешку (у ADMIN всегда, у MEMBER — если
      // ему открыли видимость чужих).
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
    folderName: h.folder?.name ?? null,
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
      <PageHeader
        className="mb-4"
        title="Хабы"
        subtitle="Подборки материалов, которые вы отправляете клиентам"
        actions={hasEdit(user, "hubs") ? <CreateHubForm /> : null}
      />

      <HubTabs
        current="all"
        right={
          rows.length > 0 || active ? (
            <div className="flex flex-wrap items-center gap-2">
              <ListFilterControl scope="hubs" filter={filter} creators={creators} />
              <HubSortControl sort={sort} isAdmin={isAdmin} />
              <ViewToggle value={view} />
            </div>
          ) : null
        }
      />

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="font-medium">{active ? "Ничего не найдено" : "Пока ни одного хаба"}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            {active ? "Измените фильтр, чтобы увидеть другие хабы." : "Хаб — это брендированная страница с подборкой материалов, которую вы отправляете клиенту одной ссылкой."}
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
