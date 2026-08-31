"use client";

/**
 * Физика жестов: сопротивление у границы и возврат пружиной.
 *
 * Две вещи, которых не хватало жесту «потянуть для обновления»:
 * палец упирался в жёсткий предел, а отпущенный индикатор возвращался
 * анимацией фиксированной длительности, не зная, с какой скоростью его
 * отпустили. Обе функции чистые и без зависимостей — пригодятся любому
 * следующему жесту (шторка, свайп по карточке).
 */

/**
 * «Резинка»: чем дальше тянут за границу, тем меньше поддаётся.
 *
 * Возвращаемое значение асимптотически стремится к `dimension * constant`
 * и НИКОГДА его не достигает — поэтому у движения нет точки, в которой оно
 * замирает намертво. Жёсткая остановка читается как «зависло»; растущее
 * сопротивление — как «дальше ничего нет», и это разные ощущения.
 *
 * @param overshoot насколько увели палец за границу, px
 * @param dimension опорный размер; задаёт и предел (dimension × constant),
 *                  и то, как быстро нарастает сопротивление
 */
export function rubberband(
  overshoot: number,
  dimension: number,
  constant = 0.55,
): number {
  return (
    (overshoot * dimension * constant) /
    (dimension + constant * Math.abs(overshoot))
  );
}

/**
 * Обратная к rubberband: какому смещению пальца соответствует вот такое
 * уже показанное значение.
 *
 * Нужна ровно для одного случая — жест перехватили посреди возврата.
 * Чтобы палец не «прыгнул», новый отсчёт надо вести не от нуля, а от того
 * места, где движение застали: считаем, где палец был бы, если бы он всё
 * это время тянул сам.
 */
export function unrubberband(
  value: number,
  dimension: number,
  constant = 0.55,
): number {
  const limit = dimension * constant;
  // У предела формула уходит в бесконечность — не подпускаем вплотную.
  const v = Math.min(Math.abs(value), limit * 0.99);
  const o = (v * dimension) / (constant * (dimension - v));
  return value < 0 ? -o : o;
}

/** Не двигаем ничего, если человек попросил систему убрать анимацию. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

type SpringOptions = {
  /** Откуда начинаем — ТЕКУЩЕЕ экранное значение, не логическое. */
  from: number;
  /** Куда придём. */
  to?: number;
  /** Скорость в момент отпускания, px/с. Это и есть шов между жестом и анимацией. */
  velocity?: number;
  /**
   * За сколько примерно приходит к цели, секунды. Не «длительность»: у пружины
   * её нет, время выхода получается само. 0.3–0.4 — то, что стоит у Apple
   * на перемещении и шторках.
   */
  response?: number;
  onFrame: (value: number) => void;
  onDone?: () => void;
};

/**
 * Критически задемпфированная пружина (damping = 1.0): приходит к цели
 * быстро и без перелёта. Перелёт уместен там, где жест сам нёс инерцию
 * (бросок, флик); возврат индикатора обновления — не тот случай.
 *
 * Решение аналитическое, а не численное интегрирование: для damping = 1
 * оно точное, всегда сходится и не накапливает ошибку на длинных кадрах.
 *
 * @returns функция отмены. Вызвать её при перехвате жеста — тогда движение
 *          прекращается там, где есть, и продолжать можно от этого места.
 */
export function spring({
  from,
  to = 0,
  velocity = 0,
  response = 0.35,
  onFrame,
  onDone,
}: SpringOptions): () => void {
  if (prefersReducedMotion()) {
    onFrame(to);
    onDone?.();
    return () => {};
  }

  const w = (2 * Math.PI) / response;
  const x0 = from - to;
  const start = performance.now();
  let raf = 0;
  let cancelled = false;

  const tick = (now: number) => {
    if (cancelled) return;
    const t = (now - start) / 1000;
    // x(t) = (x0 + (v0 + ω·x0)·t)·e^(−ωt) — точное решение при damping = 1.
    const x = (x0 + (velocity + w * x0) * t) * Math.exp(-w * t);

    // Полпикселя на экране уже не видно; страховка по времени — на случай
    // очень большой начальной скорости.
    if (Math.abs(x) < 0.5 || t > 2) {
      onFrame(to);
      onDone?.();
      return;
    }

    onFrame(to + x);
    raf = requestAnimationFrame(tick);
  };

  raf = requestAnimationFrame(tick);

  return () => {
    cancelled = true;
    cancelAnimationFrame(raf);
  };
}
