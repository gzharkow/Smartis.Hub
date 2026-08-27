import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatFileSize } from "@/lib/assets";
import { formatHubCreated } from "@/lib/hub-format";
import { ownerLabel } from "@/lib/owner-color";
import { MAX_SPEC_TEMPLATE_BYTES } from "@/lib/spec-build";
import {
  BUILTIN_VAT_RATE_PCT,
  SPEC_TEMPLATE_KINDS,
  SPEC_TEMPLATE_TITLES,
  hasBuiltinSpecTemplate,
} from "@/lib/spec-template";
import { SPEC_TAGS, SPEC_TAG_GROUPS } from "@/lib/spec-tags";
import { SettingsTabs } from "../settings-tabs";
import { SpecTemplatesPanel, type SpecTemplateRow } from "./spec-templates-panel";
import { TagReference } from "./tag-reference";

export const dynamic = "force-dynamic";

// Шаблоны Спецификации — приложения к договору, которое собирается из
// расчёта КП. Раздел админский: подменить шаблон договора значит изменить
// то, что уйдёт клиенту за подписью, поэтому requireAdmin() жёстко, как и в
// «Администрировании», а не через матрицу прав.

export default async function SpecTemplatesPage() {
  const user = await requireAdmin();

  const uploaded = await db.specTemplate.findMany({
    where: { organizationId: user.organizationId },
    include: { uploadedBy: { select: { id: true, name: true, email: true } } },
    orderBy: [{ kind: "asc" }, { vatRatePct: "asc" }],
  });

  const rows: SpecTemplateRow[] = uploaded.map((t) => ({
    id: t.id,
    kind: t.kind,
    kindTitle: SPEC_TEMPLATE_TITLES[t.kind],
    vatRatePct: t.vatRatePct.toString(),
    fileName: t.fileName,
    meta: [formatHubCreated(t.updatedAt), formatFileSize(t.sizeBytes)].join(" · "),
    uploadedBy: t.uploadedBy ? ownerLabel(t.uploadedBy) : null,
  }));

  // Виды, под которые загруженного шаблона нет. Для застройщика-облака есть
  // встроенный — про него говорим отдельно, это не пробел.
  const kinds = SPEC_TEMPLATE_KINDS.map((kind) => ({
    kind,
    title: SPEC_TEMPLATE_TITLES[kind],
    uploadedCount: rows.filter((r) => r.kind === kind).length,
    hasBuiltin: hasBuiltinSpecTemplate(kind),
  }));

  return (
    <div className="grid max-w-4xl gap-8">
      <div>
        <SettingsTabs current="spec-templates" isAdmin />
        <h1 className="text-xl font-semibold tracking-tight">Шаблоны документов</h1>
        <p className="mt-0.5 max-w-2xl text-sm text-muted">
          Спецификация собирается из вашего .docx: мы подставляем суммы в метки
          вида <code className="rounded bg-border/60 px-1">{"{{MONTH_SUM}}"}</code>,
          не трогая шрифты и вёрстку. Загруженный здесь шаблон главнее
          встроенного в программу.
        </p>
      </div>

      <SpecTemplatesPanel
        rows={rows}
        kinds={kinds}
        builtinVatRatePct={BUILTIN_VAT_RATE_PCT}
        maxBytes={MAX_SPEC_TEMPLATE_BYTES}
      />

      <TagReference groups={[...SPEC_TAG_GROUPS]} tags={[...SPEC_TAGS]} />
    </div>
  );
}
