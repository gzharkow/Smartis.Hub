import { hasEdit, showsOtherOwners, visibleOwnerFilter } from "@/lib/permissions";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatFileSize } from "@/lib/assets";
import { formatHubCreated } from "@/lib/hub-format";
import { ownerLabel } from "@/lib/owner-color";
import { withPlural, WORDS } from "@/lib/plural";
import { QuoteFileRow, type QuoteFileRowData } from "./quote-file-row";
import { CalculatorTabs } from "../calculator-tabs";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

// Файлы, порождённые расчётом, — это Asset с проставленным quoteId: PDF
// коммерческого предложения (addQuotePdfToHub в actions/hubs.ts) и
// Спецификация в .docx (finalizeQuoteSpec в actions/quote-spec.ts).
// Библиотека «Материалы» такие Asset нарочно не показывает (иначе расчёты
// забивают её вперемешку с презентациями), а этот раздел — их единственное
// место. Признак один — quoteId, поэтому оба вида файлов попадают сюда сами,
// без отдельной ветки.

export default async function CalculatorFilesPage() {
  const user = await requireUser();

  const files = await db.asset.findMany({
    where: {
      organizationId: user.organizationId,
      quoteId: { not: null },
      // Продавец видит файлы своих расчётов плюс те, что явно открыл
      // суперадмин, как и в самом списке «Генератор КП».
      quote: visibleOwnerFilter(user),
    },
    include: {
      quote: {
        select: {
          id: true,
          // Только чтобы показать бейдж автора — список может содержать
          // файлы расчётов разных сотрудников вперемешку.
          ...(showsOtherOwners(user)
            ? { owner: { select: { id: true, name: true, email: true } } }
            : {}),
        },
      },
      _count: { select: { hubItems: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const toRow = (a: (typeof files)[number]): QuoteFileRowData => ({
    id: a.id,
    // Бейдж берём из расширения в ключе хранилища, а не из AssetKind: у КП и
    // у Спецификации kind разный (PDF против DOCUMENT), но человеку нужно
    // видеть формат файла, а не наш внутренний вид материала.
    kindLabel: (a.storageKey?.split(".").pop() ?? "файл").toUpperCase(),
    title: a.title,
    meta: [
      a.pageCount ? `${a.pageCount} стр.` : null,
      a.sizeBytes ? formatFileSize(a.sizeBytes) : null,
    ]
      .filter(Boolean)
      .join(" · "),
    created: formatHubCreated(a.createdAt),
    hubCount: a._count.hubItems,
    quoteId: a.quote?.id ?? null,
    archived: a.archivedAt !== null,
    owner:
      a.quote && "owner" in a.quote && a.quote.owner
        ? { id: a.quote.owner.id, label: ownerLabel(a.quote.owner) }
        : null,
  });

  const active = files.filter((a) => a.archivedAt === null).map(toRow);
  const archived = files.filter((a) => a.archivedAt !== null).map(toRow);
  const canEdit = hasEdit(user, "calculator.files");

  return (
    <div>
      <PageHeader
        className="mb-4"
        title="Файлы"
        subtitle="Файлы, сгенерированные Генератором КП: PDF коммерческих предложений и Спецификации в .docx — в общей библиотеке материалов не показываются"
      />

      <CalculatorTabs current="files" />

      {active.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="font-medium">Пока ни одного файла</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Здесь появятся PDF расчётов, добавленных в хаб, и Спецификации,
            выпущенные со страницы расчёта.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-2">
          {active.map((file) => (
            <QuoteFileRow key={file.id} file={file} canEdit={canEdit} />
          ))}
        </ul>
      )}

      {archived.length > 0 ? (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm text-muted transition hover:text-foreground">
            Удалённые — {withPlural(archived.length, WORDS.material)}
          </summary>

          <ul className="mt-3 grid grid-cols-1 gap-2">
            {archived.map((file) => (
              <QuoteFileRow key={file.id} file={file} canEdit={canEdit} />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
