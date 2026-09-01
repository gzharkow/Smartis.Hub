import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { cookies } from "next/headers";
import { visibleOwnerFilter } from "@/lib/permissions";
import { db } from "@/lib/db";
import { formatDuration, formatWhen, hubStats } from "@/lib/stats";
import { plural, withPlural, WORDS } from "@/lib/plural";
import {
  parseViewMode,
  VIEW_COOKIE,
  VIEW_GRID_CLASS,
  VIEW_LIST_CLASS,
} from "@/lib/view-mode";
import { ViewToggle } from "@/components/view-toggle";
import { StatsSortControl } from "@/components/stats-sort-control";
import { parseStatsSort, STATS_SORT_COOKIE } from "@/lib/stats-sort";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const user = await requireUser();
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

  return (
    <div>
      <PageHeader
        className="mb-6"
        title="Статистика"
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

          <ul className={grid ? VIEW_GRID_CLASS : VIEW_LIST_CLASS}>
            {rows.map(({ hub, stat }) => (
              <li key={hub.id}>
                <Link
                  href={`/stats/${hub.id}`}
                  className={`rounded-xl border border-border bg-surface px-4 py-3 transition hover:border-muted grid gap-2 ${
                    // Плитка на телефоне не имеет собственной визуальной
                    // идентичности (в отличие от Хабов) — все плиточные
                    // особенности (высота, flex-col) начинаются только с
                    // sm:, на телефоне разметка всегда как у списка,
                    // независимо от cookie sf_view.
                    grid
                      ? "sm:flex sm:h-[176px] sm:flex-col"
                      : "sm:grid-cols-[1fr_auto] sm:items-center"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{hub.title}</p>
                    <p className="mt-0.5 text-sm text-muted">
                      {withPlural(hub._count.items, WORDS.material)} ·{" "}
                      {withPlural(hub._count.shareLinks, WORDS.link)}
                      {hub.status !== "PUBLISHED" ? " · черновик" : ""}
                    </p>
                  </div>

                  {stat.visits === 0 ? (
                    <span
                      className={`text-sm text-muted ${grid ? "sm:mt-auto sm:pt-1" : ""}`}
                    >
                      не открывали
                    </span>
                  ) : (
                    <div
                      className={`flex items-center gap-4 text-sm ${
                        grid
                          ? "sm:mt-auto sm:flex-wrap sm:pt-1"
                          : "shrink-0 sm:justify-end"
                      }`}
                    >
                      <span>
                        <b className="font-semibold">{stat.visits}</b>
                        <span className="text-muted">
                          {" "}
                          {plural(stat.visits, WORDS.visit)}
                        </span>
                      </span>
                      <span title="Суммарное время просмотра">
                        <b className="font-semibold">
                          {formatDuration(stat.totalMs)}
                        </b>
                      </span>
                      <span
                        className={
                          grid ? "text-muted" : "w-24 text-right text-muted"
                        }
                      >
                        {formatWhen(stat.lastSeenAt)}
                      </span>
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
