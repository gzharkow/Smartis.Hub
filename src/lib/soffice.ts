import "server-only";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";

// Точный предпросмотр Спецификации: docx → pdf через headless LibreOffice.
//
// Приблизительный рендер через mammoth не годится — продавец смотрит на
// предпросмотр, чтобы решить, отправлять ли документ клиенту, и вёрстка
// таблиц договора в HTML-приближении разъезжается. LibreOffice даёт то же,
// что покажет Word.
//
// Его может не быть: на машине разработки под Windows и на свежем сервере
// он не стоит. Тогда фича продолжает работать — просто без предпросмотра,
// см. isSofficeAvailable().

const run = promisify(execFile);

const DEFAULT_TIMEOUT_MS = 45_000;

/** Сколько конвертаций держим одновременно. LibreOffice съедает 200–300 МБ на
 * процесс, а сервер один — параллелить нечего. */
const MAX_QUEUE = 4;

export function sofficeBinary(): string {
  if (process.env.SOFFICE_PATH) return process.env.SOFFICE_PATH;
  // Именно soffice.com, а не .exe: .exe отсоединяется от консоли и возвращает
  // управление раньше, чем PDF появится на диске, и мы читаем пустоту.
  return process.platform === "win32"
    ? "C:\\Program Files\\LibreOffice\\program\\soffice.com"
    : "soffice";
}

let availability: Promise<boolean> | null = null;

/** Есть ли LibreOffice. Результат кэшируется на процесс: проверка стоит
 * секунду, а ответ за время жизни процесса не меняется. */
export function isSofficeAvailable(): Promise<boolean> {
  availability ??= run(sofficeBinary(), ["--version"], { timeout: 10_000, windowsHide: true })
    .then(() => true)
    .catch(() => false);
  return availability;
}

export class SofficeBusyError extends Error {
  constructor() {
    super("Предпросмотр занят — попробуйте через несколько секунд.");
    this.name = "SofficeBusyError";
  }
}

export class SofficeMissingError extends Error {
  constructor() {
    super("На сервере не установлен LibreOffice — точный предпросмотр недоступен.");
    this.name = "SofficeMissingError";
  }
}

let queue: Promise<unknown> = Promise.resolve();
let waiting = 0;

/** Конвертирует .docx в PDF. Бросает SofficeMissingError, если LibreOffice
 * не установлен, и SofficeBusyError, если очередь переполнена. */
export async function docxToPdf(docx: Buffer, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Buffer> {
  if (!(await isSofficeAvailable())) throw new SofficeMissingError();
  if (waiting >= MAX_QUEUE) throw new SofficeBusyError();

  waiting += 1;
  const task = queue.then(() => convert(docx, timeoutMs));
  // Очередь не должна рваться из-за упавшей задачи — следующая всё равно
  // обязана запуститься.
  queue = task.catch(() => {});
  try {
    return await task;
  } finally {
    waiting -= 1;
  }
}

async function convert(docx: Buffer, timeoutMs: number): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpRoot(), "sf-spec-"));
  const input = path.join(dir, "spec.docx");
  const output = path.join(dir, "spec.pdf");

  try {
    await writeFile(input, docx);
    await run(
      sofficeBinary(),
      [
        "--headless",
        "--invisible",
        "--norestore",
        "--nolockcheck",
        "--nodefault",
        "--nofirststartwizard",
        // Свой профиль на каждый вызов. Без него параллельные запуски
        // натыкаются на общий каталог настроек, и второй процесс молча
        // завершается с «soffice is already running».
        `-env:UserInstallation=${pathToFileUrl(path.join(dir, "profile"))}`,
        "--convert-to",
        "pdf",
        "--outdir",
        dir,
        input,
      ],
      { timeout: timeoutMs, killSignal: "SIGKILL", windowsHide: true },
    );

    return await readFile(output);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(`LibreOffice не смог собрать предпросмотр: ${detail}`);
  } finally {
    // Уборка не должна валить запрос: файл уже прочитан.
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** На проде systemd-юнит закрывает /tmp на запись (ProtectSystem=strict),
 * поэтому каталог можно переопределить переменной окружения. */
function tmpRoot(): string {
  return process.env.SPEC_TMP_DIR ?? os.tmpdir();
}

function pathToFileUrl(target: string): string {
  return `file://${target.replace(/\\/g, "/").replace(/^([A-Za-z]:)/, "/$1")}`;
}
