"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { makeThumbnail } from "@/lib/make-thumbnail";
import { SECTIONS } from "@/lib/asset-sections";
import {
  isUploadSupported,
  SUPPORTED_FORMATS_TEXT,
  UPLOAD_ACCEPT,
} from "@/lib/asset-formats";
import type { AssetSection } from "@/generated/prisma/enums";
import { buttonClasses } from "@/components/ui/button";

type QueueItem = {
  id: string;
  name: string;
  progress: number;
  status: "waiting" | "preparing" | "uploading" | "done" | "error";
  error?: string;
};

// Загружаем по одному файлу за раз. Параллельная отправка десятка видео
// забила бы канал и сделала полоски прогресса бессмысленными.
function uploadOne(
  file: File,
  thumbnail: Blob | null,
  section: AssetSection,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const body = new FormData();
    body.append("file", file);
    body.append("section", section);
    if (thumbnail) body.append("thumbnail", thumbnail, "thumb.jpg");

    // Здесь XMLHttpRequest, а не fetch: только он умеет сообщать,
    // сколько процентов файла уже ушло.
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/assets/upload");

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

export function AssetUploader({
  /** Раздел открытой страницы. На «Всех материалах» его нет — тогда «Общие». */
  defaultSection,
}: {
  defaultSection: AssetSection | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [section, setSection] = useState<AssetSection>(
    defaultSection ?? "COMMON",
  );

  const update = (id: string, patch: Partial<QueueItem>) =>
    setQueue((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;

    // crypto.randomUUID() требует "secure context" (https или localhost) —
    // на голом http (наш прод без домена/TLS) браузер его не даёт, и вызов
    // падал синхронно ДО setQueue: файл выглядел так, будто просто исчезал.
    // Тут не нужна криптостойкость, только уникальность внутри вкладки.
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

    for (const [index, file] of Array.from(files).entries()) {
      const item = items[index];

      // Проверяем ДО превью и отправки — не тратим время на файл, который
      // сервер всё равно отклонит (та же проверка в api/assets/upload/route.ts,
      // это лишь чтобы не гонять байты впустую и показать ошибку сразу).
      if (!isUploadSupported(file.type, file.name)) {
        update(item.id, {
          status: "error",
          error: `Формат не поддерживается — вьювер и превью для него нет. Загружайте: ${SUPPORTED_FORMATS_TEXT}.`,
        });
        continue;
      }

      try {
        // Превью рисуем до отправки: сервер получит готовую картинку
        // и ему не понадобятся графические библиотеки.
        update(item.id, { status: "preparing" });
        const thumbnail = await makeThumbnail(file);

        update(item.id, { status: "uploading" });
        await uploadOne(file, thumbnail, section, (p) =>
          update(item.id, { progress: p }),
        );
        update(item.id, { status: "done", progress: 100 });
      } catch (e) {
        update(item.id, {
          status: "error",
          error: e instanceof Error ? e.message : "Не удалось загрузить.",
        });
      }
    }

    // Список материалов рисуется на сервере — просим его перечитать базу.
    router.refresh();
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

        {/* Раздел выбирается ДО загрузки: так не приходится потом искать
            свежий файл среди всей библиотеки и перекладывать его. */}
        <label className="mt-4 flex items-center justify-center gap-2 text-sm">
          <span className="text-muted">В раздел</span>
          <select
            value={section}
            onChange={(e) => setSection(e.target.value as AssetSection)}
            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm pointer-coarse:min-h-11"
          >
            {SECTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

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
            // Обнуляем, иначе повторный выбор того же файла не вызовет событие.
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
    </div>
  );
}
