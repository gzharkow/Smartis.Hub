import "server-only";

import { headers } from "next/headers";
import type { SecurityEventType } from "@/generated/prisma/enums";
import { db } from "./db";
import { trustedClientIp } from "./login-throttle";
import {
  clip,
  createOncePerWindow,
  purgeDue,
  retentionCutoff,
  sanitizeDetails,
} from "./security-log-core";

// Журнал безопасности: кто и что сделал с доступами и данными. Правила:
//  - сбой журнала НИКОГДА не ломает действие пользователя — всё в try/catch;
//  - пароли, хэши и токены сюда не попадают (см. sanitizeDetails);
//  - каждая запись дублируется строкой `[security] {...}` в stdout — это второй
//    независимый след (journalctl -u smartfollow) на случай проблем с базой;
//  - записи старше 12 месяцев удаляются лениво, не чаще раза в сутки на процесс.

type Who = {
  id?: string | null;
  email?: string | null;
  organizationId?: string | null;
};

type Target = { id?: string | null; label?: string | null };

export type SecurityEventInput = {
  type: SecurityEventType;
  actor?: Who | null;
  target?: Target | null;
  details?: Record<string, unknown>;
  /** В route-обработчиках передаём request; в серверных действиях не нужен. */
  request?: Request;
};

const globalForLog = globalThis as unknown as {
  securityLogLastPurge: number | undefined;
  blockedLogLimiter: ReturnType<typeof createOncePerWindow> | undefined;
};

const blockedLimiter = (globalForLog.blockedLogLimiter ??= createOncePerWindow(60_000));

/** Блокировку входа пишем не чаще раза в минуту на пару «адрес + почта». */
export function shouldLogBlocked(ip: string, email: string): boolean {
  return blockedLimiter.allow(`${ip}|${email.trim().toLowerCase()}`, Date.now());
}

async function clientHeaders(request?: Request): Promise<Headers | null> {
  if (request) return request.headers;
  try {
    return await headers();
  } catch {
    return null;
  }
}

function maybePurge() {
  const now = Date.now();
  if (!purgeDue(globalForLog.securityLogLastPurge ?? 0, now)) return;
  globalForLog.securityLogLastPurge = now;
  db.securityEvent
    .deleteMany({ where: { occurredAt: { lt: retentionCutoff(now) } } })
    .catch((e) => console.error("[security] не удалось очистить старые записи:", e?.message));
}

export async function logSecurityEvent(input: SecurityEventInput): Promise<void> {
  try {
    const h = await clientHeaders(input.request);
    const ip = h ? trustedClientIp(h) : null;
    const userAgent = clip(h?.get("user-agent"));
    const details = sanitizeDetails(input.details);

    const row = {
      type: input.type,
      organizationId: input.actor?.organizationId ?? null,
      actorId: input.actor?.id ?? null,
      actorEmail: clip(input.actor?.email),
      targetId: clip(input.target?.id),
      targetLabel: clip(input.target?.label),
      ip,
      userAgent,
      details: details ?? undefined,
    };

    await db.securityEvent.create({ data: row });
    console.info(`[security] ${JSON.stringify({ ...row, at: new Date().toISOString() })}`);
    maybePurge();
  } catch (e) {
    console.error(
      `[security] не удалось записать событие ${input.type}:`,
      e instanceof Error ? e.message : e,
    );
  }
}
