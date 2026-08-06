"use client";

import { useEffect, useRef } from "react";

/**
 * Анимированный фон экрана входа.
 *
 * Тот же приём, что на референсе my.smartis.bi: зациклённое видео карты из
 * точек (public/login-bg.mp4, ~30 сек, без звука). Файл взят с сайта самого
 * SMARTIS, поэтому анимация здесь один в один с оригиналом.
 *
 * Фон всегда тёмный, независимо от темы кабинета: как и витрина клиента,
 * вход к светлой теме не привязан — ролик тёмный сам по себе.
 *
 * autoplay + muted + playsInline — обязательная тройка: без muted браузеры
 * запрещают автозапуск, без playsInline на iPhone видео открылось бы
 * на весь экран отдельным плеером.
 */
export function LoginBackdrop() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Кто просил меньше движения — тому застывший первый кадр вместо ролика.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      video.pause();
    }
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#0b0f14]"
    >
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        // Пока ролик грузится, показываем тёмную картинку-волну из точек —
        // экран не мигает чёрным. object-cover, чтобы заполнить любой экран
        // без чёрных полей.
        poster="/hub-bg.jpg"
        className="absolute inset-0 h-full w-full object-cover"
      >
        <source src="/login-bg.mp4" type="video/mp4" />
      </video>

      {/* Затемнение к центру: под карточкой фон спокойнее, текст читается. */}
      <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_50%,transparent,rgba(4,7,11,0.55))]" />
    </div>
  );
}
