import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { UserRole } from "@/generated/prisma/enums";

// Здесь НЕТ обращений к базе — намеренно. Этот файл импортирует proxy.ts,
// который срабатывает на каждый запрос ещё до рендеринга страницы,
// и работает в облегчённой среде без доступа к Postgres.

const secretKey = process.env.AUTH_SECRET;

if (!secretKey) {
  throw new Error("Не задан AUTH_SECRET. Проверь файл .env в корне проекта.");
}

const key = new TextEncoder().encode(secretKey);

export const SESSION_COOKIE = "sf_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // неделя

export type SessionPayload = {
  userId: string;
  organizationId: string;
  role: UserRole;
};

export async function encryptSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(key);
}

export async function decryptSession(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    return payload as SessionPayload;
  } catch {
    // Просрочен, подделан или испорчен — во всех случаях просто «не вошёл».
    return null;
  }
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await encryptSession(payload);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true, // скрипты на странице до куки не дотянутся
    // Secure — по факту протокола APP_URL, а не по NODE_ENV: сайт может
    // быть "production", но ещё жить на голом http без домена (см. DEPLOY.md,
    // раздел про HTTPS) — привязка к NODE_ENV однажды уже ломала вход именно
    // в таком состоянии: кука со Secure браузер по http молча не сохраняет.
    secure: process.env.APP_URL?.startsWith("https://") ?? false,
    sameSite: "lax",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
}

export async function readSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  return decryptSession(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
