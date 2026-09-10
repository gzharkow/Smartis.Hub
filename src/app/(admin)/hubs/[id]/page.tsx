import Link from "next/link";
import { requireSection } from "@/lib/auth";
import { notFound } from "next/navigation";
import { hasEdit } from "@/lib/permissions";
import { db } from "@/lib/db";
import { formatFileSize, isSpecAsset, KIND_LABELS } from "@/lib/assets";
import { parseContactMethods } from "@/lib/contact-methods";
import { HubSettingsForm } from "./hub-settings-form";
import { HubMaterials } from "./hub-materials";
import { HubQuotePicker } from "./hub-quote-picker";
import { HubShareLinks } from "./hub-share-links";
import { PublishToggle } from "./publish-toggle";
import { DuplicateHubButton } from "./duplicate-hub-button";
import { DeleteHubButton, RestoreHubButton } from "./hub-danger-buttons";
import { HubFolderPicker } from "./hub-folder-picker";
import { DEFAULT_BRAND_COLOR } from "@/lib/brand-color";
import { PageHeader } from "@/components/ui/page-header";

const dateFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function metaOf(asset: { pageCount: number | null; sizeBytes: number | null }) {
  return [
    asset.pageCount ? `${asset.pageCount} стр.` : null,
    asset.sizeBytes ? formatFileSize(asset.sizeBytes) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

const FOLDER_FROM_RE = /^\/hubs\/folders\/([^/?#]+)$/;

/**
 * Куда ведёт «← Все хабы» вверху страницы. Хаб мог быть открыт из общего
 * списка или из конкретной папки — в обоих случаях после просмотра/удаления
 * хочется вернуться туда же, а не всегда на /hubs. `from` приходит из
 * HubList (см. hub-list.tsx/backHref), но это внешний ввод: принимаем только
 * "/hubs" либо ссылку на папку, которая реально существует в организации
 * пользователя — иначе тихий откат на /hubs, как при прямом заходе.
 */
function resolveBack(
  fromRaw: string | undefined,
  folders: { id: string; name: string }[],
): { href: string; label: string } {
  if (!fromRaw) return { href: "/hubs", label: "Все хабы" };
  if (fromRaw === "/hubs") return { href: "/hubs", label: "Все хабы" };

  const match = fromRaw.match(FOLDER_FROM_RE);
  if (match) {
    const folder = folders.find((f) => f.id === match[1]);
    if (folder) return { href: fromRaw, label: folder.name };
  }

  return { href: "/hubs", label: "Все хабы" };
}

export default async function HubPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const user = await requireSection("hubs");

  const hub = await db.hub.findUnique({
    where: { id },
    include: {
      // Нужна предпросмотру: он должен показывать тот же бренд,
      // что увидит клиент.
      organization: true,
      items: { include: { asset: true }, orderBy: { position: "asc" } },
      shareLinks: {
        include: { _count: { select: { visits: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  // Чужой организации хаба «не существует» — не подтверждаем даже факт наличия.
  if (!hub || hub.organizationId !== user.organizationId) notFound();
  if (user.role !== "ADMIN" && hub.ownerId !== user.id) notFound();

  const canEdit = hasEdit(user, "hubs");
  const archived = hub.status === "ARCHIVED";

  // Сколько ссылок реально работает у клиентов прямо сейчас — это и есть
  // цена удаления. Отозванные и просроченные и так не открываются.
  const now = new Date();
  const liveLinks = hub.shareLinks.filter(
    (l) => l.revokedAt === null && (l.expiresAt === null || l.expiresAt > now),
  ).length;

  const folders = await db.hubFolder.findMany({
    where: { organizationId: user.organizationId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const { href: backHref, label: backLabel } = resolveBack(from, folders);

  const usedAssetIds = new Set(hub.items.map((i) => i.assetId));

  // КП калькулятора (Asset.quoteId заполнен) — не материал: живёт в своём
  // списке под виджетом «Добавить расчёт из Генератора КП», не в «Материалы».
  // См. комментарий у addQuotePdfToHub в actions/hubs.ts. Спецификации
  // (тоже quoteId, но kind: "DOCUMENT") в хаб вообще не добавляются — они
  // только для скачивания из «Генератор КП → Спецификации», см. isSpecAsset.
  // Если такой HubItem всё же существует (унаследован от старой версии,
  // когда фильтров ещё не было), не показываем его нигде на странице хаба.
  const materialItems = hub.items.filter((i) => i.asset.quoteId === null);
  const quoteItems = hub.items.filter(
    (i) => i.asset.quoteId !== null && !isSpecAsset(i.asset),
  );

  // Только 4 самых используемых по хабам материала — библиотека организации
  // может быть большой, а показывать её целиком в форме хаба незачем: то,
  // что ищут реже, найдётся через поиск ниже (см. HubMaterials/assets/search).
  const frequentlyUsed = await db.asset.findMany({
    where: {
      organizationId: user.organizationId,
      archivedAt: null,
      id: { notIn: [...usedAssetIds] },
      // PDF калькулятора добавляются отдельным виджетом (HubQuotePicker
      // ниже), не через общую библиотеку — иначе она забивается расчётами.
      quoteId: null,
    },
    include: { _count: { select: { hubItems: true } } },
    orderBy: [{ hubItems: { _count: "desc" } }, { createdAt: "desc" }],
    take: 4,
  });

  return (
    <div className="mx-auto w-full max-w-7xl grid grid-cols-1 gap-8">
      <div>
        <Link
          href={backHref}
          className="text-sm text-muted transition hover:text-foreground"
        >
          ← {backLabel}
        </Link>

        {/* У удалённого хаба публиковать и копировать нечего — сначала
            вернуть. Иначе «Опубликовать» тихо воскресило бы его в обход
            восстановления. Без права «Изменение» ни одной из этих кнопок
            нет вовсе — действие всё равно отбилось бы на сервере. */}
        <PageHeader
          className="mt-2"
          title={hub.title}
          actions={
            canEdit ? (
              <div className="flex flex-wrap items-center gap-2">
                {archived ? (
                  <RestoreHubButton hubId={hub.id} />
                ) : (
                  <>
                    <DuplicateHubButton hubId={hub.id} />
                    <DeleteHubButton hubId={hub.id} liveLinks={liveLinks} />
                    <PublishToggle
                      hubId={hub.id}
                      published={hub.status === "PUBLISHED"}
                      // Не hub.items.length: скрытая от клиента спецификация
                      // не должна давать хабу опубликоваться «непустым».
                      itemCount={materialItems.length + quoteItems.length}
                    />
                  </>
                )}
              </div>
            ) : null
          }
        />

        {/* У удалённого хаба папку не показываем: он лежит в корзине,
            а не на полке. */}
        {archived || !canEdit ? null : (
          <div className="mt-3">
            <HubFolderPicker
              hubId={hub.id}
              folderId={hub.folderId}
              folders={folders}
            />
          </div>
        )}

        {archived ? (
          <p className="mt-3 rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-sm text-warn">
            Хаб удалён: ссылки у клиентов не открываются. Материалы, ссылки и
            статистика сохранены — «Вернуть» восстановит хаб черновиком.
          </p>
        ) : null}
      </div>

      <section className="grid grid-cols-1 gap-4">
        <h2 className="text-sm font-semibold tracking-tight text-muted uppercase">
          Оформление
        </h2>
        <HubSettingsForm
          hub={hub}
          // Те же значения по умолчанию, что подставит витрина, —
          // иначе предпросмотр показал бы не тот бренд.
          brandColor={hub.brandColor ?? hub.organization.brandColor ?? DEFAULT_BRAND_COLOR}
          logoUrl={hub.logoUrl ?? hub.organization.logoUrl ?? "/logo.png"}
          orgName={hub.organization.name}
          contacts={parseContactMethods(hub.contactMethods)}
          contactTemplate={
            user.contactMethodsTemplate ? parseContactMethods(user.contactMethodsTemplate) : null
          }
          canEdit={canEdit}
        />
      </section>

      <details open className="border-t border-border pt-8">
        <summary className="cursor-pointer text-sm font-semibold tracking-tight text-muted uppercase">
          Материалы
        </summary>
        <div className="mt-4">
          <HubMaterials
            hubId={hub.id}
            items={materialItems.map((item) => ({
              id: item.id,
              assetId: item.assetId,
              title: item.titleOverride ?? item.asset.title,
              kindLabel: KIND_LABELS[item.asset.kind],
              meta: metaOf(item.asset),
              archived: item.asset.archivedAt !== null,
            }))}
            frequentlyUsed={frequentlyUsed.map((asset) => ({
              id: asset.id,
              title: asset.title,
              kindLabel: KIND_LABELS[asset.kind],
              kind: asset.kind,
              meta: metaOf(asset),
              section: asset.section,
              pageCount: asset.pageCount,
              externalUrl: asset.externalUrl,
              embeddable: asset.embeddable,
              hasThumbnail: asset.thumbnailKey !== null,
            }))}
            excludeAssetIds={[...usedAssetIds]}
            canEdit={canEdit}
          />
        </div>
      </details>

      {/* Отдельно от библиотеки: расчёт — не файл, который где-то лежит,
          а PDF, собираемый по нажатию из текущего состояния КП (снимок
          на момент добавления, см. addQuotePdfToHub). Виджет чисто
          добавляющий — без прав редактирования показывать нечего. */}
      {canEdit ? (
        <details open className="border-t border-border pt-8">
          <summary className="cursor-pointer text-sm font-medium">
            Добавить расчёт из Генератора КП
          </summary>
          <div className="mt-4">
            <HubQuotePicker
              hubId={hub.id}
              items={quoteItems.map((item) => ({
                id: item.id,
                title: item.titleOverride ?? item.asset.title,
                meta: metaOf(item.asset),
              }))}
            />
          </div>
        </details>
      ) : null}

      <details open className="border-t border-border pt-8">
        <summary className="cursor-pointer text-sm font-semibold tracking-tight text-muted uppercase">
          Ссылки для клиентов
        </summary>
        <div className="mt-4">
          <HubShareLinks
            hubId={hub.id}
            canEdit={canEdit}
            published={hub.status === "PUBLISHED"}
            baseUrl={process.env.APP_URL ?? "http://localhost:3000"}
            links={hub.shareLinks.map((link) => ({
              id: link.id,
              token: link.token,
              recipientCompany: link.recipientCompany,
              greeting: link.greeting,
              expiresAt: link.expiresAt ? dateFmt.format(link.expiresAt) : null,
              revoked: link.revokedAt !== null,
              expired: link.expiresAt !== null && link.expiresAt < new Date(),
              visits: link._count.visits,
              trackingEnabled: link.trackingEnabled,
            }))}
          />
        </div>
      </details>
    </div>
  );
}
