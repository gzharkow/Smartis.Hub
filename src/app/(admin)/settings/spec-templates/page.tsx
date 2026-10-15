import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatFileSize } from "@/lib/assets";
import { ownerLabel } from "@/lib/owner-color";
import { MAX_SPEC_TEMPLATE_BYTES } from "@/lib/spec-build";
import {
  SPEC_TEMPLATE_KINDS,
  SPEC_TEMPLATE_TITLES,
  hasBuiltinSpecTemplate,
} from "@/lib/spec-template";
import { SPEC_TAGS, SPEC_TAG_GROUPS } from "@/lib/spec-tags";
import { SettingsTabs } from "../settings-tabs";
import { SpecTemplatesPanel, type SpecTemplateRow } from "./spec-templates-panel";
import { TagReference } from "./tag-reference";
import { PageHeader } from "@/components/ui/page-header";

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
    orderBy: [{ kind: "asc" }],
  });

  const rows: SpecTemplateRow[] = uploaded.map((t) => ({
    id: t.id,
    kind: t.kind,
    kindTitle: SPEC_TEMPLATE_TITLES[t.kind],
    vatRatePct: t.vatRatePct.toString(),
    fileName: t.fileName,
    updatedAt: t.updatedAt,
    sizeLabel: formatFileSize(t.sizeBytes),
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
        <PageHeader
          title="Шаблоны документов"
          subtitle={
            // Ширину ограничиваем на самом тексте, а не на <p> из PageHeader:
            // длинное объяснение читается плохо во всю ширину страницы.
            <span className="block max-w-2xl">
              Спецификация собирается из вашего .docx: мы подставляем суммы в
              метки вида{" "}
              <code className="rounded bg-border/60 px-1">{"{{MONTH_SUM}}"}</code>
              , не трогая шрифты и вёрстку. Метки расставлять не нужно:
              загрузите согласованный документ с прочерками — мы расставим их
              сами, а ставку НДС возьмём из расчёта. Загруженный здесь шаблон
              главнее встроенного в программу.
            </span>
          }
        />
      </div>

      <SpecTemplatesPanel
        rows={rows}
        kinds={kinds}
        maxBytes={MAX_SPEC_TEMPLATE_BYTES}
      />

      <TagReference groups={[...SPEC_TAG_GROUPS]} tags={[...SPEC_TAGS]} />
    </div>
  );
}
