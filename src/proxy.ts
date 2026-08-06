import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decryptSession, SESSION_COOKIE } from "@/lib/session";
import { VISITOR_COOKIE, VISITOR_COOKIE_MAX_AGE } from "@/lib/tracking-shared";

// В Next.js 16 это то, что раньше называлось middleware. Срабатывает до рендеринга.

// Админка: быстрая проверка «кука похожа на валидную», чтобы незалогиненные
// не видели даже каркас. Настоящая проверка прав живёт в requireUser() рядом
// с запросами к базе — полагаться на один лишь proxy для авторизации нельзя.
function guardAdmin(request: NextRequest) {
  return decryptSession(request.cookies.get(SESSION_COOKIE)?.value).then(
    (session) => {
      if (session) return NextResponse.next();

      const loginUrl = new URL("/login", request.url);
      // Запомним, куда человек шёл, чтобы после входа вернуть его туда же
      loginUrl.searchParams.set("next", request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    },
  );
}

// Витрина: выдаём посетителю метку, если её ещё нет.
//
// Метка отвечает ровно на один вопрос: «этот человек уже заходил или новый?».
// Ни имени, ни почты в ней нет — только случайное число. Без неё три захода
// одного человека выглядели бы как три разных клиента.
//
// Ставим здесь, а не на странице: страницы в Next.js куки ставить не умеют,
// это можно только в proxy, в действиях и в маршрутах.
function tagVisitor(request: NextRequest) {
  const response = NextResponse.next();

  if (!request.cookies.get(VISITOR_COOKIE)?.value) {
    response.cookies.set(VISITOR_COOKIE, crypto.randomUUID(), {
      httpOnly: true, // скриптам на странице метка не нужна, её читает сервер
      // См. src/lib/session.ts — та же логика: Secure по факту протокола
      // APP_URL, не по NODE_ENV, иначе на проде без HTTPS кука не долетает.
      secure: process.env.APP_URL?.startsWith("https://") ?? false,
      sameSite: "lax",
      maxAge: VISITOR_COOKIE_MAX_AGE,
      path: "/",
    });
  }

  return response;
}

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/v/")) return tagVisitor(request);
  return guardAdmin(request);
}

export const config = {
  matcher: ["/hubs/:path*", "/assets/:path*", "/stats/:path*", "/v/:path*"],
};
