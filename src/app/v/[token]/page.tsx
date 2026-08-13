import type { Metadata } from "next";
import { resolveShowcase } from "@/lib/showcase";
import { sanitizeHtml } from "@/lib/sanitize";
import { parseContactMethods } from "@/lib/contact-methods";
import { formatFileSize, KIND_LABELS } from "@/lib/assets";
import { ShowcaseUnavailable } from "./unavailable";
import { ShowcaseBody } from "./showcase-body";

// Витрина ВСЕГДА читается заново. Это прямое требование к живым коллекциям:
// закэшированная страница показала бы клиенту вчерашний состав материалов
// и пережила бы отзыв ссылки.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const access = await resolveShowcase(token);

  return {
    title: access.ok ? (access.data.hub.headline ?? access.data.hub.title) : "Материалы",
    // Ссылка расходится по почте и мессенджерам — в поиске ей делать нечего.
    robots: { index: false, follow: false },
  };
}

export default async function ShowcasePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const access = await resolveShowcase(token);

  if (!access.ok) {
    return <ShowcaseUnavailable reason={access.reason} contact={access.contact} />;
  }

  const { hub, greeting } = access.data;
  const org = hub.organization;

  const brandColor = hub.brandColor ?? org.brandColor ?? "#2563eb";
  const logoUrl = hub.logoUrl ?? org.logoUrl ?? "/logo.png";
  const contacts = parseContactMethods(hub.contactMethods);

  return (
    <ShowcaseBody
      token={token}
      brandColor={brandColor}
      logoUrl={logoUrl}
      orgName={org.name}
      headline={hub.headline ?? hub.title}
      greeting={greeting}
      // Чистим ещё раз, уже на выходе. В базе лежит очищенное, но это
      // последний рубеж: если туда однажды попадёт грязь мимо формы,
      // до браузера клиента она не доедет.
      descriptionHtml={hub.descriptionHtml ? sanitizeHtml(hub.descriptionHtml) : null}
      cta={hub.ctaEnabled && contacts.length > 0 ? hub.ctaLabel : null}
      contacts={contacts}
      demo={
        hub.demoUrl
          ? { url: hub.demoUrl, label: hub.demoLabel, note: hub.demoNote }
          : null
      }
      items={hub.items.map((item) => ({
        id: item.id,
        title: item.titleOverride ?? item.asset.title,
        description: item.descriptionOverride ?? item.asset.description,
        kind: item.asset.kind,
        kindLabel: KIND_LABELS[item.asset.kind],
        externalUrl: item.asset.externalUrl,
        // Не проверили — считаем, что встраивать нельзя: пустая рамка
        // выглядит поломкой, а честная кнопка «Открыть» — нет.
        embeddable: item.asset.embeddable === true,
        // Нужно просмотрщику: разметить места под страницы до того,
        // как файл догрузится, чтобы лента не дёргалась.
        pageCount: item.asset.pageCount,
        hasThumbnail: item.asset.thumbnailKey !== null,
        meta: [
          item.asset.pageCount ? `${item.asset.pageCount} стр.` : null,
          item.asset.sizeBytes ? formatFileSize(item.asset.sizeBytes) : null,
        ]
          .filter(Boolean)
          .join(" · "),
      }))}
    />
  );
}
