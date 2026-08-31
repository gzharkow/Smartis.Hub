"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addLinkAsset, type AddLinkState } from "@/app/actions/assets";
import { SECTIONS } from "@/lib/asset-sections";
import type { AssetSection } from "@/generated/prisma/enums";
import { buttonClasses } from "@/components/ui/button";
import { fieldClasses } from "@/components/ui/field";

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
        className={buttonClasses("secondary", "md", "mb-6")}
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
            className={fieldClasses()}
          />
        </label>

        <label className="grid gap-1">
          <span className="text-xs text-muted">Название</span>
          <input
            name="title"
            maxLength={200}
            placeholder="Возьмём с сайта"
            className={fieldClasses()}
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
          className={buttonClasses("primary")}
        >
          {pending ? "Проверяем…" : "Добавить"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={buttonClasses("ghost", "md")}
        >
          Готово
        </button>

        {state && "error" in state ? (
          <span role="alert" className="text-sm text-danger">
            {state.error}
          </span>
        ) : null}

        {/* Про запрет встраивания говорим сразу: иначе продавец узнал бы
            о нём от клиента, который открыл материал и увидел пустоту. */}
        {added ? (
          state.embeddable ? (
            <span className="text-sm text-ok">
              «{state.title}» добавлена — откроется прямо в хабе
            </span>
          ) : (
            <span className="text-sm text-warn">
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
