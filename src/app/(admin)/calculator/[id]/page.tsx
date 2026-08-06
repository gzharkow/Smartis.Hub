import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseCalculatorConfig } from "@/lib/quote-calculator";
import { QuoteEditor } from "./quote-editor";
import { QuoteActionsBar } from "./quote-actions-bar";

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

  return (
    <div className="mx-auto w-full max-w-7xl grid grid-cols-1 gap-6">
      <div>
        <Link
          href="/calculator"
          className="text-sm text-muted transition hover:text-foreground"
        >
          ← Все расчёты
        </Link>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <h1 className="text-xl font-semibold tracking-tight">
            {quote.clientName}
          </h1>
          <QuoteActionsBar quoteId={quote.id} />
        </div>
      </div>

      <QuoteEditor
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
