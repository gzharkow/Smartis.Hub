"use client";

import { useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import {
  archiveAsset,
  backfillLinkThumbnail,
  deleteAssetPermanently,
  getAssetHubUsage,
  renameAsset,
  restoreAsset,
  setAssetSection,
} from "@/app/actions/assets";
import { backfillThumbnail } from "@/lib/backfill-thumbnail";
import { formatHubCreated } from "@/lib/format-datetime";
import { makeThumbnail } from "@/lib/make-thumbnail";
import { SECTIONS } from "@/lib/asset-sections";
import { isUploadSupported, SUPPORTED_FORMATS_TEXT, UPLOAD_ACCEPT } from "@/lib/asset-formats";
import { withPlural, WORDS } from "@/lib/plural";
import type { ViewMode } from "@/lib/view-mode";
import type { AssetKind, AssetSection } from "@/generated/prisma/enums";
import { buttonClasses } from "@/components/ui/button";
import { iconButtonClasses } from "@/components/ui/icon-button";

// Просмотрщики (PDF, Word, Excel) тяжёлые, а нужны только по клику: грузим
// их отдельным куском, чтобы список материалов открывался быстрее.
const AssetPreviewModal = dynamic(() =>
  import("@/components/asset-preview-modal").then((m) => m.AssetPreviewModal),
);

// Та же XHR-загрузка с прогрессом, что и в asset-uploader.tsx (fetch не
// умеет сообщать процент отправки) — здесь на один файл и на другой адрес.
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

export type AssetRowData = {
  id: string;
  title: string;
  kind: AssetKind;
  kindLabel: string;
  section: AssetSection;
  meta: string;
  pageCount: number | null;
  /** Только у ссылок: адрес, на который они ведут. */
  externalUrl: string | null;
  /** Только у ссылок: разрешает ли сайт показывать себя внутри рамки. */
  embeddable: boolean | null;
  /** Ссылка, которую сайт запрещает встраивать: откроется новой вкладкой. */
  opensInNewTab: boolean;
  updatedAt: Date;
  /** В скольких хабах стоит. Нужно предупредить: удаление уберёт его с витрин. */
  hubCount: number;
  archived: boolean;
  hasThumbnail: boolean;
  /** Можно ли для этого типа сделать превью. Для LINK и прочих файлов — нет. */
  canThumbnail: boolean;
  /** Право «Изменение» на раздел, в котором лежит именно этот материал. */
  canEdit: boolean;
};

export function AssetRow({
  asset,
  view = "list",
  autoOpen = false,
}: {
  asset: AssetRowData;
  view?: ViewMode;
  /** Сразу открыть предпросмотр — пришли сюда из общего поиска (?open=id). */
  autoOpen?: boolean;
}) {
  const canEdit = asset.canEdit;
  const router = useRouter();
  const pathname = usePathname();
  const [confirming, setConfirming] = useState(false);
  const [thumbing, setThumbing] = useState(false);
  const [thumbError, setThumbError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [previewing, setPreviewing] = useState(autoOpen);

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

  // Безвозвратное удаление (только из «Удалённых»): сначала показываем, из
  // каких хабов материал пропадёт, и только потом — кнопку подтверждения.
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

  // Отдельный transition от архивации/раздела: переименование не должно
  // блокировать кнопку «Удалить», и наоборот.
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

  // Управляющие элементы собираем один раз и раскладываем по-разному
  // в строке и в плитке — чтобы поведение не разъезжалось между видами.

  const kindBadge = (
    <span className="shrink-0 rounded-md bg-border/70 px-2 py-0.5 text-xs font-medium">
      {asset.kindLabel}
    </span>
  );

  const newTabBadge = asset.opensInNewTab ? (
    <span
      className="shrink-0 rounded bg-warn/15 px-1.5 py-0.5 text-xs text-warn"
      title="Сайт запрещает показывать себя внутри других страниц"
    >
      новой вкладкой
    </span>
  ) : null;

  const sectionSelect = canEdit && !asset.archived ? (
    <select
      value={asset.section}
      disabled={pending}
      title="Раздел библиотеки"
      onChange={(e) => {
        const next = e.target.value;
        startTransition(() => setAssetSection(asset.id, next));
      }}
      className="shrink-0 rounded-md border border-border bg-background px-1.5 py-1 text-xs text-muted pointer-coarse:min-h-11 disabled:opacity-50"
    >
      {SECTIONS.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  ) : null;

  const thumbErrorEl = thumbError ? (
    <span className="shrink-0 text-xs text-danger">
      {thumbError}
    </span>
  ) : null;

  // Кнопка только там, где превью нет, но сделать его можно: у файлов
  // (PDF/видео/картинка) рисует браузер, у ссылок — берём og:image сайта.
  const makePreviewBtn =
    canEdit &&
    !asset.archived &&
    !asset.hasThumbnail &&
    (asset.canThumbnail || asset.externalUrl) ? (
      <button
        type="button"
        disabled={thumbing}
        onClick={async () => {
          setThumbing(true);
          setThumbError(null);
          let error: string | null = null;
          if (asset.externalUrl) {
            try {
              await backfillLinkThumbnail(asset.id);
            } catch (e) {
              error = e instanceof Error ? e.message : "Не удалось.";
            }
          } else {
            error = await backfillThumbnail(asset.id);
          }
          setThumbing(false);
          if (error) setThumbError(error);
          else router.refresh();
        }}
        className={buttonClasses("link", "sm", "shrink-0")}
      >
        {thumbing ? "Готовим…" : "Сделать превью"}
      </button>
    ) : null;

  // Заменить содержимое материала новым файлом — ссылки не имеют файла,
  // их сюда не пускаем. Формат может отличаться от исходного (см.
  // api/assets/[id]/replace/route.ts) — не только «тот же файл поновее».
  const replaceBtn =
    canEdit && !asset.archived && asset.kind !== "LINK" ? (
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
    // Подтверждение прямо в строке, а не окном браузера: окна легко
    // закрываются вслепую, а здесь видно, что именно удаляешь.
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
        externalUrl: asset.externalUrl,
        embeddable: asset.embeddable,
        pageCount: asset.pageCount,
      }}
      onClose={() => {
        setPreviewing(false);
        // Окно открыто по ссылке из поиска — убираем ?open из адреса, иначе
        // обновление страницы открыло бы его снова.
        if (autoOpen) router.replace(pathname, { scroll: false });
      }}
    />
  ) : null;

  // ─── Плитка ───
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
            {newTabBadge}
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

          {asset.externalUrl ? (
            <span className="truncate text-xs text-muted">
              {asset.externalUrl}
            </span>
          ) : null}

          {asset.meta ? (
            <span className="text-xs text-muted">{asset.meta}</span>
          ) : null}

          <span className="text-xs text-muted">Изменён {formatHubCreated(asset.updatedAt)}</span>

          {thumbErrorEl}
          {replaceErrorEl}

          <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
            {sectionSelect}
            {makePreviewBtn}
            {replaceBtn}
            {actionCluster}
          </div>
        </div>

        {previewModal}
      </li>
    );
  }

  // ─── Строка ───
  return (
    <li
      className={`flex flex-wrap items-center gap-3 rounded-xl border border-border px-3 py-2.5 ${
        asset.archived ? "opacity-60" : "bg-surface"
      }`}
    >
      {/* Превью прямо в списке: продавец видит, что увидит клиент. Клик
          открывает полноэкранный предпросмотр — можно свериться перед тем,
          как класть материал в хаб. */}
      <button
        type="button"
        onClick={() => setPreviewing(true)}
        title="Открыть предпросмотр"
        className="block shrink-0 cursor-zoom-in"
      >
        {asset.hasThumbnail ? (
          // Обычный img: файл приватный, оптимизатор Next до него не достанет.
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

      {/* min-w: иначе на узком окне название сжимается до «Сквоз…» и строка
          становится бесполезной. Лучше пусть остальное перенесётся вниз. */}
      {renaming ? (
        <div className="flex min-w-40 flex-1 items-center gap-1">
          {titleInput}
        </div>
      ) : (
        <div className="flex min-w-40 flex-1 items-center gap-1">
          <span className="min-w-0 flex-1 truncate font-medium">
            {asset.title}
            {asset.externalUrl ? (
              <span className="block truncate text-xs font-normal text-muted">
                {asset.externalUrl}
              </span>
            ) : null}
          </span>
          {renameBtn}
        </div>
      )}

      {newTabBadge}

      <span className="shrink-0 text-sm text-muted">{asset.meta}</span>
      <span className="hidden shrink-0 text-xs text-muted sm:inline">
        Изменён {formatHubCreated(asset.updatedAt)}
      </span>

      {sectionSelect}
      {thumbErrorEl}
      {replaceErrorEl}
      {makePreviewBtn}
      {replaceBtn}
      {actionCluster}

      {previewModal}
    </li>
  );
}
