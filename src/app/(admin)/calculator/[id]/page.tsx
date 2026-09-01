import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import { hasEdit } from "@/lib/permissions";
import { db } from "@/lib/db";
import { parseCalculatorConfig } from "@/lib/quote-calculator";
import { specAvailability } from "@/lib/spec-build";
import { QuoteEditor } from "./quote-editor";
import { QuoteActionsBar } from "./quote-actions-bar";
import { PageHeader } from "@/components/ui/page-header";

export default async function QuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const quote = await db.quote.findUnique({
    where: { id },
    include: {
      sections: {
        orderBy: { position: "asc" },
        include: { lines: { orderBy: { position: "asc" } } },
      },
    },
  });

  // Чужой организации КП «не существует» — не подтверждаем даже факт наличия.
  if (!quote || quote.organizationId !== user.organizationId) notFound();
  if (user.role !== "ADMIN" && quote.ownerId !== user.id) notFound();

  const canEdit = hasEdit(user, "calculator");

  const availability = await specAvailability({
    organizationId: quote.organizationId,
    clientType: quote.clientType,
    boxIntegrationSelected: quote.boxIntegrationSelected,
    vatRatePct: quote.vatRatePct.toString(),
  });

  return (
    <div className="mx-auto w-full max-w-7xl grid grid-cols-1 gap-6">
      <div>
        <Link
          href="/calculator"
          className="text-sm text-muted transition hover:text-foreground"
        >
          ← Все расчёты
        </Link>

        <PageHeader
          className="mt-2"
          title={quote.clientName}
          actions={
            <QuoteActionsBar
              quoteId={quote.id}
              canEdit={canEdit}
              spec={
                availability.ok
                  ? { ok: true }
                  : { ok: false, reason: availability.reason }
              }
            />
          }
        />
      </div>

      <QuoteEditor
        canEdit={canEdit}
        quote={{
          id: quote.id,
          clientName: quote.clientName,
          vatRatePct: quote.vatRatePct.toNumber(),
          // "YYYY-MM-DD" — формат, который ждёт <input type="date">.
          documentDate: quote.documentDate.toISOString().slice(0, 10),
          clientType: quote.clientType,
          calculatorConfig: parseCalculatorConfig(quote.calculatorConfig),
          boxIntegrationSelected: quote.boxIntegrationSelected,
          sections: quote.sections.map((section) => ({
            id: section.id,
            title: section.title,
            countsTowardImplementationPayment: section.countsTowardImplementationPayment,
            lines: section.lines.map((line) => ({
              id: line.id,
              title: line.title,
              description: line.description,
              quantity: line.quantity.toNumber(),
              unitPrice: line.unitPrice?.toNumber() ?? null,
              autoStorageLimit: line.autoStorageLimit,
            })),
          })),
        }}
      />
    </div>
  );
}
