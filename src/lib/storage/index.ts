import "server-only";

import { LocalStorageDriver } from "./local";
import type { StorageDriver } from "./types";

export * from "./types";

// Единственное место, где решается, куда кладутся файлы.
// Сейчас драйвер один; когда появится S3 — добавится ветка,
// а весь остальной код об этом не узнает.
function createDriver(): StorageDriver {
  const kind = process.env.STORAGE_DRIVER ?? "local";

  switch (kind) {
    case "local":
      return new LocalStorageDriver(process.env.STORAGE_LOCAL_PATH ?? "./storage");
    default:
      throw new Error(
        `Неизвестный STORAGE_DRIVER: "${kind}". Допустимо: local. Проверь .env.`,
      );
  }
}

const globalForStorage = globalThis as unknown as {
  storage: StorageDriver | undefined;
};

export const storage = globalForStorage.storage ?? createDriver();

if (process.env.NODE_ENV !== "production") {
  globalForStorage.storage = storage;
}
