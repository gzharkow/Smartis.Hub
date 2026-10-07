"use client";

import { useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  archiveAsset,
  deleteAssetPermanently,
  getAssetHubUsage,
  renameAsset,
  restoreAsset,
} from "@/app/actions/assets";
import { backfillThumbnail } from "@/lib/backfill-thumbnail";
import { formatHubCreated } from "@/lib/format-datetime";
import { makeThumbnail } from "@/lib/make-thumbnail";
import { isUploadSupported, SUPPORTED_FORMATS_TEXT, UPLOAD_ACCEPT } from "@/lib/asset-formats";
import { withPlural, WORDS } from "@/lib/plural";
import type { ViewMode } from "@/lib/view-mode";
import type { AssetKind } from "@/generated/prisma/enums";
import { buttonClasses } from "@/components/ui/button";
import { iconButtonClasses } from "@/components/ui/icon-button";
import { ValidationPromptModal } from "./validation-prompt-modal";

// Просмотрщики (PDF, Word, Excel) тяжёлые, а нужны только по клику: грузим
// их отдельным куском, чтобы список материалов открывался быстрее.
const AssetPreviewModal = dynamic(() =>
  import("@/components/asset-preview-modal").then((m) => m.AssetPreviewModal),
);

// Та же XHR-загрузка с прогрессом, что и в asset-row.tsx — «Заменить файл»
// работает для личной библиотеки идентично общей (тот же маршрут).
function uploadReplacement(
  assetId: string,
  file: File,
  thumbnail: Blob | null,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const body = new FormData();
    body.append("file", file);
    if (thumbnail) body.append("thumbnail", thumbnail, "thumb.jpg");

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/assets/${assetId}/replace`);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      let message = `Ошибка ${xhr.status}`;
      try {
        message = JSON.parse(xhr.responseText).error ?? message;
      } catch {
        // Ответ не разобрался — покажем код статуса.
      }
      reject(new Error(message));
    });

    xhr.addEventListener("error", () =>
      reject(new Error("Не удалось связаться с сервером.")),
    );

    xhr.send(body);
  });
}

export type PersonalAssetRowData = {
  id: string;
  title: string;
  kind: AssetKind;
  kindLabel: string;
  meta: string;
  pageCount: number | null;
  updatedAt: Date;
  hubCount: number;
  archived: boolean;
  hasThumbnail: boolean;
  canThumbnail: boolean;
  /** Право менять именно этот материал — владелец либо ADMIN (см. canManagePersonalAsset). */
  canEdit: boolean;
  /** validatedAt !== null — подтверждён и доступен для добавления в хабы. */
  validated: boolean;
};

export function PersonalAssetRow({
  asset,
  view = "list",
}: {
  asset: PersonalAssetRowData;
  view?: ViewMode;
}) {
  const canEdit = asset.canEdit;
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [thumbing, setThumbing] = useState(false);
  const [thumbError, setThumbError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [previewing, setPreviewing] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  const [replacing, setReplacing] = useState(false);
  const [replaceProgress, setReplaceProgress] = useState(0);
  const [replaceError, setReplaceError] = useState<string | null>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  async function handleReplace(file: File | undefined) {
    if (!file) return;
    if (!isUploadSupported(file.type, file.name)) {
      setReplaceError(
        `Формат не поддерживается. Загружайте: ${SUPPORTED_FORMATS_TEXT}.`,
      );
      return;
    }
    setReplaceError(null);
    setReplacing(true);
    setReplaceProgress(0);
    try {
      const thumbnail = await makeThumbnail(file);
      await uploadReplacement(asset.id, file, thumbnail, setReplaceProgress);
      router.refresh();
    } catch (e) {
      setReplaceError(e instanceof Error ? e.message : "Не удалось заменить файл.");
    } finally {
      setReplacing(false);
    }
  }

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [hubUsage, setHubUsage] = useState<{ hubId: string; hubTitle: string }[] | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);

  async function startConfirmingDelete() {
    setConfirmingDelete(true);
    setLoadingUsage(true);
    try {
      setHubUsage(await getAssetHubUsage(asset.id));
    } finally {
      setLoadingUsage(false);
    }
  }

  const [renaming, setRenaming] = useState(false);
  const [, startRename] = useTransition();

  function submitRename(value: string) {
    const next = value.trim();
    setRenaming(false);
    if (next && next !== asset.title) {
      startRename(() => renameAsset(asset.id, next));
    }
  }

  const titleInput = (
    <input
      autoFocus
      defaultValue={asset.title}
      maxLength={200}
      onBlur={(e) => submitRename(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          e.currentTarget.value = asset.title;
          setRenaming(false);
        }
      }}
      className="min-w-0 flex-1 rounded-md border border-accent bg-background px-1.5 py-0.5 text-sm"
    />
  );

  const renameBtn = canEdit && !asset.archived ? (
    <button
      type="button"
      title="Переименовать"
      onClick={() => setRenaming(true)}
      className={iconButtonClasses("muted", "shrink-0")}
    >
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="size-3.5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14.5 3.5a1.5 1.5 0 0 1 2 2L7 15l-3 1 1-3 9.5-9.5Z"
        />
      </svg>
    </button>
  ) : null;

  const grid = view === "grid";

  const kindBadge = (
    <span className="shrink-0 rounded-md bg-border/70 px-2 py-0.5 text-xs font-medium">
      {asset.kindLabel}
    </span>
  );

  // Пока не подтверждён — материал нельзя добавить в хаб (проверяется и на
  // сервере, см. addItemToHub в actions/hubs.ts). Кнопка открывает тот же
  // попап, что и сразу после загрузки.
  const validationBadge = !asset.archived && !asset.validated ? (
    <span
      className="shrink-0 rounded bg-warn/15 px-1.5 py-0.5 text-xs text-warn"
      title="Пока не подтверждён — недоступен для добавления в хабы"
    >
      Не проверен
    </span>
  ) : null;

  const validateBtn =
    canEdit && !asset.archived && !asset.validated ? (
      <button
        type="button"
        onClick={() => setShowValidation(true)}
        className={buttonClasses("link", "sm", "shrink-0")}
      >
        Валидировать
      </button>
    ) : null;

  const thumbErrorEl = thumbError ? (
    <span className="shrink-0 text-xs text-danger">{thumbError}</span>
  ) : null;

  const makePreviewBtn =
    canEdit && !asset.archived && !asset.hasThumbnail && asset.canThumbnail ? (
      <button
        type="button"
        disabled={thumbing}
        onClick={async () => {
          setThumbing(true);
          setThumbError(null);
          const error = await backfillThumbnail(asset.id);
          setThumbing(false);
          if (error) setThumbError(error);
          else router.refresh();
        }}
        className={buttonClasses("link", "sm", "shrink-0")}
      >
        {thumbing ? "Готовим…" : "Сделать превью"}
      </button>
    ) : null;

  const replaceBtn =
    canEdit && !asset.archived ? (
      <>
        <button
          type="button"
          disabled={replacing}
          onClick={() => replaceInputRef.current?.click()}
          className={buttonClasses("link", "sm", "shrink-0")}
        >
          {replacing ? `Заменяем… ${replaceProgress}%` : "Заменить файл"}
        </button>
        <input
          ref={replaceInputRef}
          type="file"
          accept={UPLOAD_ACCEPT}
          className="hidden"
          onChange={(e) => {
            void handleReplace(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </>
    ) : null;

  const replaceErrorEl = replaceError ? (
    <span className="shrink-0 text-xs text-danger">{replaceError}</span>
  ) : null;

  const actionCluster = !canEdit ? null : asset.archived ? (
    confirmingDelete ? (
      <span className="flex shrink-0 flex-wrap items-center gap-2">
        <span className="text-xs text-muted">
          {loadingUsage
            ? "Проверяем хабы…"
            : hubUsage && hubUsage.length > 0
              ? `Будет удалён из хабов: ${hubUsage.map((h) => h.hubTitle).join(", ")}`
              : "Удалить навсегда?"}
        </span>
        <button
          type="button"
          disabled={pending || loadingUsage}
          onClick={() => startTransition(() => deleteAssetPermanently(asset.id))}
          className={buttonClasses("danger", "sm")}
        >
          {pending ? "…" : "Удалить навсегда"}
        </button>
        <button
          type="button"
          onClick={() => setConfirmingDelete(false)}
          className={buttonClasses("ghost", "sm")}
        >
          Отмена
        </button>
      </span>
    ) : (
      <span className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => restoreAsset(asset.id))}
          className={buttonClasses("link", "sm", "shrink-0")}
        >
          {pending ? "…" : "Восстановить"}
        </button>
        <button
          type="button"
          onClick={startConfirmingDelete}
          className={buttonClasses("ghostDanger", "sm", "shrink-0")}
        >
          Удалить навсегда
        </button>
      </span>
    )
  ) : confirming ? (
    <span className="flex shrink-0 items-center gap-2">
      <span className="text-xs text-muted">
        {asset.hubCount > 0
          ? `Стоит в ${withPlural(asset.hubCount, WORDS.hubIn)} — пропадёт у клиентов`
          : "Удалить?"}
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => archiveAsset(asset.id))}
        className={buttonClasses("danger", "sm")}
      >
        {pending ? "…" : "Удалить"}
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
  );

  const previewModal = previewing ? (
    <AssetPreviewModal
      asset={{
        id: asset.id,
        title: asset.title,
        kind: asset.kind,
        externalUrl: null,
        embeddable: null,
        pageCount: asset.pageCount,
      }}
      onClose={() => setPreviewing(false)}
    />
  ) : null;

  const validationModal = showValidation ? (
    <ValidationPromptModal
      assetIds={[asset.id]}
      onClose={() => setShowValidation(false)}
    />
  ) : null;

  if (grid) {
    return (
      <li
        className={`flex h-full flex-col overflow-hidden rounded-xl border border-border ${
          asset.archived ? "opacity-60" : "bg-surface"
        }`}
      >
        <button
          type="button"
          onClick={() => setPreviewing(true)}
          title="Открыть предпросмотр"
          className="block w-full cursor-zoom-in"
        >
          {asset.hasThumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/assets/${asset.id}/thumbnail?v=${asset.updatedAt.getTime()}`}
              loading="lazy"
              decoding="async"
              alt=""
              className="aspect-[16/10] w-full border-b border-border object-cover object-top"
            />
          ) : (
            <span className="grid aspect-[16/10] w-full place-items-center border-b border-dashed border-border text-xs text-muted">
              без превью
            </span>
          )}
        </button>

        <div className="flex flex-1 flex-col gap-2 p-3">
          <div className="flex flex-wrap items-center gap-2">
            {kindBadge}
            {validationBadge}
          </div>

          {renaming ? (
            <div className="flex items-center gap-1">{titleInput}</div>
          ) : (
            <div className="flex items-start gap-1">
              <span className="line-clamp-2 min-w-0 flex-1 font-medium">
                {asset.title}
              </span>
              {renameBtn}
            </div>
          )}

          {asset.meta ? (
            <span className="text-xs text-muted">{asset.meta}</span>
          ) : null}

          <span className="text-xs text-muted">Изменён {formatHubCreated(asset.updatedAt)}</span>

          {thumbErrorEl}
          {replaceErrorEl}

          <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
            {validateBtn}
            {makePreviewBtn}
            {replaceBtn}
            {actionCluster}
          </div>
        </div>

        {previewModal}
        {validationModal}
      </li>
    );
  }

  return (
    <li
      className={`flex flex-wrap items-center gap-3 rounded-xl border border-border px-3 py-2.5 ${
        asset.archived ? "opacity-60" : "bg-surface"
      }`}
    >
      <button
        type="button"
        onClick={() => setPreviewing(true)}
        title="Открыть предпросмотр"
        className="block shrink-0 cursor-zoom-in"
      >
        {asset.hasThumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/assets/${asset.id}/thumbnail?v=${asset.updatedAt.getTime()}`}
              loading="lazy"
              decoding="async"
            alt=""
            className="h-11 w-16 rounded border border-border object-cover object-top"
          />
        ) : (
          <span className="grid h-11 w-16 place-items-center rounded border border-dashed border-border text-[10px] text-muted">
            нет
          </span>
        )}
      </button>

      {kindBadge}

      {renaming ? (
        <div className="flex min-w-40 flex-1 items-center gap-1">
          {titleInput}
        </div>
      ) : (
        <div className="flex min-w-40 flex-1 items-center gap-1">
          <span className="min-w-0 flex-1 truncate font-medium">
            {asset.title}
          </span>
          {renameBtn}
        </div>
      )}

      {validationBadge}

      <span className="shrink-0 text-sm text-muted">{asset.meta}</span>
      <span className="hidden shrink-0 text-xs text-muted sm:inline">
        Изменён {formatHubCreated(asset.updatedAt)}
      </span>

      {thumbErrorEl}
      {replaceErrorEl}
      {validateBtn}
      {makePreviewBtn}
      {replaceBtn}
      {actionCluster}

      {previewModal}
      {validationModal}
    </li>
  );
}
