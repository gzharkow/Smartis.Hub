import { getCurrentUser } from "@/lib/auth";
import { canAccessSection } from "@/lib/permissions";
import { db } from "@/lib/db";
import { renderQuotePdf } from "@/lib/quote-pdf";
import { logSecurityEvent } from "@/lib/security-log";

// Тот же принцип авторизации, что и у src/app/api/assets/[id]/file/route.ts:
// вход в админку + организация. Плюс здесь ещё владелец — как и у самого КП,
// рядовой продавец (MEMBER) видит и скачивает только свои расчёты.

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new Response("Нужно войти", { status: 401 });
  if (!canAccessSection(user, "calculator")) {
    return new Response("КП не найден", { status: 404 });
  }

  const { id } = await params;
  const quote = await db.quote.findUnique({
    where: { id },
    include: {
      sections: {
        orderBy: { position: "asc" },
        include: { lines: { orderBy: { position: "asc" } } },
      },
    },
  });

  if (!quote || quote.organizationId !== user.organizationId) {
    return new Response("КП не найден", { status: 404 });
  }
  if (user.role !== "ADMIN" && quote.ownerId !== user.id) {
    return new Response("КП не найден", { status: 404 });
  }

  const bytes = await renderQuotePdf({
    clientName: quote.clientName,
    vatRatePct: quote.vatRatePct.toString(),
    documentDate: quote.documentDate.toISOString().slice(0, 10),
    sections: quote.sections.map((section) => ({
      id: section.id,
      title: section.title,
      countsTowardImplementationPayment: section.countsTowardImplementationPayment,
      lines: section.lines.map((line) => ({
        id: line.id,
        title: line.title,
        description: line.description,
        quantity: line.quantity.toString(),
        unitPrice: line.unitPrice?.toString() ?? null,
        autoStorageLimit: line.autoStorageLimit,
      })),
    })),
    boxIntegrationSelected: quote.boxIntegrationSelected,
  });

  await logSecurityEvent({
    type: "DATA_EXPORTED",
    request,
    actor: { id: user.id, email: user.email, organizationId: user.organizationId },
    target: { id: quote.id, label: quote.clientName },
    details: { what: "скачивание КП в PDF" },
  });

  const asciiName = `kp-${quote.id}.pdf`;
  const utf8Name = encodeURIComponent(`КП ${quote.clientName}.pdf`);

  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
      // Никогда не кешируем — файл всегда собирается из текущего состояния КП.
      "Cache-Control": "private, no-store",
    },
  });
}
