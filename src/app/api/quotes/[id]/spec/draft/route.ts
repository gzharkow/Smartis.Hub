import { loadQuoteForSpec, specRecordFrom } from "@/lib/spec-quote";
import { DOCX_MIME, renderSpecDocx } from "@/lib/spec-build";
import { SpecEditableValuesSchema } from "@/lib/spec-values";

// Черновик Спецификации без выпуска: файл скачивается, но к расчёту не
// прикрепляется. Нужен, когда точного предпросмотра нет (LibreOffice не
// установлен) — продавец смотрит документ в самом Word, где вёрстка заведомо
// верная, и возвращается нажать «Принять».

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
    return Response.json({ error: e instanceof Error ? e.message : "Ошибка" }, { status: 422 });
  }

  const asciiName = `spec-draft-${loaded.quote.id}.docx`;
  const utf8Name = encodeURIComponent(`Спецификация (черновик) ${loaded.quote.clientName}.docx`);

  return new Response(new Uint8Array(docx), {
    headers: {
      "Content-Type": DOCX_MIME,
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
      "Cache-Control": "private, no-store",
    },
  });
}
