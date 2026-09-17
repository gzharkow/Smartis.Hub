"use client";

import { useEffect, useTransition } from "react";
import { setAssetValidated } from "@/app/actions/assets";
import { useCloseOnBack } from "@/lib/use-close-on-back";
import { buttonClasses } from "@/components/ui/button";

/**
 * Попап «Файл валидирован с руководством?» — общий и для момента сразу
 * после загрузки (asset-ids всей пачки за один раз), и для кнопки
 * «Валидировать» на карточке личного материала (один id).
 *
 * Закрытие без ответа (фон/крестик/Escape) = «Нет»: файл(ы) и так создаются
 * непроверенными (validatedAt: null) — закрытие просто ничего не меняет,
 * никакого отдельного действия для этого не нужно.
 */
export function ValidationPromptModal({
  assetIds,
  onClose,
}: {
  assetIds: string[];
  onClose: () => void;
}) {
  useCloseOnBack(onClose);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  function answer(validated: boolean) {
    startTransition(async () => {
      await Promise.all(assetIds.map((id) => setAssetValidated(id, validated)));
      onClose();
    });
  }

  const title =
    assetIds.length > 1
      ? `Файлы валидированы с руководством? (${assetIds.length})`
      : "Файл валидирован с руководством?";

  return (
    <div
      className="fixed inset-0 z-50 grid cursor-pointer place-items-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm cursor-auto rounded-2xl border border-border bg-surface p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-muted transition hover:bg-border/60 hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => answer(true)}
            className={buttonClasses("primary")}
          >
            Да
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => answer(false)}
            className={buttonClasses("secondary")}
          >
            Нет
          </button>
        </div>
      </div>
    </div>
  );
}
