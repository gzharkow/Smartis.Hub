import "server-only";
import { getCurrentUser, type CurrentUser } from "./auth";
import { db } from "./db";
import { parseCalculatorConfig } from "./quote-calculator";
import type { SpecQuoteInput } from "./spec-values";
import type { SpecQuoteRecord } from "./spec-build";

// Загрузка КП для Спецификации. Отдельный модуль, потому что одну и ту же
// проверку прав делают четыре входа: страница /spec, маршруты предпросмотра
// и черновика, и server action выпуска. Server Actions и route handlers
// дёргаются прямым POST, поэтому каждый из них обязан проверить всё сам.
//
// Пока Спецификацию выпускает ТОЛЬКО администратор — так попросил владелец на
// время обкатки. Проверка стоит здесь, в единственной общей точке входа, а не
// в четырёх местах по отдельности: так её нельзя забыть в новом входе. Когда
// фичу откроют остальным, снимать ограничение нужно тоже здесь — и заодно
// вернуть кнопку в calculator/[id]/page.tsx, она прячется по той же роли.

/** null — «не найден»: и когда КП чужой организации, и когда чужого продавца,
 * и когда аккаунт не администраторский. Именно «не найден», а не «нет
 * доступа» — иначе перебором id можно было бы выяснять, какие расчёты
 * существуют. */
export async function loadQuoteForSpec(quoteId: string) {
  const user = await getCurrentUser();
  if (!user) return null;

  // Временное ограничение на время обкатки: см. комментарий к модулю.
  if (user.role !== "ADMIN") return null;

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
