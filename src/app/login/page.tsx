import type { Metadata } from "next";
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
    title: "Smartis.Flite",
    statusBarStyle: "black-translucent",
  },
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
        {/* Логотип и название — НАД карточкой, на тёмном фоне, как на референсе
            my.smartis.bi. Начертание тонкое и разрядистое — под тот же характер
            (точного шрифта в их SVG-логотипе нет, повторяем стиль). Всегда
            светлое: фон под входом тёмный независимо от темы кабинета. */}
        <div className="mb-8 flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-9 w-auto" />
          <div className="flex items-baseline text-white">
            <span className="text-[1.7rem] leading-none font-extralight tracking-[0.14em]">
              SMARTIS
            </span>
            {/* Отрицательный отступ гасит хвост разрядки после последней S,
                иначе точка отъезжала бы вправо. */}
            <span className="-ml-[0.14em] text-[1.35rem] leading-none font-light text-white/70">
              .Flite
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
