"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { renameHubFolder } from "@/app/actions/hub-folders";
import { withPlural, WORDS } from "@/lib/plural";
import type { ViewMode } from "@/lib/view-mode";
import { FolderMenu } from "./folder-menu";
import { FolderShape } from "./folder-shape";
import { buttonClasses } from "@/components/ui/button";

export type FolderRowData = {
  id: string;
  name: string;
  hubCount: number;
  color: string | null;
};

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
  // "confirm" больше не отдельный режим карточки — подтверждение удаления
  // теперь живёт внутри попапа шестерёнки (см. FolderMenu), а не в потоке.
  const [mode, setMode] = useState<"view" | "rename">("view");
  const [name, setName] = useState(folder.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const grid = view === "grid";
  const showGear = canEdit && mode === "view";

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
          grid ? "block w-full" : "min-w-0 flex-1 basis-full sm:basis-auto"
        }`}
      >
        {folder.name}
      </span>
    );

  // Растянутая ссылка: сосед остального содержимого, а не обёртка вокруг
  // него — внутри карточки есть настоящие интерактивные элементы (кнопки,
  // поле ввода), а <button>/<input> внутри <a> невалидны и не работают
  // предсказуемо. Порядок z-index по всей карточке: 10 (эта ссылка) < 20
  // (иконка/название/счётчик) < 30 (шестерёнка/попап).
  const overlayLink =
    mode === "view" ? (
      <Link
        href={`/hubs/folders/${folder.id}`}
        aria-label={folder.name}
        className="absolute inset-0 z-10"
      />
    ) : null;

  const errorEl = error ? (
    <span className="relative z-20 text-xs text-danger">{error}</span>
  ) : null;

  const countEl = (
    <span className="relative z-20 shrink-0 text-sm text-muted">
      {withPlural(folder.hubCount, WORDS.hub)}
    </span>
  );

  // Сохранить/Отмена при редактировании названия — единственное, что ещё
  // остаётся кнопками в потоке карточки, всё остальное (цвет, переименовать,
  // удалить) теперь внутри попапа шестерёнки.
  const renameActions =
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
    ) : null;

  if (grid) {
    return (
      <li className="group relative flex flex-col items-center gap-1 px-1 py-2 text-center">
        {overlayLink}
        {/* Иконка — как в Finder/Проводнике: небольшая, по центру, а не
            подложка на всю карточку. Шестерёнка лежит на ней, но видна
            только при наведении/фокусе. */}
        <div className="relative">
          <FolderShape color={folder.color} className="aspect-[5/4] w-20" />
          {showGear ? (
            <FolderMenu
              folderId={folder.id}
              color={folder.color}
              hubCount={folder.hubCount}
              canEdit={canEdit}
              onRename={() => setMode("rename")}
              className="absolute -top-1.5 -right-1.5 z-30 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100"
            />
          ) : null}
        </div>
        <div className="relative z-20 mt-1 w-full">{nameEl}</div>
        {errorEl}
        {countEl}
        {renameActions ? (
          <div className="relative z-20 flex flex-wrap items-center justify-center gap-2 pt-1">
            {renameActions}
          </div>
        ) : null}
      </li>
    );
  }

  return (
    <li className="group relative flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
      {overlayLink}
      <FolderShape color={folder.color} className="aspect-[5/4] w-10 shrink-0" />
      {nameEl}
      {errorEl}
      {countEl}
      {renameActions}
      {showGear ? (
        <FolderMenu
          folderId={folder.id}
          color={folder.color}
          hubCount={folder.hubCount}
          canEdit={canEdit}
          onRename={() => setMode("rename")}
          className="relative z-30 shrink-0"
        />
      ) : null}
    </li>
  );
}
