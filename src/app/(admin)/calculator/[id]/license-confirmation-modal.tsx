"use client";

import { useEffect } from "react";
import { useCloseOnBack } from "@/lib/use-close-on-back";
import { buttonClasses } from "@/components/ui/button";

/**
 * Напоминание перед сохранением КП застройщика: регион (Москва+МО,
 * Санкт-Петербург+ЛО, топ-3 региона) не хранится нигде в базе — это
 * человеческое правило подбора Enterprise-лицензии, которое легко забыть.
 * Окно не блокирует сохранение принудительно — тот же паттерн, что у
 * ChangePasswordModal (см. change-password-dialog.tsx): крестик/фон/Escape
 * закрывают без действия, чтобы продавец мог вернуться и поправить чекбокс.
 */
export function LicenseConfirmationModal({
  onConfirm,
  onClose,
}: {
  onConfirm: () => void;
  onClose: () => void;
}) {
  useCloseOnBack(onClose);

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

  return (
    <div
      className="fixed inset-0 z-50 grid cursor-pointer place-items-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Проверка стоимости лицензии"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm cursor-auto rounded-2xl border border-border bg-surface p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="font-semibold">
            Проверь, верно ли выбрана стоимость лицензии в соответствии с
            регионом
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-muted transition hover:bg-border/60 hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <p className="mb-4 text-xs text-muted">
          Москва+МО, Санкт-Петербург+ЛО и компании входящие в топ-3 своего
          региона, считаются с повышенной стоимостью лицензии (Enterprise
          лицензия).
        </p>

        <button
          type="button"
          onClick={onConfirm}
          className={buttonClasses("primary")}
        >
          Стоимость верна
        </button>
      </div>
    </div>
  );
}
