import { loadQuoteForSpec, specRecordFrom } from "@/lib/spec-quote";
import { renderSpecDocx } from "@/lib/spec-build";
import { SpecEditableValuesSchema } from "@/lib/spec-values";
import { SofficeBusyError, SofficeMissingError, docxToPdf } from "@/lib/soffice";

// Точный предпросмотр Спецификации: собираем .docx и отдаём его PDF-рендер.
// Тот же принцип авторизации, что у src/app/api/quotes/[id]/pdf/route.ts.
//
// POST, а не GET: значения формы приходят телом запроса. Ничего не
// сохраняется — предпросмотр всегда собирается из текущего состояния экрана.

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const loaded = await loadQuoteForSpec(id);
  if (!loaded) return new Response("КП не найден", { status: 404 });

  const parsed = SpecEditableValuesSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Значения не прошли проверку" }, { status: 400 });
  }

  let docx: Buffer;
  try {
    docx = await renderSpecDocx(specRecordFrom(loaded.quote), parsed.data);
  } catch (e) {
    return Response.json({ error: message(e) }, { status: 422 });
  }

  try {
    const pdf = await docxToPdf(docx);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        // Никогда не кешируем — документ всегда собирается заново.
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    if (e instanceof SofficeMissingError) {
      return Response.json({ error: message(e), code: "LIBREOFFICE_MISSING" }, { status: 503 });
    }
    if (e instanceof SofficeBusyError) {
      return Response.json({ error: message(e), code: "BUSY" }, { status: 503 });
    }
    return Response.json({ error: message(e) }, { status: 500 });
  }
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : "Неизвестная ошибка";
}
