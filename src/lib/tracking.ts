import "server-only";

import { createHash } from "node:crypto";
import { db } from "./db";
import { MAX_EVENT_DURATION_MS, type TrackEvent } from "./tracking-shared";

/**
 * Сколько тишины считаем концом визита. Вернулся через час — это новый заход,
 * а не продолжение старого. Тридцать минут — общепринятая граница в веб-аналитике.
 */
const SESSION_GAP_MS = 30 * 60 * 1000;

/**
 * IP — персональные данные, и хранить его нам незачем: единственное, ради чего
 * он нужен, — грубо отличать посетителей, у которых нет куки. Для этого хватает
 * отпечатка. Соль из AUTH_SECRET не даёт подобрать исходный адрес перебором:
 * без неё все 4 миллиарда IPv4 хэшируются за минуты.
 */
export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return createHash("sha256")
    .update(`${process.env.AUTH_SECRET}:${ip}`)
    .digest("hex")
    .slice(0, 32);
}

/** Достаёт адрес клиента из заголовков обратного прокси. */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip");
}

async function currentVisit(params: {
  shareLinkId: string;
  visitorId: string;
  ipHash: string | null;
  userAgent: string | null;
  referrer: string | null;
}) {
  const recent = await db.visit.findFirst({
    where: {
      shareLinkId: params.shareLinkId,
      visitorId: params.visitorId,
      lastSeenAt: { gte: new Date(Date.now() - SESSION_GAP_MS) },
    },
    orderBy: { lastSeenAt: "desc" },
  });

  if (recent) {
    await db.visit.update({
      where: { id: recent.id },
      data: { lastSeenAt: new Date() },
    });
    return recent;
  }

  return db.visit.create({
    data: {
      shareLinkId: params.shareLinkId,
      visitorId: params.visitorId,
      ipHash: params.ipHash,
      userAgent: params.userAgent,
      referrer: params.referrer,
    },
  });
}

export async function ingestEvents(params: {
  shareLinkId: string;
  hubId: string;
  visitorId: string;
  events: TrackEvent[];
  /** id -> assetId. Материалы, которых в хабе нет, отбрасываем. */
  itemToAsset: Map<string, string>;
  ipHash: string | null;
  userAgent: string | null;
  referrer: string | null;
}): Promise<number> {
  const visit = await currentVisit(params);

  const now = Date.now();

  const rows = params.events
    .filter((e) => {
      // Без материала осмысленны события уровня хаба: открытие витрины, пульс
      // на ней самой (листают список, ничего не открыв), и клики по кнопкам
      // шапки — «Демо-кабинет» и «Задать вопрос».
      if (!e.itemId) {
        return (
          e.type === "HUB_VIEW" ||
          e.type === "HEARTBEAT" ||
          e.type === "DEMO_CLICK" ||
          e.type === "CONTACT_CLICK"
        );
      }
      // Браузеру не верим: событие про материал, которого в хабе нет, — либо
      // ошибка, либо подделка запроса. И то и другое портит статистику.
      return params.itemToAsset.has(e.itemId);
    })
    .map((e) => ({
      visitId: visit.id,
      shareLinkId: params.shareLinkId,
      hubId: params.hubId,
      type: e.type,
      assetId: e.itemId ? (params.itemToAsset.get(e.itemId) ?? null) : null,
      hubItemId: e.itemId ?? null,
      pageNumber: e.pageNumber ?? null,
      positionSec: e.positionSec ?? null,
      // Потолок — от вкладки, забытой на ночь. Часы клиента тоже могут врать,
      // поэтому режем здесь, а не полагаемся на проверку в браузере.
      durationMs: e.durationMs
        ? Math.min(e.durationMs, MAX_EVENT_DURATION_MS)
        : null,
      // Момент по часам клиента берём только если он правдоподобен: не из
      // будущего и не старше суток. Иначе ставим своё время.
      occurredAt:
        e.at && e.at <= now + 60_000 && e.at > now - 24 * 60 * 60 * 1000
          ? new Date(e.at)
          : new Date(),
    }));

  if (rows.length === 0) return 0;

  await db.event.createMany({ data: rows });

  // Длительность ролика — свойство файла, а не события: не пишем её в
  // каждый Event, а один раз запоминаем на Asset (durationSec никогда не
  // вычисляется на сервере при загрузке, в отличие от pageCount у PDF —
  // см. комментарий в schema.prisma). where: durationSec: null делает
  // повторные приходы того же значения безобидным no-op.
  const videoDurations = new Map<string, number>();
  for (const e of params.events) {
    if (e.type === "VIDEO_PROGRESS" && e.itemId && e.durationSec) {
      const assetId = params.itemToAsset.get(e.itemId);
      if (assetId) videoDurations.set(assetId, e.durationSec);
    }
  }
  await Promise.all(
    [...videoDurations].map(([assetId, durationSec]) =>
      db.asset.updateMany({
        where: { id: assetId, durationSec: null },
        data: { durationSec },
      }),
    ),
  );

  return rows.length;
}
