"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteSpecTemplate } from "@/app/actions/spec-templates";
import { formatHubCreated } from "@/lib/format-datetime";
import type { SpecTemplateKind } from "@/lib/spec-template";
import { buttonClasses } from "@/components/ui/button";
import { cardClasses } from "@/components/ui/card";

// Список загруженных шаблонов и форма загрузки.
//
// Загрузка идёт fetch-ом в /api/settings/spec-templates, а не server action:
// у actions тело ограничено мегабайтом, а это файл. Тот же приём, что у
// загрузчика материалов.

export type SpecTemplateRow = {
  id: string;
  kind: SpecTemplateKind;
  kindTitle: string;
  vatRatePct: string;
  fileName: string;
  updatedAt: Date;
  sizeLabel: string;
  uploadedBy: string | null;
};

export type KindSummary = {
  kind: SpecTemplateKind;
  title: string;
  uploadedCount: number;
  hasBuiltin: boolean;
};

export function SpecTemplatesPanel({
  rows,
  kinds,
  maxBytes,
}: {
  rows: SpecTemplateRow[];
  kinds: KindSummary[];
  maxBytes: number;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [kind, setKind] = useState<SpecTemplateKind>(kinds[0]?.kind ?? "BUILDER_CLOUD");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [report, setReport] = useState<PrepareReport | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    setDone(null);
    setReport(null);

    try {
      const form = new FormData();
      form.set("file", file);
      form.set("kind", kind);

      const response = await fetch("/api/settings/spec-templates", {
        method: "POST",
        body: form,
      });
      const body = await response.json().catch(() => null);

      if (body?.report) setReport(body.report);

      if (!response.ok) {
        setError(body?.error ?? "Не удалось загрузить шаблон.");
        return;
      }

      setDone(body?.replaced ? "Шаблон заменён." : "Шаблон загружен.");
      router.refresh();
    } catch {
      setError("Не удалось загрузить шаблон — проверьте соединение.");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <div className="grid gap-6">
      <section className={cardClasses("panel")}>
        <h2 className="text-sm font-medium">Загрузить шаблон</h2>
        <p className="mt-1 text-xs text-muted">
          Файл .docx до {Math.round(maxBytes / 1024 / 1024)} МБ. Прочерки и ставку
          НДС в нём мы превратим в метки сами — вручную ничего расставлять не
          нужно. Если что-то не нашлось, покажем, чего именно.
        </p>

        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-xs text-muted">
            Вид документа
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as SpecTemplateKind)}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:border-accent"
            >
              {kinds.map((k) => (
                <option key={k.kind} value={k.kind}>
                  {k.title}
                </option>
              ))}
            </select>
          </label>

        </div>

        <input
          ref={fileInput}
          type="file"
          accept=".docx"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
          className="mt-4 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-accent-fill file:px-4 file:py-2 file:text-sm file:font-medium file:text-on-accent hover:file:bg-accent-fill-hover disabled:opacity-50"
        />

        {busy ? <p className="mt-3 text-sm text-muted">Проверяем и сохраняем…</p> : null}

        {error ? (
          <p className="mt-3 whitespace-pre-line rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-sm">
            {error}
          </p>
        ) : null}

        {done ? <p className="mt-3 text-sm text-accent">{done}</p> : null}

        {report ? <PrepareReportView report={report} /> : null}
      </section>

      <section className="rounded-xl border border-border">
        <h2 className="border-b border-border px-4 py-2.5 text-sm font-medium">
          Что используется сейчас
        </h2>

        <ul className="grid grid-cols-1">
          {kinds.map((k) => {
            const own = rows.filter((r) => r.kind === k.kind);
            return (
              <li key={k.kind} className="border-t border-border px-4 py-3 first:border-t-0">
                <p className="text-sm font-medium">{k.title}</p>

                {own.length === 0 ? (
                  <p className="mt-1 text-xs text-muted">
                    {k.hasBuiltin
                      ? "Свой шаблон не загружен — используется встроенный."
                      : "Шаблон не загружен. Выпустить Спецификацию по такому расчёту нельзя."}
                  </p>
                ) : (
                  <ul className="mt-2 grid gap-2">
                    {own.map((row) => (
                      <TemplateRow key={row.id} row={row} />
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

type PrepareReport = {
  alreadyTagged: boolean;
  vatRatesFound: string[];
  steps: { title: string; count: number }[];
  warnings: string[];
};

function PrepareReportView({ report }: { report: PrepareReport }) {
  const steps = report.steps.filter((s) => s.count > 0);

  return (
    <div className="mt-3 rounded-lg border border-border bg-border/20 px-3 py-2 text-xs">
      <p className="font-medium">
        {report.alreadyTagged
          ? "В файле уже были метки — они сохранены как есть."
          : "Метки расставлены автоматически."}
        {report.vatRatesFound.length > 0
          ? ` Ставка НДС в тексте: ${report.vatRatesFound.join("%, ")}% — заменена меткой, в документ подставится ставка из расчёта.`
          : ""}
      </p>
      {steps.length > 0 ? (
        <ul className="mt-1 list-disc pl-4 text-muted">
          {steps.map((s) => (
            <li key={s.title}>
              {s.title}: {s.count}
            </li>
          ))}
        </ul>
      ) : null}
      {report.warnings.map((w) => (
        <p key={w} className="mt-1 text-warn">
          {w}
        </p>
      ))}
    </div>
  );
}

function TemplateRow({ row }: { row: SpecTemplateRow }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
      <span className="min-w-32 flex-1 truncate" title={row.fileName}>
        {row.fileName}
      </span>

      <span className="hidden shrink-0 text-xs text-muted sm:inline">
        {formatHubCreated(row.updatedAt)} · {row.sizeLabel}
      </span>
      {row.uploadedBy ? (
        <span className="hidden shrink-0 text-xs text-muted md:inline">{row.uploadedBy}</span>
      ) : null}

      <a
        href={`/api/settings/spec-templates/${row.id}`}
        className={buttonClasses("ghost", "sm", "shrink-0")}
      >
        Скачать
      </a>

      {confirming ? (
        <span className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await deleteSpecTemplate(row.id);
                setConfirming(false);
                router.refresh();
              })
            }
            className={buttonClasses("danger", "sm")}
          >
            {pending ? "…" : "Точно удалить"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className={buttonClasses("ghost", "sm")}
          >
            Отмена
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className={buttonClasses("ghostDanger", "sm", "shrink-0")}
        >
          Удалить
        </button>
      )}
    </li>
  );
}
