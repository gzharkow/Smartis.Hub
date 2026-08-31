"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isStandaloneNarrow } from "@/lib/pwa";
import { rubberband, spring, unrubberband } from "@/lib/gesture";

// Опорный размер резинки: предел смещения индикатора выходит
// dimension × 0.55 ≈ 110px, и достигается он только в пределе — упереться
// в стену, как раньше на жёстких 90px, больше нельзя.
const DIMENSION = 200;
/** Смещение индикатора, после которого отпускание запускает обновление. */
const TRIGGER = 56;
/** Где индикатор стоит, пока идёт обновление. */
const REST = 44;
/** Нулевая точка индикатора: выше края экрана, чтобы выезжал из-под него. */
const ORIGIN = 40;

function RefreshIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-5"
    >
      <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

/**
 * Свайп вниз в самом верху списка обновляет страницу — как в нативных
 * приложениях, у веба (даже в standalone PWA) такого поведения нет из
 * коробки. Активируется только в узком standalone — проверяется в JS
 * при каждом touchstart, а не через CSS-вариант: это обработчики событий,
 * не разметка, условным классом их не отключить.
 *
 * Физика вынесена в src/lib/gesture.ts. Здесь важны три вещи:
 * палец тянет через резинку (сопротивление растёт, упора нет), отпускание
 * передаёт СКОРОСТЬ пружине возврата (иначе между жестом и анимацией
 * виден шов), а перехват жеста посреди возврата продолжает движение от
 * того места, где его застали, а не прыгает к пальцу.
 *
 * router.refresh() (не location.reload()) — перезапрашивает данные текущей
 * страницы у сервера без белого экрана перезагрузки.
 */
export function PullToRefresh() {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Всё, что читают обработчики событий, живёт в ref, а не в состоянии:
  // слушатели вешаются один раз, и перевешивать их на каждый пиксель жеста
  // через зависимости эффекта не нужно.
  const pullRef = useRef(0);
  const startY = useRef<number | null>(null);
  const pulling = useRef(false);
  const refreshingRef = useRef(false);
  const armed = useRef(false);
  const stopSpring = useRef<(() => void) | null>(null);
  /** Последние точки движения — из них берётся скорость на отпускании. */
  const history = useRef<{ value: number; time: number }[]>([]);

  const applyPull = useCallback((value: number) => {
    pullRef.current = value;
    setPull(value);
  }, []);

  useEffect(() => {
    function cancelSpring() {
      stopSpring.current?.();
      stopSpring.current = null;
    }

    function onTouchStart(e: TouchEvent) {
      if (refreshingRef.current || window.scrollY > 0 || !isStandaloneNarrow()) {
        startY.current = null;
        return;
      }
      // Жест могли перехватить посреди возврата. Отсчёт ведём не от нуля,
      // а от места, где движение застали: считаем, где палец был бы, если
      // бы он всё это время тянул сам (иначе индикатор прыгнет).
      cancelSpring();
      startY.current =
        e.touches[0].clientY - unrubberband(pullRef.current, DIMENSION);
      pulling.current = false;
      armed.current = pullRef.current >= TRIGGER;
      history.current = [];
    }

    function onTouchMove(e: TouchEvent) {
      if (startY.current === null) return;
      const delta = e.touches[0].clientY - startY.current;

      if (delta <= 0 || window.scrollY > 0) {
        pulling.current = false;
        applyPull(0);
        return;
      }

      pulling.current = true;
      e.preventDefault();

      const next = rubberband(delta, DIMENSION);
      applyPull(next);

      history.current.push({ value: next, time: e.timeStamp });
      if (history.current.length > 6) history.current.shift();

      // Короткий отклик ровно в момент, когда жест «зарядился» — дальше
      // тянуть незачем. Android отзовётся, iOS Safari молча проигнорирует;
      // вызов безопасен и там, и там.
      if (!armed.current && next >= TRIGGER) {
        armed.current = true;
        navigator.vibrate?.(10);
      } else if (armed.current && next < TRIGGER) {
        armed.current = false;
      }
    }

    function onTouchEnd() {
      if (!pulling.current) {
        startY.current = null;
        return;
      }

      // Скорость — по последним точкам жеста, в px/с. Именно она уходит
      // в пружину и убирает шов между «тянул» и «отпустил».
      const points = history.current;
      const first = points[0];
      const last = points[points.length - 1];
      const dt = first && last ? last.time - first.time : 0;
      const velocity = dt > 0 ? ((last.value - first.value) / dt) * 1000 : 0;

      const from = pullRef.current;
      startY.current = null;
      pulling.current = false;
      history.current = [];

      if (from >= TRIGGER) {
        refreshingRef.current = true;
        setRefreshing(true);
        router.refresh();

        stopSpring.current = spring({
          from,
          to: REST,
          velocity,
          onFrame: applyPull,
        });

        // У router.refresh() нет колбэка «готово» — прячем индикатор через
        // фиксированную паузу, достаточную для типового обновления.
        window.setTimeout(() => {
          refreshingRef.current = false;
          setRefreshing(false);
          stopSpring.current = spring({
            from: pullRef.current,
            to: 0,
            onFrame: applyPull,
          });
        }, 700);
        return;
      }

      stopSpring.current = spring({ from, velocity, onFrame: applyPull });
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      cancelSpring();
    };
  }, [applyPull, router]);

  const progress = Math.min(pull / TRIGGER, 1);

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-40 hidden justify-center standalone:max-md:flex"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          transform: `translateY(${pull - ORIGIN}px)`,
          // Проявляется вместе с движением, а не рывком в конце: значение
          // ведёт пружина, отдельная CSS-анимация здесь только мешала бы.
          opacity: refreshing ? 1 : Math.min(pull / 16, 1),
        }}
      >
        <div className="mt-2 grid size-9 place-items-center rounded-full border border-border bg-surface text-muted shadow-md">
          <span
            className={refreshing ? "animate-spin" : ""}
            style={
              refreshing ? undefined : { transform: `rotate(${progress * 360}deg)` }
            }
          >
            <RefreshIcon />
          </span>
        </div>
      </div>

      {/* Жест был немым для программ чтения с экрана: индикатор aria-hidden,
          а о самом обновлении не сообщалось никак. */}
      <span role="status" aria-live="polite" className="sr-only">
        {refreshing ? "Обновляем страницу" : ""}
      </span>
    </>
  );
}
