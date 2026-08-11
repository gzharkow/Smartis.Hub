"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { updateHubFolderColor } from "@/app/actions/hub-folders";
import { FOLDER_COLOR_PRESETS } from "@/lib/folder-colors";
import { SettingsIcon } from "../../nav-icons";

/** Шестерёнка в углу плитки папки — открывает попап выбора цвета. */
export function FolderColorPicker({
  folderId,
  color,
  className,
}: {
  folderId: string;
  color: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  function pick(value: string | null) {
    startTransition(() => updateHubFolderColor(folderId, value));
    setOpen(false);
  }

  return (
    <div ref={boxRef} className={className}>
      <button
        type="button"
        aria-label="Цвет папки"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className="grid size-7 place-items-center rounded-md text-muted transition hover:bg-black/10 hover:text-foreground disabled:opacity-50 dark:hover:bg-white/10"
      >
        <SettingsIcon />
      </button>

      {open ? (
        <div className="absolute top-full right-0 z-10 mt-1 w-40 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-background p-2 shadow-lg">
          <div className="grid grid-cols-4 gap-1.5">
            {FOLDER_COLOR_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                aria-label={preset.label}
                disabled={pending}
                onClick={() => pick(preset.value)}
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
            onClick={() => pick(null)}
            className="mt-2 w-full rounded px-2 py-1 text-left text-xs text-muted transition hover:bg-black/10 disabled:opacity-50 dark:hover:bg-white/10"
          >
            Без цвета
          </button>
        </div>
      ) : null}
    </div>
  );
}
