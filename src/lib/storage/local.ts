import "server-only";

import { createReadStream } from "node:fs";
import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import type { StorageDriver } from "./types";

export class LocalStorageDriver implements StorageDriver {
  readonly name = "local";
  private readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(process.cwd(), root);
  }

  // Ключи мы генерируем сами, но проверяем всё равно: если однажды сюда
  // просочится ключ из пользовательского ввода, «../../.env» не должен
  // вывести за пределы папки хранилища.
  private resolveKey(key: string): string {
    const full = path.resolve(this.root, key);
    const rel = path.relative(this.root, full);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      throw new Error(`Недопустимый ключ хранилища: ${key}`);
    }
    return full;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const full = this.resolveKey(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
  }

  async get(
    key: string,
    range?: { start: number; end: number },
  ): Promise<Readable> {
    return createReadStream(this.resolveKey(key), range);
  }

  async size(key: string): Promise<number> {
    return (await stat(this.resolveKey(key))).size;
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(this.resolveKey(key));
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.resolveKey(key));
    } catch (e) {
      // Файла и так нет — цель достигнута, это не ошибка.
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  }

  // Диск не умеет раздавать файлы сам — отдаём null, и файл поедет
  // через наш маршрут, где мы проверим токен ссылки.
  async signedUrl(): Promise<string | null> {
    return null;
  }
}
