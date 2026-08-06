"use client";

import { useTransition } from "react";
import { setHubFolder } from "@/app/actions/hubs";

/**
 * Выбор папки для хаба. Сохраняется сразу, без кнопки: это одно значение,
 * и подтверждать его отдельным нажатием незачем.
 */
export function HubFolderPicker({
  hubId,
  folderId,
  folders,
}: {
  hubId: string;
  folderId: string | null;
  folders: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      Папка
      <select
        value={folderId ?? ""}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          startTransition(() => setHubFolder(hubId, next));
        }}
        className="rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground disabled:opacity-50"
      >
        <option value="">Без папки</option>
        {folders.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
      {folders.length === 0 ? (
        <span className="text-xs">— папок пока нет, заведите в «Папках»</span>
      ) : null}
    </label>
  );
}
