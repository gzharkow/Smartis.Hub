import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { SofficeBusyError, SofficeMissingError, docxToPdf } from "@/lib/soffice";

// Точный предпросмотр уже выпущенной Спецификации — для плиток в подразделе
// «Спецификации» (calculator/spec/spec-file-row.tsx). В отличие от
// /api/quotes/[id]/spec/preview (который на лету заполняет шаблон текущими
// значениями формы), здесь .docx уже готов и лежит в хранилище — просто
// конвертируем его в PDF.
//
// Авторизация — как у /api/assets/[id]/file: вход + организация, без
// hasEdit (чтение).

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new Response("Нужно войти", { status: 401 });

  const { id } = await params;
  const asset = await db.asset.findUnique({ where: { id } });

  // Чужой организации материала «не существует» — и то же для не-Спецификации:
  // маршрут не для произвольных .docx из библиотеки.
  if (
    !asset ||
    asset.organizationId !== user.organizationId ||
    !asset.storageKey ||
    asset.kind !== "DOCUMENT" ||
    asset.quoteId === null
  ) {
    return new Response("Материал не найден", { status: 404 });
  }

  const stream = await storage.get(asset.storageKey);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const docx = Buffer.concat(chunks);

  try {
    const pdf = await docxToPdf(docx);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        // Файл уже выпущен и не меняется, но кешировать смысла нет — это
        // внутренний просмотр, а не то, что грузится часто и повторно.
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    if (e instanceof SofficeMissingError) {
      return Response.json({ error: e.message, code: "LIBREOFFICE_MISSING" }, { status: 503 });
    }
    if (e instanceof SofficeBusyError) {
      return Response.json({ error: e.message, code: "BUSY" }, { status: 503 });
    }
    return Response.json(
      { error: e instanceof Error ? e.message : "Неизвестная ошибка" },
      { status: 500 },
    );
  }
}
