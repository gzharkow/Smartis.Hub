import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { requireSection } from "@/lib/auth";
import { canAddMaterials, hasEdit } from "@/lib/permissions";
import { db } from "@/lib/db";
import { formatFileSize, KIND_LABELS } from "@/lib/assets";
import { SECTIONS, sectionFromSlug, permissionKeyForSection } from "@/lib/asset-sections";
import { withPlural, WORDS } from "@/lib/plural";
import {
  parseViewMode,
  VIEW_COOKIE,
  VIEW_GRID_CLASS,
  VIEW_LIST_CLASS,
} from "@/lib/view-mode";
import { ViewToggle } from "@/components/view-toggle";
import { AssetUploader } from "../asset-uploader";
import { AssetRow, type AssetRowData } from "../asset-row";
import { SectionTabs } from "../section-tabs";
import { LinkForm } from "../link-form";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

// Двойные скобки — необязательный участок адреса: одна и та же страница
// отвечает и на /assets (вся библиотека), и на /assets/auto (раздел).
// Раздел в адресе, а не в «?section=»: такую ссылку можно дать коллеге,
// и она читается с первого взгляда.

export default async function AssetsPage({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const user = await requireSection("assets");
  const view = parseViewMode((await cookies()).get(VIEW_COOKIE)?.value);

  const { section: parts } = await params;

  // /assets/auto/что-то-ещё — такого раздела нет, честно отвечаем 404,
  // а не показываем молча всю библиотеку.
  if (parts && parts.length > 1) notFound();

  const slug = parts?.[0];
  const section = sectionFromSlug(slug);
  if (slug && !section) notFound();

  const canAdd = canAddMaterials(user);

  const info = SECTIONS.find((s) => s.value === section);

  const assets = await db.asset.findMany({
    where: {
      organizationId: user.organizationId,
      // PDF калькулятора живут в «Генератор КП → Файлы», а не здесь —
      // иначе библиотека забивается расчётами вместо материалов.
      quoteId: null,
      // Личная библиотека сюда не попадает вовсе — ни своя, ни чужая,
      // у неё есть отдельная вкладка «Мои материалы» (assets/mine).
      ownerId: null,
      // «Авторынок»/«Недвижимость» дополнительно видят «Общие» — те же
      // материалы нужны в обоих направлениях продаж. «Общие» и «Кейсы»
      // показывают только себя (см. тот же выбор в assets/search/route.ts).
      ...(section
        ? section === "AUTO" || section === "REALTY"
          ? { OR: [{ section }, { section: "COMMON" as const }] }
          : { section }
        : {}),
    },
    // Считаем сразу здесь: иначе пришлось бы дёргать сервер на каждое
    // нажатие «Удалить», только чтобы узнать, в скольких хабах материал.
    include: { _count: { select: { hubItems: true } } },
    orderBy: { createdAt: "desc" },
  });

  const toRow = (a: (typeof assets)[number]): AssetRowData => ({
    id: a.id,
    title: a.title,
    kind: a.kind,
    kindLabel: KIND_LABELS[a.kind],
    section: a.section,
    pageCount: a.pageCount,
    meta: [
      a.pageCount ? `${a.pageCount} стр.` : null,
      a.sizeBytes ? formatFileSize(a.sizeBytes) : null,
    ]
      .filter(Boolean)
      .join(" · "),
    externalUrl: a.externalUrl,
    embeddable: a.embeddable,
    // Предупреждаем только про ссылки, которые точно не встраиваются:
    // у файлов это поле не значит ничего.
    opensInNewTab: a.kind === "LINK" && a.embeddable !== true,
    updatedAt: a.updatedAt,
    hubCount: a._count.hubItems,
    archived: a.archivedAt !== null,
    hasThumbnail: a.thumbnailKey !== null,
    // У ссылок и прочих файлов картинку рисовать не из чего.
    canThumbnail:
      a.kind === "PDF" ||
      a.kind === "VIDEO" ||
      a.kind === "IMAGE" ||
      a.kind === "DOCUMENT" ||
      a.kind === "SPREADSHEET",
    // Не то же самое, что canEdit страницы: на «/assets» без фильтра
    // материалы разных разделов лежат вперемешку, и право на изменение
    // проверяется по разделу КОНКРЕТНОГО материала, а не по разделу страницы.
    canEdit: hasEdit(user, permissionKeyForSection(a.section)),
  });

  const active = assets.filter((a) => a.archivedAt === null).map(toRow);
  const archived = assets.filter((a) => a.archivedAt !== null).map(toRow);

  return (
    <div>
      <PageHeader
        className="mb-4"
        title={info ? info.label : "Материалы"}
        subtitle={
          info
            ? info.hint
            : "Вся библиотека. Один материал можно ставить в любое число хабов"
        }
      />

      <SectionTabs
        current={slug ?? null}
        right={active.length > 0 ? <ViewToggle value={view} /> : null}
      />

      {/* key: при переходе между разделами загрузчик собирается заново, чтобы
          выбранный в нём раздел совпал с открытой страницей. */}
      {canAdd ? (
        <>
          <AssetUploader key={slug ?? "all"} defaultSection={section} />
          <LinkForm key={`link-${slug ?? "all"}`} defaultSection={section} />
        </>
      ) : null}

      {active.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="font-medium">
            {info ? "В этом разделе пусто" : "Библиотека пуста"}
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Загрузите первый материал — он появится здесь и станет доступен для
            сборки хабов.
          </p>
        </div>
      ) : (
        <ul className={view === "grid" ? VIEW_GRID_CLASS : VIEW_LIST_CLASS}>
          {active.map((asset) => (
            <AssetRow key={asset.id} asset={asset} view={view} />
          ))}
        </ul>
      )}

      {archived.length > 0 ? (
        // Свёрнуто по умолчанию: удалённое не должно мозолить глаза,
        // но и пропадать бесследно не должно — вернуть можно в одно нажатие.
        <details className="mt-8">
          <summary className="cursor-pointer text-sm text-muted transition hover:text-foreground">
            Удалённые — {withPlural(archived.length, WORDS.material)}
          </summary>

          <p className="mt-2 mb-3 max-w-xl text-xs text-muted">
            Клиенты их не видят, но статистика по ним сохранена. Файлы не
            стёрты — материал можно вернуть, и он появится во всех хабах, где
            стоял.
          </p>

          <ul className={view === "grid" ? VIEW_GRID_CLASS : VIEW_LIST_CLASS}>
            {archived.map((asset) => (
              <AssetRow key={asset.id} asset={asset} view={view} />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
