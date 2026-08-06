import Link from "next/link";
import { cookies } from "next/headers";
import { requireSectionView } from "@/lib/permissions";
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

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const user = await requireSectionView("stats");
  const view = parseViewMode((await cookies()).get(VIEW_COOKIE)?.value);
  const grid = view === "grid";

  const [hubs, stats] = await Promise.all([
    db.hub.findMany({
      where: {
        organizationId: user.organizationId,
        // Как и в «Хабах»/«Генераторе КП»: без полного доступа видно только
        // статистику по своим хабам, не по всей организации.
        ...(user.role === "ADMIN" ? {} : { ownerId: user.id }),
      },
      include: {
        owner: { select: { name: true, email: true } },
        _count: { select: { shareLinks: true, items: true } },
      },
    }),
    hubStats(user.organizationId),
  ]);

  // Сначала те, где было движение, и притом недавнее: продавцу важно
  // «кто зашевелился», а не алфавитный порядок.
  const rows = hubs
    .map((hub) => ({ hub, stat: stats.get(hub.id)! }))
    .sort((a, b) => {
      const at = a.stat.lastSeenAt?.getTime() ?? 0;
      const bt = b.stat.lastSeenAt?.getTime() ?? 0;
      return bt - at;
    });

  const touched = rows.filter((r) => r.stat.visits > 0);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Статистика</h1>
          <p className="mt-0.5 text-sm text-muted">
            Кто из клиентов что смотрел и сколько времени
          </p>
        </div>
        {hubs.length > 0 ? <ViewToggle value={view} /> : null}
      </div>

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
            <p className="mb-4 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              Ссылки ещё никто не открывал. Данные появятся после первого захода
              клиента.
            </p>
          ) : null}

          <ul className={grid ? VIEW_GRID_CLASS : VIEW_LIST_CLASS}>
            {rows.map(({ hub, stat }) => (
              <li key={hub.id}>
                <Link
                  href={`/stats/${hub.id}`}
                  className={`rounded-xl border border-border bg-surface px-4 py-3 transition hover:border-muted ${
                    grid
                      ? "flex h-full flex-col gap-2"
                      : "grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center"
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
                      className={`text-sm text-muted ${grid ? "mt-auto pt-1" : ""}`}
                    >
                      не открывали
                    </span>
                  ) : (
                    <div
                      className={`flex items-center gap-4 text-sm ${
                        grid
                          ? "mt-auto flex-wrap pt-1"
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
