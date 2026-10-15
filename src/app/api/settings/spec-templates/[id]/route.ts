import { Readable } from "node:stream";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { DOCX_MIME } from "@/lib/spec-build";
import { SPEC_TEMPLATE_TITLES } from "@/lib/spec-template";

// Скачивание загруженного шаблона — чтобы админ мог достать действующий файл,
// поправить его в Word и загрузить обратно, не разыскивая исходник по почте.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new Response("Нужно войти", { status: 401 });
  if (user.role !== "ADMIN") return new Response("Недостаточно прав", { status: 403 });

  const { id } = await params;
  const template = await db.specTemplate.findUnique({ where: { id } });

  // Чужой организации шаблона «не существует».
  if (!template || template.organizationId !== user.organizationId || !template.storageKey) {
    return new Response("Шаблон не найден", { status: 404 });
  }

  const size = await storage.size(template.storageKey);
  const stream = await storage.get(template.storageKey);

  const name = `Спецификация — ${SPEC_TEMPLATE_TITLES[template.kind]}.docx`;

  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Content-Type": DOCX_MIME,
      "Content-Length": String(size),
      "Content-Disposition": `attachment; filename="${template.id}.docx"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
