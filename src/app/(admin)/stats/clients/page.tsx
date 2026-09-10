import { requireSection } from "@/lib/auth";
import { cookies } from "next/headers";
import { visibleOwnerFilter } from "@/lib/permissions";
import { db } from "@/lib/db";
import { formatDuration, formatWhen, hubStats } from "@/lib/stats";
import { parseViewMode, VIEW_COOKIE } from "@/lib/view-mode";
import { ViewToggle } from "@/components/view-toggle";
import { StatsSortControl } from "@/components/stats-sort-control";
import { parseStatsSort, STATS_SORT_COOKIE } from "@/lib/stats-sort";
import { PageHeader } from "@/components/ui/page-header";
import { StatsTabs } from "../stats-tabs";
import { ClientHubList, type ClientHubRow } from "./hub-list";

export const dynamic = "force-dynamic";

export default async function StatsClientsPage() {
  const user = await requireSection("stats");
  const jar = await cookies();
  const view = parseViewMode(jar.get(VIEW_COOKIE)?.value);
  const grid = view === "grid";
  const sort = parseStatsSort(jar.get(STATS_SORT_COOKIE)?.value);

  const [hubs, stats] = await Promise.all([
    db.hub.findMany({
      where: {
        organizationId: user.organizationId,
        // Как и в «Хабах»/«Генераторе КП»: без полного доступа видно только
        // статистику по своим хабам плюс те, что явно открыл суперадмин.
        ...visibleOwnerFilter(user),
      },
      include: {
        owner: { select: { name: true, email: true } },
        _count: { select: { shareLinks: true, items: true } },
      },
    }),
    hubStats(user.organizationId),
  ]);

  // По умолчанию — сначала те, где было движение, и притом недавнее:
  // продавцу важно «кто зашевелился», а не алфавитный порядок. Остальные
  // поля выбираются панелью сортировки (см. StatsSortControl).
  const dirMul = sort.dir === "asc" ? 1 : -1;
  const rows = hubs.map((hub) => ({ hub, stat: stats.get(hub.id)! })).sort((a, b) => {
    switch (sort.field) {
      case "visits":
        return dirMul * (a.stat.visits - b.stat.visits);
      case "duration":
        return dirMul * (a.stat.totalMs - b.stat.totalMs);
      case "title":
        return dirMul * a.hub.title.localeCompare(b.hub.title, "ru");
      default: {
        const at = a.stat.lastSeenAt?.getTime() ?? 0;
        const bt = b.stat.lastSeenAt?.getTime() ?? 0;
        return dirMul * (at - bt);
      }
    }
  });

  const touched = rows.filter((r) => r.stat.visits > 0);

  // Числа/даты форматируем здесь — hub-list.tsx клиентский, а форматтеры
  // живут в lib/stats.ts, помеченном "server-only".
  const clientRows: ClientHubRow[] = rows.map(({ hub, stat }) => ({
    hubId: hub.id,
    title: hub.title,
    isDraft: hub.status !== "PUBLISHED",
    itemsCount: hub._count.items,
    linksCount: hub._count.shareLinks,
    visits: stat.visits,
    durationLabel: formatDuration(stat.totalMs),
    lastSeenLabel: formatWhen(stat.lastSeenAt),
  }));

  return (
    <div>
      <StatsTabs current="clients" />
      <PageHeader
        className="mb-6"
        title="Статистика по клиентам"
        subtitle="Кто из клиентов что смотрел и сколько времени"
        actions={
          hubs.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <StatsSortControl sort={sort} />
              {/* Плитка на телефоне не несёт своей визуальной идентичности
                  (в отличие от Хабов) — переключатель имеет смысл только
                  от sm: и шире, где карточки реально становятся тайлами. */}
              <div className="hidden sm:block">
                <ViewToggle value={view} />
              </div>
            </div>
          ) : null
        }
      />

      {hubs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="font-medium">Хабов пока нет</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Соберите хаб и отправьте ссылку клиенту — здесь появится, что он
            смотрел.
          </p>
        </div>
      ) : (
        <>
          {touched.length === 0 ? (
            <p className="mb-4 rounded-lg bg-warn/10 px-3 py-2 text-sm text-warn">
              Ссылки ещё никто не открывал. Данные появятся после первого захода
              клиента.
            </p>
          ) : null}

          <ClientHubList rows={clientRows} grid={grid} />
        </>
      )}
    </div>
  );
}
