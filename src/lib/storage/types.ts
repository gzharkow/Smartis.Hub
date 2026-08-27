import type { Readable } from "node:stream";

// Единственное место, которое знает, ГДЕ физически лежат файлы.
// Весь остальной код работает с ключом (строкой) и не догадывается,
// диск это или облако. Отсюда и переезд на S3 без переписывания.

export interface StorageDriver {
  readonly name: string;

  put(key: string, data: Buffer, contentType: string): Promise<void>;

  /** Поток на чтение. Диапазон нужен для перемотки видео. */
  get(key: string, range?: { start: number; end: number }): Promise<Readable>;

  size(key: string): Promise<number>;

  exists(key: string): Promise<boolean>;

  delete(key: string): Promise<void>;

  /**
   * Временная прямая ссылка на файл, если хранилище так умеет.
   * Локальный диск не умеет — вернёт null, и тогда файл поедет
   * через наш маршрут. У S3 будет ссылка с коротким сроком жизни.
   *
   * Постоянных прямых ссылок не выдаём НИКОГДА: иначе ссылка утечёт
   * в обход трекинга, а отзыв доступа перестанет работать.
   */
  signedUrl(key: string, ttlSeconds: number): Promise<string | null>;
}

/** Ключи собираем только здесь, чтобы раскладка файлов была в одном месте. */
export const storageKeys = {
  original: (orgId: string, assetId: string, ext: string) =>
    `assets/${orgId}/${assetId}/original${ext}`,
  // ext по умолчанию .jpg — превью файлов рисует браузер и всегда шлёт JPEG.
  // Для ссылок превью — это og:image сайта, он бывает png/webp/gif.
  thumbnail: (orgId: string, assetId: string, ext = ".jpg") =>
    `assets/${orgId}/${assetId}/thumb${ext}`,
  hubCover: (orgId: string, hubId: string, ext: string) =>
    `hubs/${orgId}/${hubId}/cover${ext}`,
  orgLogo: (orgId: string, ext: string) => `orgs/${orgId}/logo${ext}`,
  // Шаблоны Спецификации всегда .docx — расширение не параметр: файл другого
  // формата до хранилища не доходит, его отбивает загрузчик.
  specTemplate: (orgId: string, templateId: string) =>
    `spec-templates/${orgId}/${templateId}.docx`,
};
