"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { makeThumbnail } from "@/lib/make-thumbnail";
import {
  isUploadSupported,
  SUPPORTED_FORMATS_TEXT,
  UPLOAD_ACCEPT,
} from "@/lib/asset-formats";
import { buttonClasses } from "@/components/ui/button";
import { ValidationPromptModal } from "./validation-prompt-modal";

type QueueItem = {
  id: string;
  name: string;
  progress: number;
  status: "waiting" | "preparing" | "uploading" | "done" | "error";
  error?: string;
};

// Тот же приём, что в asset-uploader.tsx: XMLHttpRequest вместо fetch —
// только он умеет сообщать процент отправки. target=mine вместо раздела:
// личные материалы не привязаны к AssetSection (см. schema.prisma).
function uploadOne(
  file: File,
  thumbnail: Blob | null,
  onProgress: (percent: number) => void,
): Promise<{ id: string }> {
  return new Promise((resolve, reject) => {
    const body = new FormData();
    body.append("file", file);
    body.append("target", "mine");
    if (thumbnail) body.append("thumbnail", thumbnail, "thumb.jpg");

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/assets/upload");

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error("Не удалось разобрать ответ сервера."));
        }
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

/**
 * Загрузчик личной библиотеки («Мои материалы»). В отличие от общей
 * библиотеки (asset-uploader.tsx) — без выбора раздела и без гейта по
 * canAddMaterials: личная библиотека доступна любому, кто видит раздел
 * «Материалы» вообще (см. permissions.ts). После завершения всей пачки —
 * один попап «Файл(ы) валидирован(ы) с руководством?» на все успешно
 * загруженные файлы разом (решение владельца — не по одному на файл).
 */
export function PersonalAssetUploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [pendingValidation, setPendingValidation] = useState<string[]>([]);

  const update = (id: string, patch: Partial<QueueItem>) =>
    setQueue((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;

    const makeId = () =>
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

    const items: QueueItem[] = Array.from(files).map((f) => ({
      id: makeId(),
      name: f.name,
      progress: 0,
      status: "waiting",
    }));

    setQueue((prev) => [...prev, ...items]);

    const uploadedIds: string[] = [];

    for (const [index, file] of Array.from(files).entries()) {
      const item = items[index];

      if (!isUploadSupported(file.type, file.name)) {
        update(item.id, {
          status: "error",
          error: `Формат не поддерживается — вьювер и превью для него нет. Загружайте: ${SUPPORTED_FORMATS_TEXT}.`,
        });
        continue;
      }

      try {
        update(item.id, { status: "preparing" });
        const thumbnail = await makeThumbnail(file);

        update(item.id, { status: "uploading" });
        const { id: assetId } = await uploadOne(file, thumbnail, (p) =>
          update(item.id, { progress: p }),
        );
        uploadedIds.push(assetId);
        update(item.id, { status: "done", progress: 100 });
      } catch (e) {
        update(item.id, {
          status: "error",
          error: e instanceof Error ? e.message : "Не удалось загрузить.",
        });
      }
    }

    router.refresh();

    if (uploadedIds.length > 0) {
      setPendingValidation(uploadedIds);
    }
  }

  return (
    <div className="mb-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={`rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
          dragging
            ? "border-accent bg-accent/5"
            : "border-border hover:border-muted"
        }`}
      >
        <p className="font-medium">Перетащите файлы сюда</p>
        <p className="mt-1 text-sm text-muted">
          Поддерживаемые форматы: {SUPPORTED_FORMATS_TEXT}
        </p>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={buttonClasses("primary", "md", "mt-4")}
        >
          Выбрать файлы
        </button>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={UPLOAD_ACCEPT}
          className="hidden"
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {queue.length > 0 ? (
        <ul className="mt-3 grid grid-cols-1 gap-2">
          {queue.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            >
              <span className="min-w-0 flex-1 truncate">{item.name}</span>

              {item.status === "uploading" ? (
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-24 overflow-hidden rounded-full bg-border">
                    <span
                      className="block h-full bg-accent-fill transition-all"
                      style={{ width: `${item.progress}%` }}
                    />
                  </span>
                  <span className="w-9 text-right text-muted">
                    {item.progress}%
                  </span>
                </span>
              ) : null}

              {item.status === "waiting" ? (
                <span className="text-muted">в очереди</span>
              ) : null}
              {item.status === "preparing" ? (
                <span className="text-muted">готовим превью…</span>
              ) : null}
              {item.status === "done" ? (
                <span className="text-ok">готово</span>
              ) : null}
              {item.status === "error" ? (
                <span className="text-danger">{item.error}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {pendingValidation.length > 0 ? (
        <ValidationPromptModal
          assetIds={pendingValidation}
          onClose={() => setPendingValidation([])}
        />
      ) : null}
    </div>
  );
}
