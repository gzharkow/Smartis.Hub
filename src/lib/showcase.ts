import "server-only";

import { cache } from "react";
import { db } from "./db";
import { parseContactMethods, type ContactMethod } from "./contact-methods";

// Разбор клиентской ссылки. Здесь и происходят «живые коллекции»:
// по токену мы находим ХАБ и читаем его текущее состояние. Ссылка ничего
// не хранит и ничего не замораживает — она лишь указатель. Поэтому правка
// хаба долетает до всех уже выданных ссылок сама собой.

/** Чем связаться, если ссылка не открылась — те же контакты, что у «Задать вопрос» в хабе. */
export type UnavailableContact = {
  brandColor: string;
  contacts: ContactMethod[];
};

export type ShowcaseAccess =
  | { ok: true; data: NonNullable<Awaited<ReturnType<typeof loadByToken>>> }
  | {
      ok: false;
      reason: "not_found" | "revoked" | "expired" | "unpublished" | "archived";
      // Хаб есть всегда, кроме "not_found" — ссылка существует, просто
      // сейчас недоступна. Раз хаб известен, известны и его контакты.
      contact?: UnavailableContact;
    };

const loadByToken = cache(async (token: string) => {
  return db.shareLink.findUnique({
    where: { token },
    include: {
      hub: {
        include: {
          organization: true,
          items: {
            include: { asset: true },
            orderBy: { position: "asc" },
          },
        },
      },
    },
  });
});

export async function resolveShowcase(token: string): Promise<ShowcaseAccess> {
  const link = await loadByToken(token);

  if (!link) return { ok: false, reason: "not_found" };

  // Контакты — те же, что показала бы кнопка «Задать вопрос» в самом хабе:
  // тот же переключатель (ctaEnabled) и та же подпись, а связаться всё равно
  // должно быть можно, даже если материалы сейчас недоступны.
  const contact = (): UnavailableContact | undefined => {
    const contacts = parseContactMethods(link.hub.organization.contactMethods);
    if (!link.hub.ctaEnabled || contacts.length === 0) return undefined;
    return {
      brandColor: link.hub.brandColor ?? link.hub.organization.brandColor ?? "#2563eb",
      contacts,
    };
  };

  if (link.revokedAt) return { ok: false, reason: "revoked", contact: contact() };
  if (link.expiresAt && link.expiresAt < new Date()) {
    return { ok: false, reason: "expired", contact: contact() };
  }
  // Удалённый хаб и черновик — для клиента разные вещи. Черновик ещё
  // готовится, и «загляните позже» — правда. Удалённый не появится никогда,
  // и та же фраза гоняла бы клиента впустую.
  if (link.hub.status === "ARCHIVED") {
    return { ok: false, reason: "archived", contact: contact() };
  }
  if (link.hub.status !== "PUBLISHED") {
    return { ok: false, reason: "unpublished", contact: contact() };
  }

  // Материалы, спрятанные в архив, с витрины пропадают — но история
  // просмотров по ним остаётся, см. Asset.archivedAt.
  const items = link.hub.items.filter((item) => item.asset.archivedAt === null);

  return { ok: true, data: { ...link, hub: { ...link.hub, items } } };
}
