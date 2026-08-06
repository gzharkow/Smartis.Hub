import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSectionView, hasEdit } from "@/lib/permissions";
import { db } from "@/lib/db";
import { formatFileSize, KIND_LABELS } from "@/lib/assets";
import { parseContactMethods } from "@/lib/contact-methods";
import { HubSettingsForm } from "./hub-settings-form";
import { HubMaterials } from "./hub-materials";
import { HubQuotePicker } from "./hub-quote-picker";
import { HubShareLinks } from "./hub-share-links";
import { PublishToggle } from "./publish-toggle";
import { DuplicateHubButton } from "./duplicate-hub-button";
import { DeleteHubButton, RestoreHubButton } from "./hub-danger-buttons";
import { HubFolderPicker } from "./hub-folder-picker";

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

export default async function HubPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireSectionView("hubs");

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

  const usedAssetIds = new Set(hub.items.map((i) => i.assetId));

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
          href="/hubs"
          className="text-sm text-muted transition hover:text-foreground"
        >
          ← Все хабы
        </Link>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <h1 className="text-xl font-semibold tracking-tight">{hub.title}</h1>

          {/* У удалённого хаба публиковать и копировать нечего — сначала
              вернуть. Иначе «Опубликовать» тихо воскресило бы его в обход
              восстановления. Без права «Изменение» ни одной из этих кнопок
              нет вовсе — действие всё равно отбилось бы на сервере. */}
          {canEdit ? (
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
                    itemCount={hub.items.length}
                  />
                </>
              )}
            </div>
          ) : null}
        </div>

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
          <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
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
          brandColor={hub.brandColor ?? hub.organization.brandColor ?? "#2563eb"}
          logoUrl={hub.logoUrl ?? hub.organization.logoUrl ?? "/logo.png"}
          orgName={hub.organization.name}
          contacts={parseContactMethods(hub.organization.contactMethods)}
          canEdit={canEdit}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 border-t border-border pt-8">
        <h2 className="text-sm font-semibold tracking-tight text-muted uppercase">
          Материалы
        </h2>
        <HubMaterials
          hubId={hub.id}
          items={hub.items.map((item) => ({
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

        {/* Отдельно от библиотеки: расчёт — не файл, который где-то лежит,
            а PDF, собираемый по нажатию из текущего состояния КП (снимок
            на момент добавления, см. addQuotePdfToHub). Виджет чисто
            добавляющий — без прав редактирования показывать нечего. */}
        {canEdit ? (
          <div>
            <h3 className="mb-2 text-sm font-medium">Добавить расчёт из Генератора КП</h3>
            <HubQuotePicker hubId={hub.id} />
          </div>
        ) : null}
      </section>

      <section className="grid grid-cols-1 gap-4 border-t border-border pt-8">
        <h2 className="text-sm font-semibold tracking-tight text-muted uppercase">
          Ссылки для клиентов
        </h2>
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
          }))}
        />
      </section>
    </div>
  );
}
