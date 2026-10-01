import JSZip from "jszip";
import {
  DOCX_MIME,
  XLSX_MIME,
  isJpeg,
  sniffFormat,
  verifyBuffer,
  type FileFormat,
  type UploadKind,
} from "../src/lib/file-signature";
import { safeServeHeaders } from "../src/lib/serve-headers";

let failed = 0;
function check(name: string, ok: boolean, extra = "") {
  if (!ok) failed++;
  console.log(`${ok ? "ок     " : "ПРОВАЛ "} ${name}${ok || !extra ? "" : `  → ${extra}`}`);
}

const enc = new TextEncoder();
const bytes = (...parts: (number[] | string)[]) =>
  Uint8Array.from(
    parts.flatMap((p) => (typeof p === "string" ? [...enc.encode(p)] : p)),
  );
const pad = (n: number) => new Array(n).fill(0);

async function zipWith(files: string[]): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const f of files) zip.file(f, "<x/>");
  return zip.generateAsync({ type: "uint8array" });
}

const sizeBox = [0, 0, 0, 0x1c];

const samples: Record<string, Uint8Array> = {
  pdf: bytes("%PDF-1.7\n%\xe2\xe3", pad(40)),
  pdfWithJunk: bytes("\r\n\r\n   ", "%PDF-1.4\n", pad(40)),
  jpeg: bytes([0xff, 0xd8, 0xff, 0xe0], pad(30)),
  png: bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], pad(30)),
  gif: bytes("GIF89a", pad(30)),
  webp: bytes("RIFF", [0, 0, 0, 0], "WEBP", pad(20)),
  avif: bytes(sizeBox, "ftypavif", pad(20)),
  heic: bytes(sizeBox, "ftypheic", pad(20)),
  mp4: bytes(sizeBox, "ftypisom", pad(20)),
  m4v: bytes(sizeBox, "ftypM4V ", pad(20)),
  mov: bytes(sizeBox, "ftypqt  ", pad(20)),
  movLegacy: bytes([0, 0, 0x10, 0], "moov", pad(20)),
  webm: bytes([0x1a, 0x45, 0xdf, 0xa3], pad(30)),
  avi: bytes("RIFF", [0, 0, 0, 0], "AVI ", pad(20)),
  ogg: bytes("OggS", pad(30)),
  xls: bytes([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], pad(40)),
  csv: bytes("Имя;Сумма\nИван;100\n"),
  csvBom: bytes([0xef, 0xbb, 0xbf], "a,b\n1,2\n"),
  csvUtf16: bytes([0xff, 0xfe, 0x61, 0, 0x2c, 0, 0x62, 0]),
  svg: bytes('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
  svgBare: bytes('  <svg onload="alert(1)"></svg>'),
  html: bytes("<!DOCTYPE html><html><script>alert(1)</script></html>"),
  htmlBare: bytes("<script>alert(1)</script>"),
  xml: bytes('<?xml version="1.0"?><root/>'),
  binary: bytes([0x00, 0x01, 0x02, 0x03, 0xff, 0xfe, 0x00, 0x00]),
  exe: bytes("MZ", [0x90, 0, 3, 0], pad(30)),
};
async function main() {
const docx = await zipWith(["[Content_Types].xml", "word/document.xml"]);
const xlsx = await zipWith(["[Content_Types].xml", "xl/workbook.xml"]);
const plainZip = await zipWith(["readme.txt"]);

const sniffCases: [string, Uint8Array, FileFormat][] = [
  ["PDF", samples.pdf!, "pdf"],
  ["PDF с мусором перед сигнатурой", samples.pdfWithJunk!, "pdf"],
  ["JPEG", samples.jpeg!, "jpeg"],
  ["PNG", samples.png!, "png"],
  ["GIF", samples.gif!, "gif"],
  ["WebP", samples.webp!, "webp"],
  ["AVIF", samples.avif!, "avif"],
  ["HEIC", samples.heic!, "heic"],
  ["MP4 (isom)", samples.mp4!, "mp4"],
  ["M4V", samples.m4v!, "mp4"],
  ["MOV (qt)", samples.mov!, "mov"],
  ["старый MOV без ftyp", samples.movLegacy!, "mov"],
  ["WebM", samples.webm!, "webm"],
  ["AVI", samples.avi!, "avi"],
  ["Ogg", samples.ogg!, "ogg"],
  ["XLS (OLE)", samples.xls!, "ole"],
  ["CSV (кириллица)", samples.csv!, "text"],
  ["CSV с BOM", samples.csvBom!, "text"],
  ["CSV в UTF-16", samples.csvUtf16!, "text"],
  ["SVG с xml-прологом", samples.svg!, "svg"],
  ["SVG без пролога", samples.svgBare!, "svg"],
  ["HTML с doctype", samples.html!, "html"],
  ["HTML-скрипт без doctype", samples.htmlBare!, "html"],
  ["XML", samples.xml!, "markup"],
  ["двоичный мусор", samples.binary!, "unknown"],
  ["exe", samples.exe!, "unknown"],
  ["zip (до уточнения)", docx, "zip"],
];
console.log("Определение формата:");
for (const [name, data, want] of sniffCases) {
  const got = sniffFormat(data);
  check(`${name} → ${want}`, got === want, `получили ${got}`);
}

type Case = [string, Uint8Array, UploadKind, string, string, boolean, string?];
const verdictCases: Case[] = [
  // имя, данные, вид материала, имя файла, заявленный mime, должно ли пройти, ожидаемый mime
  ["PDF как PDF", samples.pdf!, "PDF", "a.pdf", "application/pdf", true, "application/pdf"],
  ["PDF без типа от браузера (octet-stream)", samples.pdf!, "PDF", "a.pdf", "application/octet-stream", true, "application/pdf"],
  ["HTML под видом PDF", samples.html!, "PDF", "a.pdf", "application/pdf", false],
  ["JPEG как изображение", samples.jpeg!, "IMAGE", "a.jpg", "image/jpeg", true, "image/jpeg"],
  ["PNG, названный .jpg, честно определяется как PNG", samples.png!, "IMAGE", "a.jpg", "image/jpeg", true, "image/png"],
  ["SVG отклоняется", samples.svg!, "IMAGE", "a.svg", "image/svg+xml", false],
  ["SVG под видом PNG отклоняется", samples.svg!, "IMAGE", "a.png", "image/png", false],
  ["HTML под видом картинки отклоняется", samples.html!, "IMAGE", "a.png", "image/png", false],
  ["PDF под видом картинки отклоняется", samples.pdf!, "IMAGE", "a.png", "image/png", false],
  ["HEIC как изображение", samples.heic!, "IMAGE", "a.heic", "image/heic", true, "image/heic"],
  ["MP4 как видео, тип сохраняется заявленный", samples.mp4!, "VIDEO", "a.mp4", "video/mp4", true, "video/mp4"],
  ["MOV с заявленным video/quicktime", samples.mov!, "VIDEO", "a.mov", "video/quicktime", true, "video/quicktime"],
  ["старый MOV", samples.movLegacy!, "VIDEO", "a.mov", "video/quicktime", true, "video/quicktime"],
  ["WebM как видео", samples.webm!, "VIDEO", "a.webm", "video/webm", true, "video/webm"],
  ["видео без заявленного типа получает тип по содержимому", samples.mp4!, "VIDEO", "a.mp4", "", true, "video/mp4"],
  ["HTML под видом видео отклоняется", samples.html!, "VIDEO", "a.mp4", "video/mp4", false],
  ["docx как документ", docx, "DOCUMENT", "a.docx", DOCX_MIME, true, DOCX_MIME],
  ["docx без типа от браузера", docx, "DOCUMENT", "a.docx", "", true, DOCX_MIME],
  ["zip без word/document.xml отклоняется", plainZip, "DOCUMENT", "a.docx", DOCX_MIME, false],
  ["текст под видом docx отклоняется", samples.csv!, "DOCUMENT", "a.docx", DOCX_MIME, false],
  ["xlsx как таблица", xlsx, "SPREADSHEET", "a.xlsx", XLSX_MIME, true, XLSX_MIME],
  ["docx под видом xlsx отклоняется", docx, "SPREADSHEET", "a.xlsx", XLSX_MIME, false],
  ["xls по расширению", samples.xls!, "SPREADSHEET", "a.xls", "application/vnd.ms-excel", true, "application/vnd.ms-excel"],
  ["OLE-файл без признаков таблицы (может быть .doc) отклоняется", samples.xls!, "SPREADSHEET", "a.doc", "application/msword", false],
  ["csv, присланный как vnd.ms-excel (частый случай Windows), получает text/csv", samples.csv!, "SPREADSHEET", "a.csv", "application/vnd.ms-excel", true, "text/csv"],
  ["csv с BOM", samples.csvBom!, "SPREADSHEET", "a.csv", "text/csv", true, "text/csv"],
  ["обычный текст без признаков csv отклоняется", samples.csv!, "SPREADSHEET", "notes.txt", "text/plain", false],
  ["двоичный файл под видом csv отклоняется", samples.binary!, "SPREADSHEET", "a.csv", "text/csv", false],
  ["exe под видом PDF отклоняется", samples.exe!, "PDF", "a.pdf", "application/pdf", false],
];
console.log("");
console.log("Вердикты для загрузки:");
for (const [name, data, kind, file, mime, wantOk, wantMime] of verdictCases) {
  const v = await verifyBuffer(data, kind, file, mime);
  const good = v.ok === wantOk && (!wantOk || !wantMime || (v.ok && v.mime === wantMime));
  check(name, good, v.ok ? `принят как ${v.mime}` : v.reason);
}

console.log("");
console.log("Сообщения об отказе:");
{
  const v = await verifyBuffer(samples.svg!, "IMAGE", "a.svg", "image/svg+xml");
  check("для SVG подсказка про PNG/JPG", !v.ok && v.reason.includes("PNG или JPG"), v.ok ? "" : v.reason);
}

console.log("");
console.log("Превью:");
check("JPEG-превью принимается", isJpeg(samples.jpeg!));
check("PNG вместо превью отклоняется", !isJpeg(samples.png!));

console.log("");
console.log("Заголовки отдачи:");
{
  const plain = (m: string | null) => safeServeHeaders(m);
  check(
    "PDF отдаётся без добавок",
    JSON.stringify(plain("application/pdf")) === '{"Content-Type":"application/pdf"}',
  );
  check("JPEG без добавок", Object.keys(plain("image/jpeg")).length === 1);
  check("видео без добавок", Object.keys(plain("video/mp4")).length === 1);
  check("docx без добавок", Object.keys(plain(DOCX_MIME)).length === 1);
  check("csv без добавок", Object.keys(plain("text/csv")).length === 1);
  check("тип с параметрами сохраняется как был", plain("text/csv; charset=utf-8")["Content-Type"] === "text/csv; charset=utf-8");
  const svg = plain("image/svg+xml");
  check(
    "SVG получает sandbox и остаётся SVG",
    svg["Content-Type"] === "image/svg+xml" && /sandbox/.test(svg["Content-Security-Policy"] ?? ""),
  );
  const html = plain("text/html");
  check(
    "HTML отдаётся только как скачивание",
    html["Content-Type"] === "application/octet-stream" && html["Content-Disposition"] === "attachment",
  );
  check("XML — тоже скачивание", plain("application/xml")["Content-Disposition"] === "attachment");
  check("незнакомый тип — скачивание", plain("application/x-whatever")["Content-Disposition"] === "attachment");
  check("пустой тип — octet-stream без attachment", plain(null)["Content-Type"] === "application/octet-stream" && !plain(null)["Content-Disposition"]);
}

console.log("");
console.log(failed === 0 ? "Все проверки пройдены." : `ПРОВАЛЕНО: ${failed}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
