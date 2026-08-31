import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatFileSize } from "@/lib/assets";
import { formatHubCreated } from "@/lib/hub-format";
import { specAvailability } from "@/lib/spec-build";
import { loadQuoteForSpec, specInputFrom, specRecordFrom } from "@/lib/spec-quote";
import { SPEC_TEMPLATE_TITLES } from "@/lib/spec-template";
import { deriveSpecValues } from "@/lib/spec-values";
import { isSofficeAvailable } from "@/lib/soffice";
import { SpecReview } from "./spec-review";

export const dynamic = "force-dynamic";

export default async function SpecPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser();

  const loaded = await loadQuoteForSpec(id);
  if (!loaded) notFound();

  const { quote } = loaded;
  const availability = await specAvailability(specRecordFrom(quote));

  return (
    <div className="mx-auto w-full max-w-7xl">
      <Link
        href={`/calculator/${quote.id}`}
        className="text-sm text-muted transition hover:text-foreground"
      >
        ← {quote.clientName}
      </Link>

      <h1 className="mt-2 text-xl font-semibold tracking-tight">Спецификация</h1>
      <p className="mt-0.5 text-sm text-muted">
        Приложение к договору, собранное из расчёта. Проверьте суммы и нажмите
        «Принять» — файл прикрепится к расчёту.
      </p>

      {availability.ok ? (
        <Available quote={quote} kindTitle={SPEC_TEMPLATE_TITLES[availability.kind]} />
      ) : (
        <div className="mt-6 rounded-xl border border-dashed border-border p-6">
          <p className="font-medium">Выпустить Спецификацию пока нельзя</p>
          <p className="mt-1 max-w-xl text-sm text-muted">{availability.reason}</p>
        </div>
      )}
    </div>
  );
}

async function Available({
  quote,
  kindTitle,
}: {
  quote: NonNullable<Awaited<ReturnType<typeof loadQuoteForSpec>>>["quote"];
  kindTitle: string;
}) {
  const { editable, issues } = deriveSpecValues(specInputFrom(quote));

  // Ранее выпущенные Спецификации этого расчёта — снимки, как и PDF в хабах:
  // каждое нажатие «Принять» создаёт новый файл, старые остаются.
  const released = await db.asset.findMany({
    where: { quoteId: quote.id, kind: "DOCUMENT", archivedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, createdAt: true, sizeBytes: true },
    take: 10,
  });

  return (
    <SpecReview
      quoteId={quote.id}
      vatRatePct={quote.vatRatePct.toNumber()}
      clientType={quote.clientType}
      initial={editable}
      issues={issues}
      kindTitle={kindTitle}
      // Проверяем один раз на сервере: спрашивать LibreOffice на каждый рендер
      // формы незачем, ответ за время жизни процесса не меняется.
      previewAvailable={await isSofficeAvailable()}
      released={released.map((a) => ({
        id: a.id,
        // Форматируем здесь: formatFileSize живёт в server-only модуле.
        meta: [formatHubCreated(a.createdAt), a.sizeBytes ? formatFileSize(a.sizeBytes) : null]
          .filter(Boolean)
          .join(" · "),
      }))}
    />
  );
}
