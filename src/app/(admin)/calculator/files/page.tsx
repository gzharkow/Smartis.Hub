import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatFileSize } from "@/lib/assets";
import { formatHubCreated } from "@/lib/hub-format";
import { withPlural, WORDS } from "@/lib/plural";
import { QuoteFileRow, type QuoteFileRowData } from "./quote-file-row";
import { CalculatorTabs } from "../calculator-tabs";

export const dynamic = "force-dynamic";

// PDF, которые Генератор КП кладёт в хабы (см. addQuotePdfToHub в
// actions/hubs.ts), — это Asset с проставленным quoteId. Библиотека
// «Материалы» такие Asset нарочно не показывает (иначе расчёты забивают
// её вперемешку с презентациями), а этот раздел — их единственное место.

export default async function CalculatorFilesPage() {
  const user = await requireUser();

  const files = await db.asset.findMany({
    where: {
      organizationId: user.organizationId,
      quoteId: { not: null },
      // Продавец видит файлы своих расчётов, администратор — все, как и
      // в самом списке «Генератор КП».
      ...(user.role === "ADMIN" ? {} : { quote: { ownerId: user.id } }),
    },
    include: {
      quote: { select: { id: true } },
      _count: { select: { hubItems: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const toRow = (a: (typeof files)[number]): QuoteFileRowData => ({
    id: a.id,
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
  });

  const active = files.filter((a) => a.archivedAt === null).map(toRow);
  const archived = files.filter((a) => a.archivedAt !== null).map(toRow);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight">Файлы</h1>
        <p className="mt-0.5 text-sm text-muted">
          PDF, сгенерированные Генератором КП — не показываются в общей
          библиотеке материалов
        </p>
      </div>

      <CalculatorTabs current="files" />

      {active.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="font-medium">Пока ни одного файла</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Файл появится здесь, как только PDF расчёта добавят в хаб —
            кнопка «Добавить расчёт из Генератора КП» на странице хаба.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-2">
          {active.map((file) => (
            <QuoteFileRow key={file.id} file={file} />
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
              <QuoteFileRow key={file.id} file={file} />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
