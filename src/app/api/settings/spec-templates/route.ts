import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { storage, storageKeys } from "@/lib/storage";
import {
  DOCX_MIME,
  MAX_SPEC_TEMPLATE_BYTES,
  validateSpecTemplate,
} from "@/lib/spec-build";
import { isSpecTemplateKind } from "@/lib/spec-template";
import { prepareSpecTemplate, type SpecPrepareReport } from "@/lib/spec-prepare";

// Загрузка шаблона Спецификации. Route handler, а не server action: файл
// приезжает FormData, а у server actions тело по умолчанию ограничено
// одним мегабайтом — тот же приём, что у /api/assets/upload.
//
// Маршрут дёргают напрямую, а не только из нашей формы, поэтому и вход, и
// роль проверяются здесь.

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Нужно войти." }, { status: 401 });
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Недостаточно прав." }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get("file");
  const kind = form.get("kind");

  if (!isSpecTemplateKind(kind)) {
    return NextResponse.json({ error: "Не выбран вид шаблона." }, { status: 400 });
  }

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Файл не получен." }, { status: 400 });
  }

  if (file.size > MAX_SPEC_TEMPLATE_BYTES) {
    return NextResponse.json(
      { error: `Файл больше ${Math.round(MAX_SPEC_TEMPLATE_BYTES / 1024 / 1024)} МБ.` },
      { status: 413 },
    );
  }

  if (!/\.docx$/i.test(file.name)) {
    return NextResponse.json(
      { error: "Нужен файл .docx. Файлы .doc сначала пересохраните в Word." },
      { status: 415 },
    );
  }

  const original = Buffer.from(await file.arrayBuffer());

  // Метки расставляем сами: прочерки и «НДС (N%)» превращаются в {{…}}, чтобы
  // админу не пришлось править шаблон в Word. Файл, где метки уже есть,
  // проходит как есть. Не .docx отсюда выйдет ошибкой — её нормально покажет
  // validateSpecTemplate ниже.
  let bytes: Buffer = original;
  let report: SpecPrepareReport | null = null;
  try {
    const prepared = await prepareSpecTemplate(original);
    bytes = prepared.bytes;
    report = prepared.report;
  } catch (e) {
    console.error("[spec-templates] автоподготовка не удалась:", e);
  }

  // Метки проверяем до записи: шаблон без нужных меток дал бы документ с
  // пустыми местами, и заметили бы это уже перед отправкой клиенту.
  const problems = await validateSpecTemplate(bytes);
  if (problems.length > 0) {
    return NextResponse.json(
      { error: problems.map((p) => p.message).join("\n"), problems, report },
      { status: 422 },
    );
  }

  // Ставка в ключ не входит — храним найденную в файле, только чтобы
  // показать в списке. Не нашли ровно одну — 7 (ставка по умолчанию).
  const detectedRate =
    report && report.vatRatesFound.length === 1 ? report.vatRatesFound[0] : "7";

  const where = {
    organizationId_kind: { organizationId: user.organizationId, kind },
  };

  // Запись первой: ключ в хранилище содержит её id. Повторная загрузка
  // заменяет файл по тому же ключу — второй записи на тот же вид и ставку
  // быть не может, это уникальный индекс.
  const existing = await db.specTemplate.findUnique({ where });

  const template = existing
    ? await db.specTemplate.update({
        where,
        data: {
          fileName: file.name,
          sizeBytes: bytes.length,
          vatRatePct: detectedRate,
          uploadedById: user.id,
        },
      })
    : await db.specTemplate.create({
        data: {
          organizationId: user.organizationId,
          kind,
          vatRatePct: detectedRate,
          fileName: file.name,
          sizeBytes: bytes.length,
          uploadedById: user.id,
          storageKey: "",
        },
      });

  const key = storageKeys.specTemplate(user.organizationId, template.id);
  try {
    await storage.put(key, bytes, DOCX_MIME);
  } catch (e) {
    // Новую запись без файла оставлять нельзя — она выглядела бы как
    // загруженный шаблон. У существующей на диске остался прежний файл,
    // она по-прежнему рабочая, поэтому её не трогаем.
    if (!existing) await db.specTemplate.delete({ where: { id: template.id } });
    throw e;
  }

  if (template.storageKey !== key) {
    await db.specTemplate.update({ where: { id: template.id }, data: { storageKey: key } });
  }

  return NextResponse.json({ id: template.id, replaced: existing !== null, report });
}
