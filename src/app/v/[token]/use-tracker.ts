"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  HEARTBEAT_CREDIT_MS,
  HEARTBEAT_MS,
  type TrackEvent,
} from "@/lib/tracking-shared";

/** Как часто копим события и отправляем пачкой. */
const FLUSH_MS = 5_000;

/**
 * Сбор статистики на стороне клиента.
 *
 * Время считаем пульсом, а не парой «открыл/закрыл». Причина простая: события
 * закрытия может не быть вовсе — человек захлопнул ноутбук, сеть отвалилась,
 * браузер убил вкладку. По паре «открыл/закрыл» такой просмотр либо потерялся
 * бы целиком, либо длился бы до конца времён. Пульс же просто перестаёт
 * приходить, и последнее засчитанное время оказывается близким к правде.
 *
 * Пульс идёт, только пока вкладка на виду. Вкладка, забытая открытой на ночь,
 * не должна превратиться в «клиент восемь часов изучал прайс».
 */
export function useTracker(token: string) {
  const queue = useRef<TrackEvent[]>([]);
  // Что человек смотрит прямо сейчас: материал и, для PDF, номер страницы.
  // Держим в ref, а не в состоянии: меняется часто (страница — на каждую
  // прокрутку), а перерисовывать из-за этого нечего.
  const focus = useRef<{ itemId: string | null; page?: number }>({
    itemId: null,
  });

  const flush = useCallback(
    (beacon = false) => {
      if (queue.current.length === 0) return;

      const events = queue.current.splice(0, queue.current.length);
      const body = JSON.stringify({ events });
      const url = `/v/${token}/track`;

      if (beacon && navigator.sendBeacon) {
        // Единственный способ доставить события с закрывающейся вкладки:
        // обычный запрос браузер отменит, а этот доживёт.
        navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
        return;
      }

      void fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {
        // Статистика не стоит того, чтобы ломать клиенту страницу.
        // Потеряли пачку — и ладно.
      });
    },
    [token],
  );

  const track = useCallback((event: TrackEvent) => {
    queue.current.push({ ...event, at: Date.now() });
  }, []);

  const setFocus = useCallback((itemId: string | null, page?: number) => {
    focus.current = { itemId, page };
  }, []);

  useEffect(() => {
    const beat = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      // Пульс несёт и номер страницы, если открыт PDF. Так время по страницам
      // считается тем же механизмом, что и время по материалам: просто
      // суммируем длительности пульсов, сгруппировав по странице.
      track({
        type: "HEARTBEAT",
        itemId: focus.current.itemId ?? undefined,
        pageNumber: focus.current.page,
        durationMs: HEARTBEAT_CREDIT_MS,
      });
    }, HEARTBEAT_MS);

    const send = setInterval(() => flush(), FLUSH_MS);

    // Уход со страницы ловим двумя событиями: pagehide срабатывает надёжнее
    // beforeunload, а visibilitychange — единственное, на что можно
    // рассчитывать на телефонах, где вкладку просто сворачивают.
    const onHide = () => {
      if (document.visibilityState === "hidden") flush(true);
    };
    const onPageHide = () => flush(true);

    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      clearInterval(beat);
      clearInterval(send);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      flush(true);
    };
  }, [track, flush]);

  return { track, setFocus };
}
