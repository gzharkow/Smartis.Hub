"use client";

import { useEffect, useRef } from "react";

/**
 * iOS WebKit анимирует скрытие/появление адресной строки во время скролла,
 * и на это время position: fixed/sticky относительно layout-вьюпорта может
 * на кадр-другой рассинхронизироваться с реальным видимым краем экрана —
 * нижний бар "отлетает" от низа к середине. window.visualViewport даёт
 * фактические, живые размеры видимой области (в отличие от layout
 * viewport/dvh, которые во время анимации адресной строки не всегда
 * совпадают с тем, что реально видно) — держим bottom бара синхронизированным
 * с ним напрямую, а не полагаемся на sticky.
 *
 * Не регрессия к самому первому багу (bottom-nav.tsx хранит его историю):
 * там причина была разовый неверный снимок вьюпорта на холодном старте,
 * до первого touch-скролла. Здесь — живая подписка на реальные события,
 * синхронна с фактическим состоянием уже на первом кадре.
 *
 * Слушаем только resize, не scroll: resize стреляет именно на изменение
 * РАЗМЕРА видимой области (в т.ч. скрытие/появление адресной строки — ради
 * этого всё и заведено), а scroll — на изменение позиции (offsetTop),
 * которое в WebKit паразитно дёргается ещё и во время эластичного отскока
 * прокрутки (rubber-band bounce у верхней/нижней границы страницы). Раньше
 * scroll тоже слушали — из-за него при резком флике до упора бар видимо
 * «подпрыгивал» на переходных значениях и возвращался на место только
 * когда отскок затихал и приходило финальное, уже верное resize-событие.
 */
export function useVisualViewportBottomOffset<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    let raf = 0;

    function apply() {
      raf = 0;
      const el = ref.current;
      if (!el || !vv) return;
      // Насколько видимая область (visualViewport) меньше layout-вьюпорта
      // снизу — именно на этот отступ адресная строка/клавиатура съедают
      // экран прямо сейчас.
      const offset = window.innerHeight - (vv.height + vv.offsetTop);
      el.style.bottom = `${Math.max(0, offset)}px`;
    }

    function schedule() {
      if (raf) return;
      raf = requestAnimationFrame(apply);
    }

    apply();
    vv.addEventListener("resize", schedule);
    return () => {
      vv.removeEventListener("resize", schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return ref;
}
