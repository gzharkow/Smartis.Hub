"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { deleteHubFolder, renameHubFolder } from "@/app/actions/hub-folders";
import { withPlural, WORDS } from "@/lib/plural";
import type { ViewMode } from "@/lib/view-mode";
import { FolderColorPicker } from "./folder-color-picker";
import { buttonClasses } from "@/components/ui/button";

export type FolderRowData = {
  id: string;
  name: string;
  hubCount: number;
  color: string | null;
};

// Силуэт папки для режима плитки: один замкнутый контур с «язычком» слева
// сверху. У навигационной ссылки-оверлея тот же clip-path — иначе можно было
// бы кликнуть мимо видимого силуэта (в вырезе рядом с язычком) и всё равно
// попасть в папку.
const FOLDER_CLIP_PATH =
  "polygon(6% 0%, 40% 0%, 46% 10%, 100% 10%, 100% 100%, 0% 100%, 0% 10%)";

export function FolderRow({
  folder,
  view = "list",
  canEdit = true,
}: {
  folder: FolderRowData;
  view?: ViewMode;
  /** Право «Изменение» на «Хабы → Папки» — см. hubs/folders/page.tsx. */
  canEdit?: boolean;
}) {
  const [mode, setMode] = useState<"view" | "rename" | "confirm">("view");
  const [name, setName] = useState(folder.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const grid = view === "grid";

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await renameHubFolder(folder.id, name);
        setMode("view");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось переименовать.");
      }
    });
  }

  // Карточка сама — растянутая ссылка (см. overlayLink ниже), поэтому имя —
  // просто текст, а не второй <a> на тот же адрес. Ссылку в режиме
  // переименования не показываем: клик по карточке не должен сбрасывать
  // незавершённое редактирование.
  const nameEl =
    mode === "rename" ? (
      <input
        autoFocus
        value={name}
        maxLength={60}
        disabled={pending}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") {
            setName(folder.name);
            setMode("view");
          }
        }}
        className={`relative z-20 rounded-lg border border-border bg-background px-2 py-1 text-sm focus:border-accent ${
          grid ? "w-full" : "min-w-0 flex-1 basis-full sm:basis-auto"
        }`}
      />
    ) : (
      <span
        // basis-full — на телефоне название занимает свою строку целиком,
        // счётчик и кнопки уходят вниз, иначе имя обрезалось бы почти
        // сразу же, даже у коротких названий.
        className={`truncate font-medium transition group-hover:text-accent ${
          grid ? "" : "min-w-0 flex-1 basis-full sm:basis-auto"
        }`}
      >
        {folder.name}
      </span>
    );

  // Растянутая ссылка: сосед остального содержимого, а не обёртка вокруг
  // него — внутри карточки есть настоящие интерактивные элементы (кнопки,
  // поле ввода), а <button>/<input> внутри <a> невалидны и не работают
  // предсказуемо. Порядок z-index по всей карточке: 0 (фигура/заливка,
  // плитка) < 10 (эта ссылка) < 20 (действия) < 30 (шестерёнка/попап цвета).
  const overlayLink =
    mode === "view" ? (
      <Link
        href={`/hubs/folders/${folder.id}`}
        aria-label={folder.name}
        className="absolute inset-0 z-10"
        style={grid ? { clipPath: FOLDER_CLIP_PATH } : undefined}
      />
    ) : null;

  const errorEl = error ? (
    <span className="relative text-xs text-danger">{error}</span>
  ) : null;

  const countEl = (
    <span className="relative shrink-0 text-sm text-muted">
      {withPlural(folder.hubCount, WORDS.hub)}
    </span>
  );

  const actions =
    mode === "rename" ? (
        <>
          <button
            type="button"
            disabled={pending}
            onClick={save}
            className={buttonClasses("link", "sm", "shrink-0")}
          >
            {pending ? "…" : "Сохранить"}
          </button>
          <button
            type="button"
            onClick={() => {
              setName(folder.name);
              setError(null);
              setMode("view");
            }}
            className={buttonClasses("ghost", "sm", "shrink-0")}
          >
            Отмена
          </button>
        </>
      ) : mode === "confirm" ? (
        // Папка ничем не владеет, поэтому предупреждение мягкое: хабы никуда
        // не денутся, просто окажутся вне папок.
        <>
          <span className="text-xs text-muted">
            {folder.hubCount > 0
              ? "Хабы останутся, но окажутся без папки"
              : "Удалить папку?"}
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => deleteHubFolder(folder.id))}
            className={buttonClasses("danger", "sm", "shrink-0")}
          >
            {pending ? "…" : "Удалить"}
          </button>
          <button
            type="button"
            onClick={() => setMode("view")}
            className={buttonClasses("ghost", "sm", "shrink-0")}
          >
            Отмена
          </button>
        </>
      ) : canEdit ? (
        <>
          <button
            type="button"
            onClick={() => setMode("rename")}
            className={buttonClasses("ghost", "sm", "shrink-0")}
          >
            Переименовать
          </button>
          <button
            type="button"
            onClick={() => setMode("confirm")}
            className={buttonClasses("ghostDanger", "sm", "shrink-0")}
          >
            Удалить
          </button>
        </>
      ) : null;

  if (grid) {
    const tint = folder.color ? `${folder.color}20` : "var(--surface)";
    const accent = folder.color ?? "var(--border)";
    const showGear = canEdit && mode === "view";

    return (
      <li className="group relative flex h-full flex-col gap-2 px-4 py-3">
        {/* Форма и цвет — отдельный слой позади содержимого (отрицательный
            z-index), а не сам <li>: overflow-hidden на карточке сломал бы
            попап выбора цвета, которому нужно выходить за её пределы. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 border"
          style={{ clipPath: FOLDER_CLIP_PATH, backgroundColor: tint, borderColor: accent }}
        />
        {overlayLink}
        {showGear ? (
          <FolderColorPicker
            folderId={folder.id}
            color={folder.color}
            className="absolute top-2 right-2 z-30"
          />
        ) : null}
        <div className="relative mt-2 mr-7">{nameEl}</div>
        {errorEl}
        {countEl}
        <div className="relative z-20 mt-auto flex flex-wrap items-center gap-2 pt-1">
          {actions}
        </div>
      </li>
    );
  }

  return (
    <li className="group relative flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
      {overlayLink}
      {nameEl}
      {errorEl}
      {countEl}
      <div className="relative z-20 flex flex-wrap items-center gap-2">
        {actions}
      </div>
    </li>
  );
}
