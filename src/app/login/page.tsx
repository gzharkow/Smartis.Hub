import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";
import { LoginBackdrop } from "./login-backdrop";

// Тот же манифест, что и в (admin)/layout.tsx — /login это неавторизованное
// состояние того же приложения продавца, устанавливаемого на экран.
export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Smartis.HUB",
    statusBarStyle: "black-translucent",
  },
};

// Своего viewport у этой страницы не было, хотя statusBarStyle ниже —
// "black-translucent", то есть страница разворачивается ПОД полосу состояния.
// Без viewportFit: "cover" это заявление ничем не подкреплено: env(safe-area-*)
// остаются нулевыми, и отступ под вырез взять неоткуда. Дефолт Next здесь не
// подставляется — как только сегмент дерева задаёт viewport, он задаёт его
// целиком (та же оговорка, что и в (admin)/layout.tsx).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Одиночный тег без media — намеренно: подложка входа тёмная в любой теме
  // кабинета, и syncThemeColor такие теги не трогает (см. src/lib/theme.ts).
  themeColor: "#0b0f14",
};

export default async function LoginPage({
  searchParams,
}: {
  // В Next.js 16 searchParams приходит промисом — его надо дождаться.
  searchParams: Promise<{ next?: string }>;
}) {
  if (await getCurrentUser()) redirect("/hubs");

  const { next } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <LoginBackdrop />

      <div className="w-full max-w-sm">
        {/* Логотип и название — НАД карточкой, на тёмном фоне. Всегда
            светлое: фон под входом тёмный независимо от темы кабинета. */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex items-end gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-wordmark-white.png"
              alt="Smartis"
              className="h-9 w-auto"
            />
            <span className="-ml-1.5 translate-y-[5px] text-[45px] leading-none font-[weight:190] font-[family-name:var(--font-wordmark)] text-white/70">
              .H<span className="text-[34px]">UB</span>
            </span>
          </div>
        </div>

        {/* В карточке — только подпись и форма: название с логотипом переехали
            наверх. Карточка сама подстраивается под тему кабинета. */}
        <div className="rounded-2xl border border-border bg-background/95 px-6 py-5 shadow-2xl backdrop-blur-sm">
          <p className="mb-4 text-center text-sm text-muted">
            Система для эффективных продаж
          </p>

          <LoginForm next={next} />
        </div>
      </div>
    </main>
  );
}
