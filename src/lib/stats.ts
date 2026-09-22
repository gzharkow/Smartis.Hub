import "server-only";

import { db } from "./db";
import type { StatsRange } from "./stats-range";
import { formatDuration } from "./format-datetime";

// Подсчёты для админской статистики. Держим отдельно от страниц: одни и те же
// цифры нужны и в сводке, и на карточке хаба, и в уведомлениях.
//
// Время везде складывается из HEARTBEAT: пульс уже несёт длительность и уже
// обрезан потолком при приёме. Складывать «открыл минус закрыл» нельзя —
// события закрытия может не быть вовсе.

/** С какой давности захода пилюля «активный интерес» ещё горит. */
const HOT_DAYS = 7;
/** С какой давности захода пилюля переключается на «остыл». Между HOT_DAYS
 * и этим порогом — нейтрально, пилюля не показывается, только дата. */
const COLD_DAYS = 30;
/** Если время на материалах меньше этой доли общего времени в хабе —
 * подозрительно (открытая фоновая вкладка, а не чтение), подсвечиваем плитку. */
const TIME_GAP_RATIO = 0.5;

const DAY_MS = 24 * 60 * 60 * 1000;

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

export type MaterialEventStat = {
  opens: number;
  totalMs: number;
  downloads: number;
  /** Докуда долистали в PDF — суммарно по всем хабам сразу. */
  maxPage: number | null;
  /** Полная тепловая карта страниц — как в hubDetail, но по всем хабам сразу. */
  pageHeat: PageHeat[];
  /** Воронка глубины просмотра видео — как в hubDetail, но по всем хабам сразу. */
  videoWatch: VideoWatchStat | null;
};

/**
 * Открытия/время/скачивания (и, для многостраничных PDF, тепловая карта
 * страниц) по материалам — для «Общей статистики» (агрегат по многим
 * хабам сразу, в отличие от hubDetail — та же идея, но там разбивка идёт
 * по ссылкам ОДНОГО хаба). Один groupBy на opens/totalMs/downloads: здесь,
 * в отличие от hubDetail, естественного деления по ссылкам нет, а нужны
 * сразу все поля.
 */
export async function materialEventStats(
  hubIds: string[],
  assets: { id: string; kind: string; pageCount: number | null; durationSec: number | null }[],
  range: StatsRange = null,
): Promise<Map<string, MaterialEventStat>> {
  const assetIds = assets.map((a) => a.id);
  const result = new Map<string, MaterialEventStat>(
    assetIds.map((id) => [
      id,
      { opens: 0, totalMs: 0, downloads: 0, maxPage: null, pageHeat: [], videoWatch: null },
    ]),
  );
  if (hubIds.length === 0 || assetIds.length === 0) return result;

  const eventWhere = range ? { occurredAt: { gte: range.from, lte: range.to } } : {};
  const scopeWhere = { hubId: { in: hubIds }, assetId: { in: assetIds }, ...eventWhere };

  const [rows, pageRows, pageTime, videoRows] = await Promise.all([
    db.event.groupBy({
      by: ["assetId", "type"],
      where: { ...scopeWhere, type: { in: ["HEARTBEAT", "ITEM_OPEN", "DOWNLOAD"] } },
      _sum: { durationMs: true },
      _count: { _all: true },
    }),
    db.event.groupBy({
      by: ["assetId"],
      where: { ...scopeWhere, type: "PAGE_VIEW" },
      _max: { pageNumber: true },
    }),
    db.event.groupBy({
      by: ["assetId", "pageNumber"],
      where: { ...scopeWhere, type: "HEARTBEAT", pageNumber: { not: null } },
      _sum: { durationMs: true },
    }),
    db.event.groupBy({
      by: ["assetId", "visitId"],
      where: { ...scopeWhere, type: "VIDEO_PROGRESS" },
      _max: { positionSec: true },
    }),
  ]);

  for (const row of rows) {
    const stat = result.get(row.assetId as string);
    if (!stat) continue;
    if (row.type === "HEARTBEAT") stat.totalMs += row._sum.durationMs ?? 0;
    else if (row.type === "ITEM_OPEN") stat.opens += row._count._all;
    else if (row.type === "DOWNLOAD") stat.downloads += row._count._all;
  }

  for (const row of pageRows) {
    const stat = result.get(row.assetId as string);
    if (stat) stat.maxPage = row._max.pageNumber;
  }

  const pageTimeByAsset = new Map<string, Map<number, number>>();
  for (const row of pageTime) {
    const assetId = row.assetId as string;
    let map = pageTimeByAsset.get(assetId);
    if (!map) pageTimeByAsset.set(assetId, (map = new Map()));
    map.set(row.pageNumber as number, row._sum.durationMs ?? 0);
  }

  const pageCountById = new Map(assets.map((a) => [a.id, a.pageCount]));
  for (const [assetId, stat] of result) {
    stat.pageHeat = buildPageHeat(
      pageCountById.get(assetId) ?? null,
      pageTimeByAsset.get(assetId) ?? new Map(),
    );
  }

  const videoPosByAsset = new Map<string, Map<string, number>>();
  for (const row of videoRows) {
    const assetId = row.assetId as string;
    let map = videoPosByAsset.get(assetId);
    if (!map) videoPosByAsset.set(assetId, (map = new Map()));
    map.set(row.visitId, row._max.positionSec ?? 0);
  }

  const assetById = new Map(assets.map((a) => [a.id, a]));
  for (const [assetId, stat] of result) {
    const asset = assetById.get(assetId);
    if (asset?.kind !== "VIDEO") continue;
    stat.videoWatch = buildVideoWatch(asset.durationSec, videoPosByAsset.get(assetId) ?? new Map());
  }

  return result;
}

/** Час пик на тепловой карте страниц: 0 — не открывали (серый), 1–4 — тёплая
 * шкала от бледного до тёмно-красного, пропорционально самой залипчивой
 * странице документа. */
export type PageHeat = { page: number; ms: number; level: 0 | 1 | 2 | 3 | 4 };

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
  /** Страницы, где задержались дольше всего (топ-5, для легенды/подписи). */
  topPages: { page: number; ms: number }[];
  /** Полная тепловая карта страниц — по одной ячейке на каждую страницу
   * документа. Пусто для не-PDF. */
  pageHeat: PageHeat[];
  /** Воронка глубины просмотра видео — 25/50/75/100%. null для не-видео
   * или пока не известна длительность ролика (Asset.durationSec). */
  videoWatch: VideoWatchStat | null;
  /** Однострочный документ всегда даёт 100% дочитывания — это не заслуга,
   * а свойство длины. Помечаем отдельно и не мешаем с остальными в сортировке
   * по глубине. */
  isSinglePage: boolean;
  /** Заполнено, если строка — результат схлопывания нескольких версий одного
   * расчёта КП (общий quoteId) — дата создания самой свежей версии. Строку
   * «версия от 12 августа» собирает сам компонент (см. LocalDateTime) —
   * не здесь: это часовой пояс устройства зрителя, не сервера. */
  versionAt: Date | null;
};

export type TimelineChip = {
  type: string;
  label: string;
  at: Date;
};

export type VisitTimelineEntry = {
  visitId: string;
  /** Порядковый номер человека по этой ссылке (1-й, 2-й...), не захода —
   * один человек может заходить несколько раз. */
  personOrdinal: number;
  startedAt: Date;
  lastSeenAt: Date;
  chips: TimelineChip[];
};

export type LinkStats = {
  linkId: string;
  company: string | null;
  token: string;
  revoked: boolean;
  expired: boolean;
  visits: number;
  visitors: number;
  totalMs: number;
  /** Сумма времени по материалам — сравнивается с totalMs, чтобы поймать
   * разрыв «общее время в хабе» vs «время на материалах». */
  itemsTimeMs: number;
  /** Сумма переходов по внешним ссылкам среди всех материалов — сигнал
   * действия рядом с кольцом «глубина прочтения». */
  linkClicksTotal: number;
  /** «Заходил недавно» / «давно не заходил» — по давности lastSeenAt. */
  statusTag: "hot" | "cold" | null;
  /** itemsTimeMs заметно меньше totalMs — похоже на фоновую вкладку. */
  timeGapFlag: boolean;
  /** Сколько раз открывали демо-кабинет и жали «Задать вопрос» — по всей ссылке. */
  demoClicks: number;
  contactClicks: number;
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
  items: ItemStats[];
  /** Агрегированная глубина чтения по всем многостраничным PDF сразу —
   * однострочные документы в сумму не входят (см. ItemStats.isSinglePage). */
  readDepth: { read: number; of: number; pct: number | null };
  /** Названия однострочных документов, которые открывали — отдельная сноска,
   * а не часть графика глубины. */
  singlePageOpened: string[];
};

type RawTimelineEvent = {
  type: string;
  occurredAt: Date;
  assetId: string | null;
  pageNumber: number | null;
  durationMs: number | null;
};

const TIMELINE_EVENT_TYPES = [
  "HUB_VIEW",
  "ITEM_OPEN",
  "LINK_CLICK",
  "DEMO_CLICK",
  "CONTACT_CLICK",
  "DOWNLOAD",
  "HEARTBEAT",
  "PAGE_VIEW",
] as const;

const NOTABLE_TIMELINE_TYPES = new Set([
  "HUB_VIEW",
  "ITEM_OPEN",
  "LINK_CLICK",
  "DEMO_CLICK",
  "CONTACT_CLICK",
  "DOWNLOAD",
]);

/** Уровень тепла страницы: 0, если её не открывали, иначе 1–4 пропорционально
 * самой залипчивой странице документа (не квантили — важен именно пик). */
function heatLevel(ms: number, maxMs: number): 0 | 1 | 2 | 3 | 4 {
  if (ms <= 0 || maxMs <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((ms / maxMs) * 4))) as 1 | 2 | 3 | 4;
}

export function buildPageHeat(pageCount: number | null, msByPage: Map<number, number>): PageHeat[] {
  if (!pageCount || pageCount < 1) return [];
  const maxMs = Math.max(0, ...msByPage.values());
  const pages: PageHeat[] = [];
  for (let page = 1; page <= pageCount; page += 1) {
    const ms = msByPage.get(page) ?? 0;
    pages.push({ page, ms, level: heatLevel(ms, maxMs) });
  }
  return pages;
}

/** Одна веха воронки просмотра видео: сколько сеансов из всех досмотрело
 * хотя бы до этой доли ролика. */
export type WatchMilestone = { pct: 25 | 50 | 75 | 100; reached: number; level: 0 | 1 | 2 | 3 | 4 };
export type VideoWatchStat = { sessions: number; milestones: WatchMilestone[] };

const WATCH_MILESTONE_PCTS = [25, 50, 75, 100] as const;

/**
 * Воронка глубины просмотра видео — аналог buildPageHeat, но для видео нет
 * «страниц», только непрерывная позиция, поэтому берём фиксированные вехи
 * 25/50/75/100%. `level` — доля сеансов, дошедших до вехи, не относительно
 * самой популярной вехи (та всегда ≥ остальных — шкала «сама на себя»
 * ничего не показала бы).
 */
export function buildVideoWatch(
  durationSec: number | null,
  maxPosByVisit: Map<string, number>,
): VideoWatchStat | null {
  if (!durationSec || durationSec <= 0) return null;

  const positions = [...maxPosByVisit.values()];
  const sessions = positions.length;

  const milestones = WATCH_MILESTONE_PCTS.map((pct) => {
    const reached = positions.filter((sec) => sec / durationSec >= pct / 100).length;
    const level: WatchMilestone["level"] =
      sessions === 0 || reached === 0 ? 0 : (Math.max(1, Math.ceil((reached / sessions) * 4)) as 1 | 2 | 3 | 4);
    return { pct, reached, level };
  });

  return { sessions, milestones };
}

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
    // Ссылки без трекинга («Для АМО») сюда не попадают — у них и так
    // никогда не будет ни визитов, ни событий, а «0 заходов» на ссылке,
    // которую активно используют в CRM, выглядело бы как «клиент не открыл».
    where: { hubId, trackingEnabled: true },
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
        videoRows,
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
        db.event.groupBy({
          by: ["assetId", "visitId"],
          where: {
            shareLinkId: link.id,
            type: "VIDEO_PROGRESS",
            assetId: { not: null },
            ...eventWhere,
          },
          _max: { positionSec: true },
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

      // Каждой странице каждого материала — своя карта время-по-странице,
      // нужна и для topPages (было), и для полной тепловой карты (новое).
      const pageTimeByAsset = new Map<string, Map<number, number>>();
      for (const row of pageTime) {
        const assetId = row.assetId!;
        let map = pageTimeByAsset.get(assetId);
        if (!map) pageTimeByAsset.set(assetId, (map = new Map()));
        map.set(row.pageNumber!, row._sum.durationMs ?? 0);
      }

      // Та же идея для видео: карта макс-позиции по каждому визиту —
      // основа воронки 25/50/75/100% (buildVideoWatch).
      const videoPosByAsset = new Map<string, Map<string, number>>();
      for (const row of videoRows) {
        const assetId = row.assetId!;
        let map = videoPosByAsset.get(assetId);
        if (!map) videoPosByAsset.set(assetId, (map = new Map()));
        map.set(row.visitId, row._max.positionSec ?? 0);
      }

      // Черновые карточки материалов — по одной на каждый Asset, ещё без
      // схлопывания версий КП. quoteId/createdAt нужны только для
      // следующего шага и не попадают в финальный ItemStats.
      type Draft = ItemStats & { quoteId: string | null; createdAt: Date };

      const drafts: Draft[] = assets.map((asset) => {
        const msByPage = pageTimeByAsset.get(asset.id) ?? new Map();
        const topPages = [...msByPage.entries()]
          .map(([page, ms]) => ({ page, ms }))
          .sort((a, b) => b.ms - a.ms)
          .slice(0, 5);

        return {
          assetId: asset.id,
          title: asset.title,
          kind: asset.kind,
          pageCount: asset.pageCount,
          opens: openCount.get(asset.id) ?? 0,
          totalMs: msByAsset.get(asset.id) ?? 0,
          downloads: dlCount.get(asset.id) ?? 0,
          linkClicks: clickCount.get(asset.id) ?? 0,
          maxPage: maxPageByAsset.get(asset.id) ?? null,
          topPages,
          pageHeat: buildPageHeat(asset.pageCount, msByPage),
          videoWatch:
            asset.kind === "VIDEO"
              ? buildVideoWatch(asset.durationSec, videoPosByAsset.get(asset.id) ?? new Map())
              : null,
          isSinglePage: asset.pageCount === 1,
          versionAt: null,
          quoteId: asset.quoteId,
          createdAt: asset.createdAt,
        };
      });

      // Схлопываем версии одного и того же расчёта КП: несколько Asset с
      // одинаковым непустым quoteId — это переснятые версии одного
      // документа, а не разные материалы (см. addQuotePdfToHub — каждая
      // генерация создаёт новый Asset). Суммируем метрики, тепловую карту
      // берём объединённую по номерам страниц, подписываем версией по
      // самой свежей из группы.
      const byQuote = new Map<string, Draft[]>();
      const standalone: Draft[] = [];
      for (const d of drafts) {
        if (!d.quoteId) {
          standalone.push(d);
          continue;
        }
        let group = byQuote.get(d.quoteId);
        if (!group) byQuote.set(d.quoteId, (group = []));
        group.push(d);
      }

      const merged: ItemStats[] = [...standalone];
      for (const group of byQuote.values()) {
        if (group.length === 1) {
          merged.push(group[0]);
          continue;
        }

        const newest = group.reduce((a, b) => (b.createdAt > a.createdAt ? b : a));
        const pageCount = Math.max(...group.map((g) => g.pageCount ?? 0)) || null;
        const msByPage = new Map<number, number>();
        for (const g of group) {
          for (const p of g.pageHeat) {
            msByPage.set(p.page, (msByPage.get(p.page) ?? 0) + p.ms);
          }
        }

        merged.push({
          assetId: newest.assetId,
          title: newest.title,
          kind: newest.kind,
          pageCount,
          opens: group.reduce((s, g) => s + g.opens, 0),
          totalMs: group.reduce((s, g) => s + g.totalMs, 0),
          downloads: group.reduce((s, g) => s + g.downloads, 0),
          linkClicks: group.reduce((s, g) => s + g.linkClicks, 0),
          maxPage: Math.max(0, ...group.map((g) => g.maxPage ?? 0)) || null,
          topPages: [...msByPage.entries()]
            .map(([page, ms]) => ({ page, ms }))
            .sort((a, b) => b.ms - a.ms)
            .slice(0, 5),
          pageHeat: buildPageHeat(pageCount, msByPage),
          // Расчёты КП (единственный случай схлопывания версий) — всегда
          // PDF, у видео quoteId не бывает вовсе.
          videoWatch: null,
          isSinglePage: pageCount === 1,
          versionAt: newest.createdAt,
        });
      }

      const items = merged.sort((a, b) => b.totalMs - a.totalMs);

      const itemsTimeMs = items.reduce((s, i) => s + i.totalMs, 0);
      const linkClicksTotal = items.reduce((s, i) => s + i.linkClicks, 0);
      const totalMs = timeRow._sum.durationMs ?? 0;

      const depthItems = items.filter(
        (i) => i.kind === "PDF" && i.pageCount && i.pageCount > 1,
      );
      const readDepth = {
        read: depthItems.reduce((s, i) => s + Math.min(i.maxPage ?? 0, i.pageCount ?? 0), 0),
        of: depthItems.reduce((s, i) => s + (i.pageCount ?? 0), 0),
        pct: null as number | null,
      };
      readDepth.pct = readDepth.of > 0 ? readDepth.read / readDepth.of : null;

      const singlePageOpened = items
        .filter((i) => i.isSinglePage && i.opens > 0)
        .map((i) => i.title);

      const starts = link.visits.map((v) => v.startedAt.getTime());
      const ends = link.visits.map((v) => v.lastSeenAt.getTime());
      const lastSeenAt = ends.length ? new Date(Math.max(...ends)) : null;

      const daysSinceSeen = lastSeenAt ? (now.getTime() - lastSeenAt.getTime()) / DAY_MS : null;
      const statusTag: LinkStats["statusTag"] =
        daysSinceSeen === null
          ? null
          : daysSinceSeen <= HOT_DAYS
            ? "hot"
            : daysSinceSeen >= COLD_DAYS
              ? "cold"
              : null;

      return {
        linkId: link.id,
        company: link.recipientCompany,
        token: link.token,
        revoked: link.revokedAt !== null,
        expired: link.expiresAt !== null && link.expiresAt < now,
        visits: link.visits.length,
        visitors: new Set(link.visits.map((v) => v.visitorId)).size,
        totalMs,
        itemsTimeMs,
        linkClicksTotal,
        statusTag,
        timeGapFlag: totalMs > 0 && itemsTimeMs < totalMs * TIME_GAP_RATIO,
        demoClicks,
        contactClicks,
        firstSeenAt: starts.length ? new Date(Math.min(...starts)) : null,
        lastSeenAt,
        items,
        readDepth,
        singlePageOpened,
      };
    }),
  );
}

export type DonutSegment = {
  label: string;
  value: number;
  valueLabel: string;
  colorClass: string;
};

/** Тёплая шкала по рангу (самый долгий материал — самый тёмный), см.
 * globals.css. Цикличная: пятый+ сегмент схлопывается в «Прочее» раньше,
 * чем закончатся оттенки. */
const HEAT_RAMP = ["text-heat-4", "text-heat-3", "text-heat-2", "text-heat-1"];

/**
 * Сегменты для кольца «Куда ушло время»: материал на сегмент, отсортированы
 * по убыванию времени, максимум `max` именованных штук (остальное —
 * в «Прочее»). Цвет — по рангу на тёплой шкале, кроме материалов-ссылок:
 * время на них не «чтение», а «навигация» — холодный акцент вместо тёплого,
 * это и есть то самое «цвет несёт смысл» из ТЗ.
 *
 * Тип параметра — только то, что реально используется (не полный
 * ItemStats): так функция годится и для агрегата «Общей статистики».
 */
export function timeDonutSegments(
  items: { title: string; totalMs: number; kind: string }[],
  max = 5,
): DonutSegment[] {
  const withTime = items.filter((i) => i.totalMs > 0).sort((a, b) => b.totalMs - a.totalMs);
  const headCount = withTime.length <= max ? withTime.length : max - 1;
  const head = withTime.slice(0, headCount);
  const rest = withTime.slice(headCount);

  const segments: DonutSegment[] = head.map((item, rank) => ({
    label: item.title,
    value: item.totalMs,
    valueLabel: formatDuration(item.totalMs),
    colorClass: item.kind === "LINK" ? "text-stat-cool" : HEAT_RAMP[rank % HEAT_RAMP.length],
  }));

  if (rest.length > 0) {
    const restMs = rest.reduce((s, i) => s + i.totalMs, 0);
    segments.push({
      label: "Прочее",
      value: restMs,
      valueLabel: formatDuration(restMs),
      colorClass: "text-muted",
    });
  }

  return segments;
}

/** Сегмент кольца «Глубина прочтения» — сам процент прочитанного (остаток
 * круга — неявно `--heat-0`, рисуется компонентом сам по общему `total`). */
export function readDepthSegment(readDepth: LinkStats["readDepth"]): DonutSegment | null {
  if (readDepth.of <= 0) return null;
  return {
    label: "Прочитано",
    value: readDepth.read,
    valueLabel: `${readDepth.read} из ${readDepth.of} стр.`,
    colorClass: "text-brand",
  };
}

/**
 * Хронология заходов по одной ссылке: по визиту — когда, какой по счёту
 * человек, сколько длился, и чипсы событий по порядку (открыл хаб → открыл
 * материал N сек до стр. M → перешёл по ссылке → нажал «Задать вопрос»).
 *
 * Время и глубину для чипа «открыл материал» считаем по HEARTBEAT/PAGE_VIEW
 * того же assetId, попавшим в окно между этим открытием и следующим
 * заметным событием по ДРУГОМУ материалу (или концом визита).
 */
export async function visitTimeline(
  linkId: string,
  range: StatsRange = null,
): Promise<VisitTimelineEntry[]> {
  const visitWhere = range ? { startedAt: { gte: range.from, lte: range.to } } : {};
  const eventWhere = range ? { occurredAt: { gte: range.from, lte: range.to } } : {};

  const visits = await db.visit.findMany({
    where: { shareLinkId: linkId, ...visitWhere },
    orderBy: { startedAt: "asc" },
    select: { id: true, visitorId: true, startedAt: true, lastSeenAt: true },
  });

  if (visits.length === 0) return [];

  const personOrdinal = new Map<string, number>();
  for (const v of visits) {
    if (!personOrdinal.has(v.visitorId)) personOrdinal.set(v.visitorId, personOrdinal.size + 1);
  }

  const events = await db.event.findMany({
    where: {
      visitId: { in: visits.map((v) => v.id) },
      type: { in: [...TIMELINE_EVENT_TYPES] },
      ...eventWhere,
    },
    orderBy: { occurredAt: "asc" },
    select: {
      visitId: true,
      type: true,
      occurredAt: true,
      assetId: true,
      pageNumber: true,
      durationMs: true,
    },
  });

  const eventsByVisit = new Map<string, RawTimelineEvent[]>();
  for (const e of events) {
    let list = eventsByVisit.get(e.visitId);
    if (!list) eventsByVisit.set(e.visitId, (list = []));
    list.push(e);
  }

  const touchedAssetIds = new Set(
    events.filter((e) => e.assetId).map((e) => e.assetId as string),
  );
  const assets =
    touchedAssetIds.size > 0
      ? await db.asset.findMany({
          where: { id: { in: [...touchedAssetIds] } },
          select: { id: true, title: true },
        })
      : [];
  const titleByAsset = new Map(assets.map((a) => [a.id, a.title]));

  return visits.map((v) => {
    const all = eventsByVisit.get(v.id) ?? [];
    const notable = all.filter((e) => NOTABLE_TIMELINE_TYPES.has(e.type));

    const chips: TimelineChip[] = notable.map((e, idx) => {
      const title = e.assetId ? (titleByAsset.get(e.assetId) ?? "материал") : null;

      if (e.type === "ITEM_OPEN" && e.assetId) {
        // Окно этого «сеанса» материала — до следующего заметного события
        // по ДРУГОМУ материалу (или конца визита).
        const next = notable
          .slice(idx + 1)
          .find((n) => n.type === "ITEM_OPEN" && n.assetId !== e.assetId);
        const windowEnd = next ? next.occurredAt : v.lastSeenAt;

        let ms = 0;
        let maxPage: number | null = null;
        for (const raw of all) {
          if (raw.assetId !== e.assetId) continue;
          if (raw.occurredAt < e.occurredAt || raw.occurredAt > windowEnd) continue;
          if (raw.type === "HEARTBEAT") {
            ms += raw.durationMs ?? 0;
            if (raw.pageNumber) maxPage = Math.max(maxPage ?? 0, raw.pageNumber);
          } else if (raw.type === "PAGE_VIEW" && raw.pageNumber) {
            maxPage = Math.max(maxPage ?? 0, raw.pageNumber);
          }
        }

        const detail =
          ms > 0 && maxPage
            ? ` — ${Math.round(ms / 1000)} сек, до стр. ${maxPage}`
            : ms > 0
              ? ` — ${Math.round(ms / 1000)} сек`
              : "";

        return { type: e.type, label: `Открыл «${title}»${detail}`, at: e.occurredAt };
      }

      switch (e.type) {
        case "HUB_VIEW":
          return { type: e.type, label: "Открыл хаб", at: e.occurredAt };
        case "LINK_CLICK":
          return { type: e.type, label: `Перешёл по ссылке «${title}»`, at: e.occurredAt };
        case "DEMO_CLICK":
          return { type: e.type, label: "Открыл демо-кабинет", at: e.occurredAt };
        case "CONTACT_CLICK":
          return { type: e.type, label: "Нажал «Задать вопрос»", at: e.occurredAt };
        case "DOWNLOAD":
          return { type: e.type, label: `Скачал «${title}»`, at: e.occurredAt };
        default:
          return { type: e.type, label: title ?? e.type, at: e.occurredAt };
      }
    });

    return {
      visitId: v.id,
      personOrdinal: personOrdinal.get(v.visitorId)!,
      startedAt: v.startedAt,
      lastSeenAt: v.lastSeenAt,
      chips,
    };
  });
}

// Форматирование дат/времени для экрана переехало в format-datetime.ts —
// оно там БЕЗ "server-only", чтобы клиентские компоненты могли его звать
// напрямую (этот файл ходит в Prisma, ему server-only необходим целиком).
// Реэкспорт — чтобы существующие `import {...} from "@/lib/stats"` в
// Server Component'ах не трогать: им барьер не мешает.
export {
  formatDuration,
  formatWhen,
  formatShortDate,
  formatVisitWhen,
  formatEventTime,
} from "./format-datetime";
