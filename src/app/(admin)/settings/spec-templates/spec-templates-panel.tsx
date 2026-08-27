"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteSpecTemplate } from "@/app/actions/spec-templates";
import type { SpecTemplateKind } from "@/lib/spec-template";

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
  meta: string;
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
  builtinVatRatePct,
  maxBytes,
}: {
  rows: SpecTemplateRow[];
  kinds: KindSummary[];
  builtinVatRatePct: number;
  maxBytes: number;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [kind, setKind] = useState<SpecTemplateKind>(kinds[0]?.kind ?? "BUILDER_CLOUD");
  const [vatRatePct, setVatRatePct] = useState(String(builtinVatRatePct));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    setDone(null);

    try {
      const form = new FormData();
      form.set("file", file);
      form.set("kind", kind);
      form.set("vatRatePct", vatRatePct);

      const response = await fetch("/api/settings/spec-templates", {
        method: "POST",
        body: form,
      });
      const body = await response.json().catch(() => null);

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
      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-sm font-medium">Загрузить шаблон</h2>
        <p className="mt-1 text-xs text-muted">
          Файл .docx до {Math.round(maxBytes / 1024 / 1024)} МБ. Перед сохранением
          проверим, что в нём есть все нужные метки — список ниже.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="grid gap-1 text-xs text-muted">
            Вид документа
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as SpecTemplateKind)}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-blue-500"
            >
              {kinds.map((k) => (
                <option key={k.kind} value={k.kind}>
                  {k.title}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-xs text-muted">
            Ставка НДС, %
            <input
              value={vatRatePct}
              onChange={(e) => setVatRatePct(e.target.value)}
              inputMode="decimal"
              className="w-28 rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-blue-500"
            />
          </label>
        </div>

        <p className="mt-2 text-xs text-muted">
          Ставка — часть шаблона: она напечатана в его тексте примерно в десяти
          местах. Расчёт с другой ставкой этим файлом не заполнить, для неё
          нужен свой.
        </p>

        <input
          ref={fileInput}
          type="file"
          accept=".docx"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
          className="mt-4 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-500 disabled:opacity-50"
        />

        {busy ? <p className="mt-3 text-sm text-muted">Проверяем и сохраняем…</p> : null}

        {error ? (
          <p className="mt-3 whitespace-pre-line rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
            {error}
          </p>
        ) : null}

        {done ? <p className="mt-3 text-sm text-blue-600 dark:text-blue-400">{done}</p> : null}
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
                      ? `Свой шаблон не загружен — используется встроенный (НДС ${builtinVatRatePct}%).`
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

function TemplateRow({ row }: { row: SpecTemplateRow }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
      <span className="shrink-0 rounded-md bg-border/70 px-2 py-0.5 text-xs font-medium">
        НДС {row.vatRatePct}%
      </span>

      <span className="min-w-32 flex-1 truncate" title={row.fileName}>
        {row.fileName}
      </span>

      <span className="hidden shrink-0 text-xs text-muted sm:inline">{row.meta}</span>
      {row.uploadedBy ? (
        <span className="hidden shrink-0 text-xs text-muted md:inline">{row.uploadedBy}</span>
      ) : null}

      <a
        href={`/api/settings/spec-templates/${row.id}`}
        className="shrink-0 rounded px-2 py-1 text-xs text-muted transition hover:bg-border/60 hover:text-foreground"
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
            className="rounded px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400"
          >
            {pending ? "…" : "Точно удалить"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded px-2 py-1 text-xs text-muted transition hover:bg-border/60"
          >
            Отмена
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="shrink-0 rounded px-2 py-1 text-xs text-muted transition hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
        >
          Удалить
        </button>
      )}
    </li>
  );
}
