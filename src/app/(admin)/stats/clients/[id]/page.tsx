import Link from "next/link";
import { requireSection } from "@/lib/auth";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { KIND_LABELS } from "@/lib/assets";
import {
  formatDuration,
  hubDetail,
  visitTimeline,
  timeDonutSegments,
  readDepthSegment,
  type ItemStats,
} from "@/lib/stats";
import { parseStatsRange } from "@/lib/stats-range";
import { StatsRangePicker } from "@/components/stats-range-picker";
import { LocalDateTime } from "@/components/local-datetime";
import { withPlural, WORDS } from "@/lib/plural";
import type { AssetKind } from "@/generated/prisma/enums";
import { StatusPill } from "./components/status-pill";
import { KpiTile } from "./components/kpi-tile";
import { DonutChart } from "./components/donut-chart";
import { RankedBarChart } from "./components/ranked-bar-chart";
import { PageHeatmap } from "./components/page-heatmap";
import { VideoWatchHeatmap } from "./components/video-watch-heatmap";
import { VisitTimeline } from "./components/visit-timeline";
import { cardClasses } from "@/components/ui/card";

export const dynamic = "force-dynamic";

/** Строка-подпись под материалом. Однострочные PDF и ссылки — по особым
 * правилам из ТЗ (не путать «дочитанность» однострочника с настоящей
 * глубиной; для ссылок глубина в принципе недоступна). */
function itemMeta(item: ItemStats): string {
  const parts: string[] = [`открывали ${withPlural(item.opens, WORDS.time)}`];
  if (item.downloads > 0) {
    parts.push(`скачивали ${withPlural(item.downloads, WORDS.time)}`);
  }

  if (item.kind === "LINK") {
    parts.push(`переходов: ${item.linkClicks}`, "глубина недоступна");
  } else if (item.kind === "PDF" && item.isSinglePage) {
    parts.push("1 стр. — прочитан полностью");
  } else if (item.kind === "PDF" && item.maxPage && item.pageCount) {
    parts.push(`долистали до ${item.maxPage}-й из ${item.pageCount}`);
  } else if (item.kind === "VIDEO" && item.videoWatch) {
    const full = item.videoWatch.milestones.find((m) => m.pct === 100);
    parts.push(
      full && full.reached > 0
        ? `досмотрели полностью ${withPlural(full.reached, WORDS.time)}`
        : "не досмотрели до конца",
    );
  }

  return parts.join(" · ");
}

export default async function HubStatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { id } = await params;
  const user = await requireSection("stats");
  const range = parseStatsRange(await searchParams);

  const hub = await db.hub.findUnique({
    where: { id },
    include: { items: { include: { asset: true } } },
  });

  if (!hub || hub.organizationId !== user.organizationId) notFound();
  if (user.role !== "ADMIN" && hub.ownerId !== user.id) notFound();

  const links = await hubDetail(hub.id, range);
  const opened = links.filter((l) => l.visits > 0);
  const untouched = links.filter((l) => l.visits === 0);
  const timelines = await Promise.all(
    opened.map((link) => visitTimeline(link.linkId, range)),
  );

  return (
    <div className="grid grid-cols-1 gap-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/stats/clients"
            className="text-sm text-muted transition hover:text-foreground"
          >
            ← Список клиентов
          </Link>
          <h1 className="mt-2 text-xl font-semibold tracking-tight">{hub.title}</h1>
          <p className="mt-0.5 text-sm text-muted">
            {withPlural(links.length, WORDS.link)} ·{" "}
            {withPlural(hub.items.length, WORDS.material)}
          </p>
        </div>

        {/* Период применяется только к цифрам ниже — сам хаб и список ссылок
            от него не зависят. */}
        <StatsRangePicker range={range} />
      </div>

      {range && links.length > 0 && opened.length === 0 ? (
        <p className="rounded-lg bg-warn/10 px-3 py-2 text-sm text-warn">
          За выбранный период ссылки не открывали.
        </p>
      ) : null}

      {links.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="font-medium">Ссылок ещё не выдавали</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            <Link href={`/hubs/${hub.id}`} className="text-accent underline">
              Выдайте ссылку клиенту
            </Link>{" "}
            — и здесь появится, что он смотрел.
          </p>
        </div>
      ) : null}

      {opened.map((link, idx) => {
        const timeline = timelines[idx];
        const timeSegments = timeDonutSegments(link.items);
        const depthSeg = readDepthSegment(link.readDepth);
        const materialsWithTime = link.items.filter((i) => i.totalMs > 0).length;
        const depthPct = link.readDepth.pct != null ? Math.round(link.readDepth.pct * 100) : null;

        return (
          <section key={link.linkId} className="grid grid-cols-1 gap-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border pb-3">
              <h2 className="text-lg font-semibold tracking-tight">
                {link.company ?? "Без названия"}
              </h2>
              <StatusPill tag={link.statusTag} />
              <span className="text-xs text-muted">
                Последний заход: <LocalDateTime kind="relative" date={link.lastSeenAt} />
              </span>
              {link.revoked ? (
                <span className="rounded bg-border/70 px-1.5 py-0.5 text-xs">
                  ссылка отозвана
                </span>
              ) : null}
              {link.expired ? (
                <span className="rounded bg-border/70 px-1.5 py-0.5 text-xs">
                  ссылка истекла
                </span>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiTile
                label="Заходов"
                value={String(link.visits)}
                sub={withPlural(link.visitors, WORDS.person)}
                hint="Разные устройства или люди по одной ссылке"
              />
              <KpiTile label="Общее время в хабе" value={formatDuration(link.totalMs)} />
              <KpiTile
                label="Прочитано страниц"
                value={link.readDepth.of > 0 ? `${link.readDepth.read}/${link.readDepth.of}` : "—"}
                sub={depthPct != null ? `${depthPct}%` : "нет многостраничных PDF"}
              />
              <KpiTile
                label="Время на материалах"
                value={formatDuration(link.itemsTimeMs)}
                flag={link.timeGapFlag}
                hint={
                  link.timeGapFlag
                    ? "Заметно меньше общего времени в хабе — похоже на открытую фоновую вкладку, а не чтение"
                    : undefined
                }
              />
            </div>

            {/* Клики по кнопкам шапки — самые «горячие» сигналы: клиент
                не просто смотрел, а сделал шаг навстречу. Показываем, только
                если что-то из этого было. */}
            {link.demoClicks > 0 || link.contactClicks > 0 ? (
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {link.demoClicks > 0 ? (
                  <span className="text-ok">
                    Демо-кабинет открывали{" "}
                    {withPlural(link.demoClicks, WORDS.time)}
                  </span>
                ) : null}
                {link.contactClicks > 0 ? (
                  <span className="text-ok">
                    «Задать вопрос» нажимали{" "}
                    {withPlural(link.contactClicks, WORDS.time)}
                  </span>
                ) : null}
              </p>
            ) : null}

            {link.items.length === 0 ? (
              <p className="text-sm text-muted">
                Витрину открывали, но ни один материал не смотрели.
              </p>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className={cardClasses("card")}>
                    <p className="mb-3 font-mono text-[11px] tracking-wide text-muted uppercase">
                      Куда ушло время
                    </p>
                    <DonutChart
                      segments={timeSegments}
                      centerLabel={formatDuration(link.itemsTimeMs)}
                      centerSub={withPlural(materialsWithTime, WORDS.material)}
                    />
                  </div>

                  <div className={cardClasses("card")}>
                    <p className="mb-3 font-mono text-[11px] tracking-wide text-muted uppercase">
                      Глубина прочтения
                    </p>
                    {depthSeg ? (
                      <div className="flex flex-wrap items-center gap-5">
                        <DonutChart
                          segments={[depthSeg]}
                          total={link.readDepth.of}
                          centerLabel={depthPct != null ? `${depthPct}%` : "—"}
                          centerSub={`${link.readDepth.read} из ${link.readDepth.of} стр.`}
                          legend={false}
                        />
                        <ul className="grid gap-1.5 text-xs">
                          <li>
                            Переходы по ссылкам:{" "}
                            <span className="font-mono tabular-nums">{link.linkClicksTotal}</span>
                          </li>
                          <li>
                            Демо-кабинет:{" "}
                            <span className="font-mono tabular-nums">{link.demoClicks}</span>
                          </li>
                          <li>
                            «Задать вопрос»:{" "}
                            <span className="font-mono tabular-nums">{link.contactClicks}</span>
                          </li>
                        </ul>
                      </div>
                    ) : (
                      <p className="text-sm text-muted">Многостраничных PDF в этом хабе нет.</p>
                    )}
                    {link.singlePageOpened.length > 0 ? (
                      <p className="mt-3 text-xs text-muted">
                        Не в этом графике (1 стр., прочитаны полностью):{" "}
                        {link.singlePageOpened.join(", ")}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className={cardClasses("card")}>
                  <p className="mb-3 font-mono text-[11px] tracking-wide text-muted uppercase">
                    Рейтинг материалов по времени
                  </p>
                  <RankedBarChart items={link.items} />
                </div>

                <ul className="grid grid-cols-1 gap-2">
                  {link.items.map((item) => (
                    <li
                      key={item.assetId}
                      className={cardClasses("row")}
                    >
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="rounded bg-border/70 px-1.5 py-0.5 text-xs">
                          {KIND_LABELS[item.kind as AssetKind]}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {item.title}
                        </span>
                        {item.versionAt ? (
                          <span className="shrink-0 text-xs text-muted">
                            (версия от <LocalDateTime kind="shortDate" date={item.versionAt} />)
                          </span>
                        ) : null}
                        <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">
                          {/* Пульс идёт раз в 10 секунд, поэтому «0 сек» означает
                              не «данных нет», а «закрыли быстрее, чем через 10». */}
                          {item.totalMs === 0 && item.opens > 0
                            ? "меньше 10 сек"
                            : formatDuration(item.totalMs)}
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-muted">{itemMeta(item)}</p>

                      {item.kind === "PDF" && !item.isSinglePage && item.pageHeat.length > 0 ? (
                        <PageHeatmap pages={item.pageHeat} />
                      ) : null}
                      {item.kind === "VIDEO" && item.videoWatch ? (
                        <VideoWatchHeatmap watch={item.videoWatch} />
                      ) : null}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {/* Что отправили, но клиент не открыл — часто важнее того, что открыл. */}
            {(() => {
              const seen = new Set(link.items.map((i) => i.assetId));
              const missed = hub.items.filter((i) => !seen.has(i.assetId));
              if (missed.length === 0) return null;

              return (
                <p className="text-sm text-muted">
                  <span className="font-medium">Не открывали:</span>{" "}
                  {missed
                    .map((i) => i.titleOverride ?? i.asset.title)
                    .join(", ")}
                </p>
              );
            })()}

            <VisitTimeline visits={timeline} />
          </section>
        );
      })}

      {untouched.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold tracking-tight text-muted uppercase">
            Ссылку не открывали
          </h2>
          <ul className="grid grid-cols-1 gap-2">
            {untouched.map((link) => (
              <li
                key={link.linkId}
                className="rounded-lg border border-border px-3 py-2 text-sm"
              >
                {link.company ?? "Без названия"}
                {link.revoked ? (
                  <span className="ml-2 text-xs text-muted">отозвана</span>
                ) : null}
                {link.expired ? (
                  <span className="ml-2 text-xs text-muted">истекла</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
