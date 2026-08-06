import "server-only";

import { db } from "./db";
import type { StatsRange } from "./stats-range";

// Подсчёты для админской статистики. Держим отдельно от страниц: одни и те же
// цифры нужны и в сводке, и на карточке хаба, и в уведомлениях.
//
// Время везде складывается из HEARTBEAT: пульс уже несёт длительность и уже
// обрезан потолком при приёме. Складывать «открыл минус закрыл» нельзя —
// события закрытия может не быть вовсе.

export type HubStats = {
  hubId: string;
  visits: number;
  visitors: number;
  totalMs: number;
  lastSeenAt: Date | null;
};

/** Сводка по всем хабам организации — для списка и главной страницы статистики. */
export async function hubStats(organizationId: string): Promise<Map<string, HubStats>> {
  const hubs = await db.hub.findMany({
    where: { organizationId },
    select: { id: true },
  });
  const hubIds = hubs.map((h) => h.id);

  if (hubIds.length === 0) return new Map();

  const [visitRows, timeRows] = await Promise.all([
    db.visit.findMany({
      where: { shareLink: { hubId: { in: hubIds } } },
      select: { visitorId: true, lastSeenAt: true, shareLink: { select: { hubId: true } } },
    }),
    db.event.groupBy({
      by: ["hubId"],
      where: { hubId: { in: hubIds }, type: "HEARTBEAT" },
      _sum: { durationMs: true },
    }),
  ]);

  const timeByHub = new Map(timeRows.map((r) => [r.hubId, r._sum.durationMs ?? 0]));

  const result = new Map<string, HubStats>();
  for (const id of hubIds) {
    result.set(id, {
      hubId: id,
      visits: 0,
      visitors: 0,
      totalMs: timeByHub.get(id) ?? 0,
      lastSeenAt: null,
    });
  }

  // Уникальных посетителей считаем в памяти: их немного, а отдельный запрос
  // с DISTINCT по связи вышел бы заметно мутнее.
  const visitorsByHub = new Map<string, Set<string>>();

  for (const v of visitRows) {
    const hubId = v.shareLink.hubId;
    const stat = result.get(hubId);
    if (!stat) continue;

    stat.visits += 1;
    if (!stat.lastSeenAt || v.lastSeenAt > stat.lastSeenAt) {
      stat.lastSeenAt = v.lastSeenAt;
    }

    let set = visitorsByHub.get(hubId);
    if (!set) visitorsByHub.set(hubId, (set = new Set()));
    set.add(v.visitorId);
  }

  for (const [hubId, set] of visitorsByHub) {
    result.get(hubId)!.visitors = set.size;
  }

  return result;
}

export type LinkStats = {
  linkId: string;
  company: string | null;
  token: string;
  revoked: boolean;
  expired: boolean;
  visits: number;
  visitors: number;
  totalMs: number;
  /** Сколько раз открывали демо-кабинет и жали «Задать вопрос» — по всей ссылке. */
  demoClicks: number;
  contactClicks: number;
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
  items: ItemStats[];
};

export type ItemStats = {
  assetId: string;
  title: string;
  kind: string;
  pageCount: number | null;
  opens: number;
  totalMs: number;
  downloads: number;
  /** Только у ссылок: сколько раз ушли на внешний сайт. */
  linkClicks: number;
  /** Докуда долистали в PDF. */
  maxPage: number | null;
  /** Страницы, где задержались дольше всего. */
  topPages: { page: number; ms: number }[];
};

/**
 * Полный разбор по одному хабу: каждая выданная ссылка и что по ней смотрели.
 *
 * `range` сужает окно: событие и визит считаются, только если попали в него.
 * Без диапазона — весь период, как было раньше. Ссылка, у которой в узком
 * окне не набралось визитов, честно уходит в «не открывали» — это карточка
 * именно за выбранный период, а не за всё время.
 */
export async function hubDetail(
  hubId: string,
  range: StatsRange = null,
): Promise<LinkStats[]> {
  const eventWhere = range ? { occurredAt: { gte: range.from, lte: range.to } } : {};
  const visitWhere = range ? { startedAt: { gte: range.from, lte: range.to } } : {};

  const links = await db.shareLink.findMany({
    where: { hubId },
    include: {
      visits: {
        where: visitWhere,
        select: { visitorId: true, startedAt: true, lastSeenAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();

  return Promise.all(
    links.map(async (link) => {
      const [
        timeRow,
        opens,
        downloads,
        pageRows,
        linkClicks,
        pageTime,
        demoClicks,
        contactClicks,
      ] = await Promise.all([
        db.event.aggregate({
          where: { shareLinkId: link.id, type: "HEARTBEAT", ...eventWhere },
          _sum: { durationMs: true },
        }),
        db.event.groupBy({
          by: ["assetId"],
          where: {
            shareLinkId: link.id,
            type: "ITEM_OPEN",
            assetId: { not: null },
            ...eventWhere,
          },
          _count: { _all: true },
        }),
        db.event.groupBy({
          by: ["assetId"],
          where: {
            shareLinkId: link.id,
            type: "DOWNLOAD",
            assetId: { not: null },
            ...eventWhere,
          },
          _count: { _all: true },
        }),
        db.event.groupBy({
          by: ["assetId"],
          where: {
            shareLinkId: link.id,
            type: "PAGE_VIEW",
            assetId: { not: null },
            ...eventWhere,
          },
          _max: { pageNumber: true },
        }),
        // Переходы на внешние сайты. Для ссылок это главное событие: дальше
        // клиент уходит на чужую страницу, и время там мы уже не считаем.
        db.event.groupBy({
          by: ["assetId"],
          where: {
            shareLinkId: link.id,
            type: "LINK_CLICK",
            assetId: { not: null },
            ...eventWhere,
          },
          _count: { _all: true },
        }),
        db.event.groupBy({
          by: ["assetId", "pageNumber"],
          where: {
            shareLinkId: link.id,
            type: "HEARTBEAT",
            assetId: { not: null },
            pageNumber: { not: null },
            ...eventWhere,
          },
          _sum: { durationMs: true },
        }),
        // Клики по кнопкам шапки — события уровня хаба, без материала.
        db.event.count({
          where: { shareLinkId: link.id, type: "DEMO_CLICK", ...eventWhere },
        }),
        db.event.count({
          where: { shareLinkId: link.id, type: "CONTACT_CLICK", ...eventWhere },
        }),
      ]);

      // Время по материалам — отдельным запросом, он же даёт список
      // затронутых материалов.
      const itemTime = await db.event.groupBy({
        by: ["assetId"],
        where: {
          shareLinkId: link.id,
          type: "HEARTBEAT",
          assetId: { not: null },
          ...eventWhere,
        },
        _sum: { durationMs: true },
      });

      const touched = new Set<string>([
        ...itemTime.map((r) => r.assetId!),
        ...opens.map((r) => r.assetId!),
        ...downloads.map((r) => r.assetId!),
        ...linkClicks.map((r) => r.assetId!),
      ]);

      const assets =
        touched.size > 0
          ? await db.asset.findMany({ where: { id: { in: [...touched] } } })
          : [];

      const openCount = new Map(opens.map((r) => [r.assetId!, r._count._all]));
      const dlCount = new Map(downloads.map((r) => [r.assetId!, r._count._all]));
      const clickCount = new Map(
        linkClicks.map((r) => [r.assetId!, r._count._all]),
      );
      const msByAsset = new Map(itemTime.map((r) => [r.assetId!, r._sum.durationMs ?? 0]));
      const maxPageByAsset = new Map(pageRows.map((r) => [r.assetId!, r._max.pageNumber]));

      const items: ItemStats[] = assets
        .map((asset) => ({
          assetId: asset.id,
          title: asset.title,
          kind: asset.kind,
          pageCount: asset.pageCount,
          opens: openCount.get(asset.id) ?? 0,
          totalMs: msByAsset.get(asset.id) ?? 0,
          downloads: dlCount.get(asset.id) ?? 0,
          linkClicks: clickCount.get(asset.id) ?? 0,
          maxPage: maxPageByAsset.get(asset.id) ?? null,
          topPages: pageTime
            .filter((r) => r.assetId === asset.id)
            .map((r) => ({ page: r.pageNumber!, ms: r._sum.durationMs ?? 0 }))
            .sort((a, b) => b.ms - a.ms)
            .slice(0, 5),
        }))
        .sort((a, b) => b.totalMs - a.totalMs);

      const starts = link.visits.map((v) => v.startedAt.getTime());
      const ends = link.visits.map((v) => v.lastSeenAt.getTime());

      return {
        linkId: link.id,
        company: link.recipientCompany,
        token: link.token,
        revoked: link.revokedAt !== null,
        expired: link.expiresAt !== null && link.expiresAt < now,
        visits: link.visits.length,
        visitors: new Set(link.visits.map((v) => v.visitorId)).size,
        totalMs: timeRow._sum.durationMs ?? 0,
        demoClicks,
        contactClicks,
        firstSeenAt: starts.length ? new Date(Math.min(...starts)) : null,
        lastSeenAt: ends.length ? new Date(Math.max(...ends)) : null,
        items,
      };
    }),
  );
}

/** «2 мин 30 сек», «45 сек», «1 ч 5 мин». */
export function formatDuration(ms: number): string {
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec} сек`;

  const min = Math.floor(sec / 60);
  if (min < 60) {
    const rest = sec % 60;
    return rest > 0 ? `${min} мин ${rest} сек` : `${min} мин`;
  }

  const hours = Math.floor(min / 60);
  const restMin = min % 60;
  return restMin > 0 ? `${hours} ч ${restMin} мин` : `${hours} ч`;
}

/** «только что», «12 минут назад», «вчера», «3 июля». */
export function formatWhen(date: Date | null): string {
  if (!date) return "—";

  const diffMs = Date.now() - date.getTime();
  const min = Math.round(diffMs / 60_000);

  if (min < 1) return "только что";
  if (min < 60) return `${min} мин назад`;

  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours} ч назад`;

  const days = Math.round(hours / 24);
  if (days === 1) return "вчера";
  if (days < 7) return `${days} дн. назад`;

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
  }).format(date);
}
