import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { parseTheme, THEME_COOKIE, THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "cyrillic"],
});

// Только для надписи «.HUB» рядом с логотипом: геометрический гротеск ближе
// к буквам SMARTIS, чем Geist. Лежит в репозитории, а не тянется из Google
// Fonts: там, где Google недоступен, next/font молча подставлял запасной шрифт.
const wordmark = localFont({
  variable: "--font-wordmark",
  // Вариативный файл: толщина подбирается любым числом от 100 до 900.
  src: "./fonts/montserrat-latin-wght-normal.woff2",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Smartis.HUB",
  description: "Важные материалы всегда под рукой",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Выбранная тема приходит с сервера — страница сразу отрисовывается нужной.
  // Если выбора ещё не было, атрибут проставит THEME_SCRIPT по настройке
  // системы, ещё до первой отрисовки.
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <html
      lang="ru"
      data-theme={theme ?? undefined}
      // Атрибут может отличаться от серверного: скрипт правит его до того,
      // как React возьмётся за страницу. Это ожидаемо, а не рассогласование.
      suppressHydrationWarning
      // dvh, не h-full: в standalone-PWA на iOS с viewport-fit=cover
      // проценты от «100%» не всегда совпадают с реальной видимой областью —
      // фиксированные элементы (нижний PWA-бар) не долетают до края экрана.
      // dvh браузer пересчитывает под фактический вьюпорт, на десктопе и в
      // обычном мобильном браузере ведёт себя как %, разницы не будет.
      className={`${geistSans.variable} ${geistMono.variable} ${wordmark.variable} h-dvh antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh flex flex-col">{children}</body>
    </html>
  );
}
