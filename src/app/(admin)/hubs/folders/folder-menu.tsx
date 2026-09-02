"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { deleteHubFolder, updateHubFolderColor } from "@/app/actions/hub-folders";
import { FOLDER_COLOR_PRESETS } from "@/lib/folder-colors";
import { buttonClasses } from "@/components/ui/button";
import { SettingsIcon } from "../../nav-icons";

/**
 * Шестерёнка на плитке/в строке папки — открывает попап с цветом, переиме-
 * нованием и удалением. Раньше это были три разных места (сама шестерёнка
 * только для цвета, отдельные кнопки «Переименовать»/«Удалить» рядом с
 * названием) — теперь одна точка входа, чтобы не занимать место на плитке.
 */
export function FolderMenu({
  folderId,
  color,
  hubCount,
  canEdit,
  onRename,
  className,
}: {
  folderId: string;
  color: string | null;
  hubCount: number;
  canEdit: boolean;
  onRename: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmDelete(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  function pickColor(value: string | null) {
    startTransition(() => updateHubFolderColor(folderId, value));
  }

  return (
    <div ref={boxRef} className={className}>
      <button
        type="button"
        aria-label="Настройки папки"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className="grid size-7 place-items-center rounded-md text-muted transition hover:bg-black/10 hover:text-foreground disabled:opacity-50 dark:hover:bg-white/10"
      >
        <SettingsIcon />
      </button>

      {open ? (
        <div className="absolute top-full right-0 z-10 mt-1 w-44 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-background p-2 text-left shadow-lg">
          {confirmDelete ? (
            <div className="p-1">
              <p className="text-xs text-muted">
                {hubCount > 0
                  ? "Хабы останутся, но окажутся без папки."
                  : "Удалить папку?"}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => startTransition(() => deleteHubFolder(folderId))}
                  className={buttonClasses("dangerSolid", "sm", "flex-1")}
                >
                  {pending ? "…" : "Удалить"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className={buttonClasses("ghost", "sm", "flex-1")}
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-1.5">
                {FOLDER_COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    aria-label={preset.label}
                    disabled={pending}
                    onClick={() => pickColor(preset.value)}
                    className="size-7 rounded-full border border-black/10 transition disabled:opacity-50"
                    style={{
                      backgroundColor: preset.value,
                      boxShadow:
                        color === preset.value
                          ? `0 0 0 2px var(--background), 0 0 0 4px ${preset.value}`
                          : undefined,
                    }}
                  />
                ))}
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => pickColor(null)}
                className="mt-2 w-full rounded px-2 py-1 text-left text-xs text-muted transition hover:bg-black/10 disabled:opacity-50 dark:hover:bg-white/10"
              >
                Без цвета
              </button>

              {canEdit ? (
                <div className="mt-2 border-t border-border pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onRename();
                    }}
                    className="w-full rounded px-2 py-1.5 text-left text-sm transition hover:bg-black/10 dark:hover:bg-white/10"
                  >
                    Переименовать
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="w-full rounded px-2 py-1.5 text-left text-sm text-danger transition hover:bg-black/10 dark:hover:bg-white/10"
                  >
                    Удалить
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
