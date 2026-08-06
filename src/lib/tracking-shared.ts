import { z } from "zod";

// Общее для трёх сторон: proxy, сервер и браузер клиента.
// Здесь НЕТ обращений к базе — этот файл попадает и в облегчённую среду proxy,
// и в браузер вместе со страницей витрины.

export const VISITOR_COOKIE = "sf_vid";
export const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // год

/** Как часто браузер шлёт «я ещё здесь». */
export const HEARTBEAT_MS = 10_000;

/**
 * Сколько времени засчитываем за один пульс. Чуть больше самого промежутка —
 * иначе на каждом цикле терялась бы миллисекунда, и за час набежала бы ощутимая
 * недостача. Верхняя граница на сервере всё равно режет выбросы.
 */
export const HEARTBEAT_CREDIT_MS = HEARTBEAT_MS + 2_000;

/**
 * Потолок на длительность одного события. Защита от вкладки, забытой на ночь:
 * без него «клиент изучал прайс 8 часов» попало бы в статистику как правда.
 */
export const MAX_EVENT_DURATION_MS = 5 * 60 * 1000;

export const EVENT_TYPES = [
  "HUB_VIEW",
  "ITEM_OPEN",
  "ITEM_CLOSE",
  "PAGE_VIEW",
  "VIDEO_PROGRESS",
  "DOWNLOAD",
  "LINK_CLICK",
  "DEMO_CLICK",
  "CONTACT_CLICK",
  "HEARTBEAT",
] as const;

export const TrackEventSchema = z.object({
  type: z.enum(EVENT_TYPES),
  /** id материала внутри хаба (HubItem). У HUB_VIEW его нет. */
  itemId: z.string().max(40).optional(),
  pageNumber: z.number().int().min(1).max(10_000).optional(),
  positionSec: z.number().int().min(0).max(24 * 60 * 60).optional(),
  durationMs: z.number().int().min(0).max(MAX_EVENT_DURATION_MS).optional(),
  /** Момент события по часам клиента, мс. Нужен, чтобы не терять порядок
   *  у событий, накопленных пачкой и отправленных разом. */
  at: z.number().int().optional(),
});

// Пачкой — чтобы не долбить сервер на каждый чих. Потолок защищает
// от попытки залить миллион событий одним запросом.
export const TrackBatchSchema = z.object({
  events: z.array(TrackEventSchema).min(1).max(50),
});

export type TrackEvent = z.infer<typeof TrackEventSchema>;
