import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { resolveShowcase } from "@/lib/showcase";
import { clientIp, hashIp, ingestEvents } from "@/lib/tracking";
import { TrackBatchSchema, VISITOR_COOKIE } from "@/lib/tracking-shared";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  // Та же проверка, что и у самой витрины: отозванная или истёкшая ссылка
  // не только не показывает материалы, но и перестаёт слать статистику.
  const access = await resolveShowcase(token);
  if (!access.ok) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  // Ссылка «Для АМО» (и любая другая с выключенным трекингом) — открытия по
  // ней не интерес клиента, а свои же заходы через CRM. Молча соглашаемся,
  // ничего не пишем: ни Visit, ни Event.
  if (!access.data.trackingEnabled) {
    return NextResponse.json({ ok: true, stored: 0 });
  }

  const visitorId = (await cookies()).get(VISITOR_COOKIE)?.value;
  if (!visitorId) {
    // Метку ставит proxy при первом заходе. Её отсутствие означает, что кук нет
    // вовсе — считать такого посетителя нечем, молча соглашаемся и не пишем.
    return NextResponse.json({ ok: true, stored: 0 });
  }

  const parsed = TrackBatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const h = await headers();

  const stored = await ingestEvents({
    shareLinkId: access.data.id,
    hubId: access.data.hubId,
    visitorId,
    events: parsed.data.events,
    itemToAsset: new Map(access.data.hub.items.map((i) => [i.id, i.assetId])),
    ipHash: hashIp(clientIp(h)),
    userAgent: h.get("user-agent")?.slice(0, 400) ?? null,
    referrer: h.get("referer")?.slice(0, 400) ?? null,
  });

  return NextResponse.json({ ok: true, stored });
}
