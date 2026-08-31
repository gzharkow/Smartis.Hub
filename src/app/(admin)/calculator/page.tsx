import Link from "next/link";
import { requireUser } from "@/lib/auth";
import Decimal from "decimal.js";
import { cookies } from "next/headers";
import { hasEdit, showsOtherOwners, visibleOwnerFilter } from "@/lib/permissions";
import { db } from "@/lib/db";
import { formatHubCreated } from "@/lib/hub-format";
import { ownerLabel } from "@/lib/owner-color";
import { OwnerBadge } from "@/components/owner-badge";
import { calculateQuote, formatMoney } from "@/lib/quote-calc";
import {
  parseQuoteSort,
  quoteOrderBy,
  QUOTE_SORT_COOKIE,
} from "@/lib/quote-sort";
import { QuoteSortControl } from "@/components/quote-sort-control";
import { CreateQuoteForm } from "./create-quote-form";
import { QuoteListRowActions } from "./quote-list-row-actions";
import { CalculatorTabs } from "./calculator-tabs";
import { PageHeader } from "@/components/ui/page-header";

export default async function CalculatorPage() {
  const user = await requireUser();
  const jar = await cookies();
  const sort = parseQuoteSort(jar.get(QUOTE_SORT_COOKIE)?.value);

  const quotes = await db.quote.findMany({
    where: {
      organizationId: user.organizationId,
      // Продавец видит свои расчёты плюс те, что явно открыл суперадмин.
      ...visibleOwnerFilter(user),
      archivedAt: null,
    },
    include: {
      // Порядок секций важен теперь, когда список различает «первую» секцию
      // (СА) от остальных (Решения) — без явной сортировки Prisma не гарантирует
      // порядок вложенной выборки.
      sections: { orderBy: { position: "asc" }, include: { lines: true } },
      // Только чтобы показать бейдж автора — список может содержать расчёты
      // разных сотрудников вперемешку.
      ...(showsOtherOwners(user)
        ? { owner: { select: { id: true, name: true, email: true } } }
        : {}),
    },
    // «Сумма» считается уже после выборки (см. quoteOrderBy) — тогда сюда
    // передаём дефолтный порядок, а сортируем готовые строки ниже.
    orderBy: quoteOrderBy(sort) ?? { updatedAt: "desc" },
  });

  // «СА» — первая секция расчёта (обычно «Сквозная аналитика Smartis»),
  // «Решения» — сумма всех остальных секций (доп. интеграции, Post-view и
  // всё, что продавец добавит секциями после первой). Без НДС — для быстрой
  // прикидки в списке, а не то, что видит клиент в PDF (там — суммы с НДС).
  const rows = quotes.map((quote) => {
    const totals = calculateQuote(quote.sections, quote.vatRatePct.toString());
    const saTotal = totals.sections[0]?.subtotalWithoutVat ?? new Decimal(0);
    const solutionsTotal = totals.sections
      .slice(1)
      .reduce((sum, s) => sum.plus(s.subtotalWithoutVat), new Decimal(0));
    return { quote, saTotal, solutionsTotal };
  });

  // Сумму Prisma посчитать не может (она не хранится полем) — сортируем уже
  // готовые строки в JS, остальные поля Prisma уже упорядочила в запросе.
  if (sort.field === "amount") {
    const dirMul = sort.dir === "asc" ? 1 : -1;
    rows.sort(
      (a, b) =>
        dirMul *
        a.saTotal
          .plus(a.solutionsTotal)
          .comparedTo(b.saTotal.plus(b.solutionsTotal)),
    );
  }

  return (
    <div>
      <PageHeader
        className="mb-6"
        title="Генератор КП"
        subtitle="Расчёты стоимости для клиентов — замена общей таблицы"
        actions={hasEdit(user, "calculator") ? <CreateQuoteForm /> : null}
      />

      <CalculatorTabs current="quotes" />

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="font-medium">Пока ни одного расчёта</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Создайте расчёт для клиента — секции и строки заполнятся
            привычным шаблоном, дальше всё можно свободно менять.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-2 flex justify-end">
            <QuoteSortControl sort={sort} />
          </div>
          <ul className="grid grid-cols-1 gap-2">
            {rows.map(({ quote, saTotal, solutionsTotal }) => (
              <li key={quote.id} className="flex items-stretch gap-2">
                <Link
                  href={`/calculator/${quote.id}`}
                  className="grid min-w-0 flex-1 grid-cols-1 gap-2 rounded-xl border border-border bg-surface px-4 py-3 transition hover:border-muted sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{quote.clientName}</p>
                      {"owner" in quote && quote.owner ? (
                        <OwnerBadge id={quote.owner.id} label={ownerLabel(quote.owner)} />
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-sm text-muted">
                      Изменён {formatHubCreated(quote.updatedAt)}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-0.5 text-sm sm:justify-items-end sm:text-right">
                    <span>
                      <span className="text-muted">СА: </span>
                      <b className="font-semibold">{formatMoney(saTotal)}</b>
                    </span>
                    <span>
                      <span className="text-muted">Решения: </span>
                      <b className="font-semibold">{formatMoney(solutionsTotal)}</b>
                    </span>
                  </div>
                </Link>
                <div className="flex items-center">
                  <QuoteListRowActions quoteId={quote.id} canEdit={hasEdit(user, "calculator")} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
