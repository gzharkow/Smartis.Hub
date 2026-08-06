"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addLinkAsset, type AddLinkState } from "@/app/actions/assets";
import { SECTIONS } from "@/lib/asset-sections";
import type { AssetSection } from "@/generated/prisma/enums";

/**
 * Добавление ссылки как материала: кейс, статья, видео на чужом сервисе.
 *
 * Стоит рядом с загрузкой файлов, а не отдельной страницей: для продавца
 * это одно и то же действие — «положить материал в библиотеку».
 */
export function LinkForm({
  defaultSection,
}: {
  defaultSection: AssetSection | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<AddLinkState, FormData>(
    addLinkAsset,
    undefined,
  );

  const added = state && "ok" in state;

  useEffect(() => {
    if (added) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [added, router]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-6 rounded-lg border border-border px-4 py-2 text-sm font-medium transition hover:bg-border/60"
      >
        Добавить ссылку
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={action}
      className="mb-6 grid gap-3 rounded-xl border border-border bg-surface p-4"
    >
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto]">
        <label className="grid gap-1">
          <span className="text-xs text-muted">Адрес</span>
          <input
            autoFocus
            name="url"
            required
            placeholder="https://example.com/case"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-xs text-muted">Название</span>
          <input
            name="title"
            maxLength={200}
            placeholder="Возьмём с сайта"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-xs text-muted">Раздел</span>
          <select
            name="section"
            defaultValue={defaultSection ?? "COMMON"}
            className="h-[38px] rounded-lg border border-border bg-background px-2 text-sm"
          >
            {SECTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Проверяем…" : "Добавить"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-border/60"
        >
          Готово
        </button>

        {state && "error" in state ? (
          <span role="alert" className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </span>
        ) : null}

        {/* Про запрет встраивания говорим сразу: иначе продавец узнал бы
            о нём от клиента, который открыл материал и увидел пустоту. */}
        {added ? (
          state.embeddable ? (
            <span className="text-sm text-green-600 dark:text-green-400">
              «{state.title}» добавлена — откроется прямо в хабе
            </span>
          ) : (
            <span className="text-sm text-amber-700 dark:text-amber-400">
              «{state.title}» добавлена. Сайт запрещает показывать себя внутри
              других страниц — у клиента она откроется новой вкладкой
            </span>
          )
        ) : null}
      </div>

      <p className="text-xs text-muted">
        Файл не загружается — материал остаётся на своём сайте. Что там
        изменится, клиент увидит сразу.
      </p>
    </form>
  );
}
