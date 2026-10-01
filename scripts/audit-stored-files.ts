import "dotenv/config";
import { open, stat, readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../src/lib/db";
import {
  SNIFF_HEAD_BYTES,
  judge,
  refineZip,
  sniffFormat,
  type FileFormat,
  type UploadKind,
} from "../src/lib/file-signature";
import { safeServeHeaders } from "../src/lib/serve-headers";

// ТОЛЬКО ЧТЕНИЕ. Проходит по материалам из базы, открывает их файлы в
// хранилище и сравнивает заявленный тип с тем, что видно по содержимому.
// Ничего не меняет ни в базе, ни на диске. Нужен перед включением проверки
// при загрузке: показывает, какие уже лежащие файлы она бы не пропустила.
//
//   npm run audit:files

const UPLOAD_KINDS = new Set<string>(["PDF", "IMAGE", "VIDEO", "DOCUMENT", "SPREADSHEET"]);
const MAX_ZIP_BYTES = 200 * 1024 * 1024;
const IMAGE_FORMATS = new Set<FileFormat>([
  "jpeg", "png", "gif", "webp", "avif", "heic", "bmp", "ico", "tiff",
]);

const root = path.resolve(process.cwd(), process.env.STORAGE_LOCAL_PATH ?? "./storage");

function resolveKey(key: string): string | null {
  const full = path.resolve(root, key);
  const rel = path.relative(root, full);
  return rel.startsWith("..") || path.isAbsolute(rel) ? null : full;
}

type Sniffed = { format: FileFormat } | { missing: true } | { error: string };

async function sniffKey(key: string): Promise<Sniffed> {
  const full = resolveKey(key);
  if (!full) return { error: "ключ вне хранилища" };

  let size: number;
  try {
    size = (await stat(full)).size;
  } catch {
    return { missing: true };
  }

  const handle = await open(full, "r");
  try {
    const head = Buffer.alloc(Math.min(size, SNIFF_HEAD_BYTES));
    await handle.read(head, 0, head.length, 0);
    let format = sniffFormat(head);
    if (format === "zip" && size <= MAX_ZIP_BYTES) {
      format = await refineZip(await readFile(full));
    }
    return { format };
  } finally {
    await handle.close();
  }
}

const norm = (m: string | null | undefined) => (m ?? "").toLowerCase().split(";")[0]!.trim();

async function main() {
  console.log(`Хранилище: ${root}`);
  console.log("Режим: только чтение, ничего не изменяется.\n");

  const assets = await db.asset.findMany({
    where: { OR: [{ storageKey: { not: null } }, { thumbnailKey: { not: null } }] },
    select: {
      id: true,
      title: true,
      kind: true,
      mimeType: true,
      storageKey: true,
      thumbnailKey: true,
      thumbnailMime: true,
      archivedAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const counts: Record<string, number> = {};
  const bump = (k: string) => (counts[k] = (counts[k] ?? 0) + 1);
  const findings: string[] = [];
  const formats = new Map<string, number>();

  for (const a of assets) {
    const label = `${a.id}  [${a.kind}${a.archivedAt ? ", в архиве" : ""}]  «${a.title.slice(0, 50)}»`;

    if (a.storageKey) {
      bump("файлов проверено");
      const s = await sniffKey(a.storageKey);

      if ("missing" in s) {
        bump("файл не найден на диске");
        findings.push(`НЕТ ФАЙЛА   ${label}  ключ ${a.storageKey}`);
      } else if ("error" in s) {
        bump("ошибка чтения");
        findings.push(`ОШИБКА       ${label}  ${s.error}`);
      } else {
        const fk = `${a.kind} → ${s.format}`;
        formats.set(fk, (formats.get(fk) ?? 0) + 1);

        if (UPLOAD_KINDS.has(a.kind)) {
          const name = a.storageKey.slice(a.storageKey.lastIndexOf("/") + 1);
          const v = judge(s.format, a.kind as UploadKind, name, a.mimeType ?? "");
          if (!v.ok) {
            bump("проверка бы НЕ пропустила");
            findings.push(`ОТКЛОНИЛА   ${label}  заявлено «${a.mimeType}», по содержимому ${s.format}`);
          } else if (a.kind !== "VIDEO" && norm(a.mimeType) !== norm(v.mime)) {
            bump("пропустила бы, но тип в базе уточнился бы");
            findings.push(`ТИП ИСПРАВИТ ${label}  в базе «${a.mimeType}», по содержимому «${v.mime}»`);
          } else {
            bump("в порядке");
          }
        } else if (["svg", "html", "markup"].includes(s.format)) {
          bump("активное содержимое в материале другого вида");
          findings.push(`АКТИВНОЕ     ${label}  по содержимому ${s.format}`);
        } else {
          bump("прочие виды (не проверяются на загрузке)");
        }

        const served = safeServeHeaders(a.mimeType);
        if (served["Content-Disposition"] === "attachment" || served["Content-Security-Policy"]) {
          bump("отдача изменится из-за заявленного типа");
          findings.push(
            `ОТДАЧА      ${label}  заявлено «${a.mimeType}» → ${
              served["Content-Disposition"] ? "только скачивание" : "sandbox"
            }`,
          );
        }
      }
    }

    if (a.thumbnailKey) {
      bump("превью проверено");
      const s = await sniffKey(a.thumbnailKey);
      if ("missing" in s) {
        bump("превью не найдено на диске");
        findings.push(`НЕТ ПРЕВЬЮ   ${label}`);
      } else if ("error" in s) {
        findings.push(`ОШИБКА ПРЕВЬЮ ${label}  ${s.error}`);
      } else if (!IMAGE_FORMATS.has(s.format)) {
        bump("превью — не картинка");
        findings.push(`ПРЕВЬЮ      ${label}  заявлено «${a.thumbnailMime ?? "image/jpeg"}», по содержимому ${s.format}`);
      }
    }
  }

  console.log("Итоги:");
  for (const [k, v] of Object.entries(counts).sort()) console.log(`  ${k}: ${v}`);

  console.log("\nВид материала → формат по содержимому:");
  for (const [k, v] of [...formats].sort()) console.log(`  ${k}: ${v}`);

  console.log(`\nНаходки (${findings.length}):`);
  if (findings.length === 0) console.log("  нет");
  for (const f of findings) console.log(`  ${f}`);
}

main()
  .catch((e) => {
    console.error("Ошибка аудита:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
