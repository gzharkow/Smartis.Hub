"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isStandaloneNarrow } from "@/lib/pwa";

const THRESHOLD = 70;
const MAX_PULL = 90;
// Тормозим палец относительно движения индикатора — иначе жест ощущается
// «прилипшим» к пальцу без пружинности, как в нативных списках.
const RESISTANCE = 0.5;

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
 * router.refresh() (не location.reload()) — перезапрашивает данные текущей
 * страницы у сервера без белого экрана перезагрузки.
 */
export function PullToRefresh() {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  // isDragging — только для рендера (переключает CSS-transition). pulling —
  // та же информация, но для обработчиков: ref, а не state, чтобы не
  // перевешивать слушатели на каждый пиксель жеста через зависимость эффекта.
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef<number | null>(null);
  const pulling = useRef(false);

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      if (refreshing || window.scrollY > 0 || !isStandaloneNarrow()) {
        startY.current = null;
        return;
      }
      startY.current = e.touches[0].clientY;
      pulling.current = false;
    }

    function onTouchMove(e: TouchEvent) {
      if (startY.current === null) return;
      const delta = e.touches[0].clientY - startY.current;

      if (delta <= 0 || window.scrollY > 0) {
        pulling.current = false;
        setIsDragging(false);
        setPull(0);
        return;
      }

      pulling.current = true;
      setIsDragging(true);
      e.preventDefault();
      setPull(Math.min(delta * RESISTANCE, MAX_PULL));
    }

    function onTouchEnd() {
      if (pulling.current) {
        setPull((current) => {
          if (current >= THRESHOLD) {
            setRefreshing(true);
            router.refresh();
            // У router.refresh() нет колбэка «готово» — прячем индикатор
            // через фиксированную паузу, достаточную для типового обновления.
            setTimeout(() => {
              setRefreshing(false);
              setPull(0);
            }, 700);
            return THRESHOLD * RESISTANCE;
          }
          return 0;
        });
      }
      startY.current = null;
      pulling.current = false;
      setIsDragging(false);
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [refreshing, router]);

  const progress = Math.min(pull / (THRESHOLD * RESISTANCE), 1);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-40 hidden standalone:max-md:flex justify-center"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        transform: `translateY(${pull - 40}px)`,
        opacity: pull > 0 || refreshing ? 1 : 0,
        transition: isDragging ? "none" : "transform 0.2s, opacity 0.2s",
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
  );
}
