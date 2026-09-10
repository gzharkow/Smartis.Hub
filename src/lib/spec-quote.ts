import "server-only";
import { getCurrentUser, type CurrentUser } from "./auth";
import { canAccessSection } from "./permissions";
import { db } from "./db";
import { parseCalculatorConfig } from "./quote-calculator";
import type { SpecQuoteInput } from "./spec-values";
import type { SpecQuoteRecord } from "./spec-build";

// Загрузка КП для Спецификации. Отдельный модуль, потому что одну и ту же
// проверку прав делают четыре входа: страница /spec, маршруты предпросмотра
// и черновика, и server action выпуска. Server Actions и route handlers
// дёргаются прямым POST, поэтому каждый из них обязан проверить всё сам.

/** null — «не найден»: и когда КП чужой организации, и когда чужого продавца.
 * Именно «не найден», а не «нет доступа» — иначе перебором id можно было бы
 * выяснять, какие расчёты существуют. */
export async function loadQuoteForSpec(quoteId: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!canAccessSection(user, "calculator")) return null;

  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    include: {
      sections: {
        orderBy: { position: "asc" },
        include: { lines: { orderBy: { position: "asc" } } },
      },
    },
  });

  if (!quote || quote.organizationId !== user.organizationId) return null;
  if (user.role !== "ADMIN" && quote.ownerId !== user.id) return null;

  return { user: user as CurrentUser, quote };
}

type LoadedQuote = NonNullable<Awaited<ReturnType<typeof loadQuoteForSpec>>>["quote"];

/** Decimal из Prisma → строки: spec-values чистый и не должен зависеть от
 * того, какой именно Decimal ему принесли. */
export function specInputFrom(quote: LoadedQuote): SpecQuoteInput {
  return {
    vatRatePct: quote.vatRatePct.toString(),
    calculatorConfig: parseCalculatorConfig(quote.calculatorConfig),
    sections: quote.sections.map((section) => ({
      countsTowardImplementationPayment: section.countsTowardImplementationPayment,
      lines: section.lines.map((line) => ({
        title: line.title,
        quantity: line.quantity.toString(),
        unitPrice: line.unitPrice?.toString() ?? null,
      })),
    })),
  };
}

export function specRecordFrom(quote: LoadedQuote): SpecQuoteRecord {
  return {
    organizationId: quote.organizationId,
    clientType: quote.clientType,
    boxIntegrationSelected: quote.boxIntegrationSelected,
    vatRatePct: quote.vatRatePct.toString(),
  };
}
