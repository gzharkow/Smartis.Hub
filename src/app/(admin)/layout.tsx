import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import { NAV_COOKIE, NAV_SHUT_COOKIE } from "./nav-cookie";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { BottomNav } from "./bottom-nav";
import { PullToRefresh } from "./pull-to-refresh";

// Скобки в имени папки (admin) — это группа маршрутов: она объединяет страницы
// общим оформлением, но в адресе не появляется. /hubs остаётся /hubs.

// Манифест и apple-web-app теги — здесь и на /login, не в корневом layout:
// это делает установку на экран доступной только для админки, не витрины.
export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Smartis.Flite",
    statusBarStyle: "black-translucent",
  },
};

// viewportFit: "cover" — предпосылка для env(safe-area-inset-bottom) в
// нижнем PWA-баре (без него на iPhone эта переменная всегда 0). Корневой
// layout.tsx своего viewport не задаёт, поэтому здесь приходится явно
// повторить и дефолты (width/initialScale) — как только сегмент дерева
// определяет viewport, автоматическая подстановка дефолта для него
// перестаёт срабатывать.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  // Читаем на сервере, чтобы страница сразу пришла в нужном виде — иначе
  // меню схлопывалось бы на глазах при каждом открытии.
  const jar = await cookies();
  const collapsed = jar.get(NAV_COOKIE)?.value === "1";
  const shut = (jar.get(NAV_SHUT_COOKIE)?.value ?? "")
    .split(",")
    .filter(Boolean);

  const theme = parseTheme(jar.get(THEME_COOKIE)?.value);
  const isAdmin = user.role === "ADMIN";

  return (
    // Фрагмент, не общая обёртка: BottomNav должен быть ПРЯМЫМ flex-child'ом
    // <body> (см. корневой layout.tsx — min-h-dvh flex flex-col), иначе
    // sticky-позиционирование бара не сможет опереться на стандартную
    // раскладку "sticky footer" (flex-колонка минимум в экран высотой,
    // последний элемент — sticky bottom-0).
    <>
      <div className="flex flex-1">
        {/* На узком экране установленного PWA сайдбар и шапка уступают место
            нижнему таб-бару (см. @custom-variant standalone в globals.css).
            Каждый обёрнут отдельно (не вместе с <main>!) — иначе спряталась
            бы и сама страница, а не только их chrome вокруг неё. display:
            contents делает обёртку прозрачной для flex-раскладки, hidden под
            составным условием убирает элемент целиком. На десктопе и в
            обычной вкладке браузера ничего не меняется. */}
        <div className="contents standalone:max-md:hidden">
          <Sidebar
            isAdmin={isAdmin}
            initialCollapsed={collapsed}
            initialShut={shut}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="contents standalone:max-md:hidden">
            <Topbar email={user.email} theme={theme} />
          </div>

          {/* Отступ сверху — только на узком экране PWA: 2rem — тот же
              базовый отступ, что и py-8 на десктопе, плюс вырез статус-бара
              (иначе заголовок страницы под ним). Снизу отступ больше не
              нужен — sticky-бар сам резервирует место в потоке. */}
          <main className="flex-1 px-6 py-8 xl:px-10 2xl:px-14 standalone:max-md:pt-[calc(2rem+env(safe-area-inset-top))]">
            {children}
          </main>
        </div>
      </div>

      <PullToRefresh />
      <BottomNav isAdmin={isAdmin} email={user.email} theme={theme} />
    </>
  );
}
