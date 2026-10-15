import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, PDFFont, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {
  calculateQuote,
  formatMoney,
  formatThousands,
  storageEventsLimitLabel,
  type DecimalLike,
} from "./quote-calc";

// Генерируется по требованию из текущего состояния КП — как ShareLink,
// указывающий на живой Hub, а не снимок на момент создания. Ничего здесь
// не кешируется и не сохраняется готовым файлом (см. Cache-Control в
// src/app/api/quotes/[id]/pdf/route.ts).
//
// pdf-lib не переносит текст и блоки по страницам сам — вся раскладка
// (перенос описания по ширине колонки, разбивка на страницы) сделана вручную.

export type QuotePdfLine = {
  id: string;
  title: string;
  description: string | null;
  quantity: DecimalLike;
  unitPrice: DecimalLike | null;
  autoStorageLimit: boolean;
};

export type QuotePdfSection = {
  id: string;
  title: string;
  countsTowardImplementationPayment: boolean;
  lines: QuotePdfLine[];
};

export type QuotePdfData = {
  clientName: string;
  vatRatePct: DecimalLike;
  /** "2026-08-03" — дата в футере («предложение действительно 30 дней, начиная с…»). */
  documentDate: string;
  sections: QuotePdfSection[];
  /** «Коробка» в калькуляторе — включает третий итог в футере. У свободных
   * КП калькулятора нет, поэтому по умолчанию выключен. */
  boxIntegrationSelected?: boolean;
};

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;

const COLS = {
  title: { x: MARGIN, w: 245 },
  qty: { x: MARGIN + 245, w: 55 },
  price: { x: MARGIN + 300, w: 68 },
  exVat: { x: MARGIN + 368, w: 72 },
  incVat: { x: MARGIN + 440, w: PAGE_W - MARGIN - (MARGIN + 440) },
};

const GREEN = rgb(0.486, 0.659, 0.176); // #7CA82D — цвет «жучка» в логотипе Smartis
const WHITE = rgb(1, 1, 1);
const GRAY = rgb(0.45, 0.45, 0.45);
const INK = rgb(0.1, 0.1, 0.1);

function wrapText(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const attempt = current ? `${current} ${word}` : word;
    if (current && font.widthOfTextAtSize(attempt, size) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = attempt;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function renderQuotePdf(data: QuotePdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  const [regularBytes, boldBytes, logoBytes] = await Promise.all([
    readFile(path.join(process.cwd(), "public/fonts/Roboto-Regular.woff")),
    readFile(path.join(process.cwd(), "public/fonts/Roboto-Bold.woff")),
    // Логотип КП — не тот же public/logo.png, что в сайдбаре/на логине (тот —
    // просто знак без текста). Здесь целиком готовый вордмарк «SMARTIS»,
    // выданный владельцем специально для расчётов, текст рядом не дорисовываем.
    readFile(path.join(process.cwd(), "public/quote-logo.png")),
  ]);

  const regular = await doc.embedFont(regularBytes, { subset: true });
  const bold = await doc.embedFont(boldBytes, { subset: true });
  const logo = await doc.embedPng(logoBytes);

  const totals = calculateQuote(data.sections, data.vatRatePct, {
    boxIntegrationSelected: data.boxIntegrationSelected,
  });

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let cursorY = PAGE_H - MARGIN;

  function newPage() {
    page = doc.addPage([PAGE_W, PAGE_H]);
    cursorY = PAGE_H - MARGIN;
  }

  function ensureSpace(height: number) {
    if (cursorY - height < MARGIN) newPage();
  }

  function text(
    str: string,
    x: number,
    y: number,
    opts: {
      font?: PDFFont;
      size?: number;
      color?: ReturnType<typeof rgb>;
      align?: "left" | "right";
      maxWidth?: number;
    } = {},
  ) {
    const font = opts.font ?? regular;
    const size = opts.size ?? 10;
    const color = opts.color ?? INK;
    let drawX = x;
    if (opts.align === "right" && opts.maxWidth !== undefined) {
      drawX = x + opts.maxWidth - font.widthOfTextAtSize(str, size);
    }
    page.drawText(str, { x: drawX, y, size, font, color });
  }

  /** Черта цвета «жучка» логотипа — над строкой суммы секции и над блоком
   * итогов; заметная, но не жирная (см. GREEN, тот же цвет, что у шапки
   * таблицы и логотипа). */
  function greenLine(y: number) {
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: MARGIN + CONTENT_W, y },
      thickness: 1.2,
      color: GREEN,
    });
  }

  // ── Шапка ──
  const logoW = CONTENT_W * (2 / 3); // ~2/3 ширины документа
  const logoH = (logo.height / logo.width) * logoW;
  page.drawImage(logo, {
    x: MARGIN + (CONTENT_W - logoW) / 2, // по центру страницы, не по левому краю
    y: cursorY - logoH,
    width: logoW,
    height: logoH,
  });
  cursorY -= logoH + 24;

  text(`Расчет стоимости для: ${data.clientName}`, MARGIN, cursorY, { font: bold, size: 13 });
  cursorY -= 28;

  function drawTableHeader(title: string, continued: boolean) {
    ensureSpace(46);
    page.drawRectangle({
      x: MARGIN,
      y: cursorY - 22,
      width: CONTENT_W,
      height: 22,
      color: GREEN,
    });
    text(continued ? `${title} (продолжение)` : title, COLS.title.x + 8, cursorY - 15, {
      font: bold,
      size: 10,
      color: WHITE,
    });
    text("Единиц", COLS.qty.x, cursorY - 15, {
      font: bold,
      size: 7.5,
      color: WHITE,
      align: "right",
      maxWidth: COLS.qty.w - 6,
    });
    text("Цена за ед.", COLS.price.x, cursorY - 15, {
      font: bold,
      size: 7.5,
      color: WHITE,
      align: "right",
      maxWidth: COLS.price.w - 6,
    });
    text("Без НДС", COLS.exVat.x, cursorY - 15, {
      font: bold,
      size: 7.5,
      color: WHITE,
      align: "right",
      maxWidth: COLS.exVat.w - 6,
    });
    text(`С НДС ${formatThousands(data.vatRatePct)}%`, COLS.incVat.x, cursorY - 15, {
      font: bold,
      size: 7.5,
      color: WHITE,
      align: "right",
      maxWidth: COLS.incVat.w - 6,
    });
    cursorY -= 26;
  }

  // ── Секции ──
  for (const section of data.sections) {
    const sectionTotals = totals.sections.find((s) => s.id === section.id);
    if (!sectionTotals) continue;

    drawTableHeader(section.title, false);

    for (const line of section.lines) {
      const lineTotals = sectionTotals.lines.find((l) => l.id === line.id);
      const descLines = line.description
        ? wrapText(regular, line.description, 7.5, COLS.title.w - 12)
        : [];

      // Объединённая строка «Post-View другой медийной рекламы» — лимит
      // хранимых событий выводится из цены (см. QuoteLine.autoStorageLimit),
      // дорисовываем его отдельной серой строкой под описанием, как в редакторе.
      if (line.autoStorageLimit) {
        const limitLabel = storageEventsLimitLabel(line.unitPrice);
        if (limitLabel) {
          const suffix = limitLabel === "Безлимит" ? "" : " шт.";
          descLines.push(...wrapText(regular, `Лимит хранимых событий: ${limitLabel}${suffix}`, 7.5, COLS.title.w - 12));
        }
      }

      const rowHeight = 16 + descLines.length * 9.5 + 8;

      // Если строка не влезает — новая страница с перерисованной шапкой
      // таблицы, чтобы продолжение секции осталось понятным.
      if (cursorY - rowHeight < MARGIN + 20) {
        newPage();
        drawTableHeader(section.title, true);
      }

      const topY = cursorY;
      text(line.title || "—", COLS.title.x + 6, topY - 13, { font: bold, size: 9.5 });

      let descY = topY - 13 - 11;
      for (const dl of descLines) {
        text(dl, COLS.title.x + 6, descY, { size: 7.5, color: GRAY });
        descY -= 9.5;
      }

      text(formatThousands(line.quantity), COLS.qty.x, topY - 13, {
        size: 9,
        align: "right",
        maxWidth: COLS.qty.w - 6,
      });

      if (line.unitPrice !== null && lineTotals?.withoutVat && lineTotals?.withVat) {
        text(formatMoney(line.unitPrice), COLS.price.x, topY - 13, {
          size: 9,
          align: "right",
          maxWidth: COLS.price.w - 6,
        });
        text(formatMoney(lineTotals.withoutVat), COLS.exVat.x, topY - 13, {
          size: 9,
          align: "right",
          maxWidth: COLS.exVat.w - 6,
        });
        text(formatMoney(lineTotals.withVat), COLS.incVat.x, topY - 13, {
          size: 9,
          align: "right",
          maxWidth: COLS.incVat.w - 6,
        });
      }

      cursorY -= rowHeight;
    }

    ensureSpace(40);
    cursorY -= 6;
    greenLine(cursorY);
    cursorY -= 14;
    text("Сумма ежемесячных абонентских платежей:", COLS.title.x + 6, cursorY, {
      font: bold,
      size: 9.5,
    });
    text(formatMoney(sectionTotals.subtotalWithoutVat), COLS.exVat.x, cursorY, {
      font: bold,
      size: 9.5,
      align: "right",
      maxWidth: COLS.exVat.w - 6,
    });
    text(formatMoney(sectionTotals.subtotalWithVat), COLS.incVat.x, cursorY, {
      font: bold,
      size: 9.5,
      align: "right",
      maxWidth: COLS.incVat.w - 6,
    });
    cursorY -= 30;
  }

  // ── Итоги ──
  // Сноска про внедрение печатается, только если хоть одна секция отмечена
  // галочкой «скидка на внедрение» — владелец явно попросил: сняли галочку,
  // значит и звёздочка, и текст под ней внизу документа должны пропасть,
  // а не подменяться заглушкой «ни одна секция не отмечена».
  const flagged = data.sections.find((s) => s.countsTowardImplementationPayment);

  ensureSpace(100);

  cursorY -= 6;
  greenLine(cursorY);
  cursorY -= 16;

  if (totals.boxIntegrationPayment) {
    text("Интеграционный платеж коробочного решения", MARGIN, cursorY, { font: bold, size: 11 });
    text(formatMoney(totals.boxIntegrationPayment.withoutVat), COLS.exVat.x, cursorY, {
      font: bold,
      size: 9.5,
      align: "right",
      maxWidth: COLS.exVat.w,
    });
    text(formatMoney(totals.boxIntegrationPayment.withVat), COLS.incVat.x, cursorY, {
      font: bold,
      size: 11,
      align: "right",
      maxWidth: COLS.incVat.w,
    });
    cursorY -= 22;
  }

  text(
    flagged ? "Итого ежемесячный платеж на период внедрения:*" : "Итого ежемесячный платеж на период внедрения",
    MARGIN,
    cursorY,
    { font: bold, size: 11 },
  );
  text(formatMoney(totals.implementationPayment), COLS.incVat.x, cursorY, {
    font: bold,
    size: 11,
    align: "right",
    maxWidth: COLS.incVat.w,
  });
  cursorY -= 22;

  text("Итого абонентских ежемесячных платежей:**", MARGIN, cursorY, { font: bold, size: 11 });
  text(formatMoney(totals.monthlyTotal), COLS.incVat.x, cursorY, {
    font: bold,
    size: 11,
    align: "right",
    maxWidth: COLS.incVat.w,
  });
  cursorY -= 26;

  if (flagged) {
    const footnote1 = `* Платёж на период внедрения — 50% от суммы «с НДС» секции «${flagged.title}»; остальные секции в него не входят.`;
    text(footnote1, MARGIN, cursorY, { size: 7.5, color: GRAY });
    cursorY -= 11;
  }

  const footnote2 = `** Полная сумма выставляется после полного внедрения продукта и подключения всех сопутствующих интеграций`;
  text(footnote2, MARGIN, cursorY, { size: 7.5, color: GRAY });
  cursorY -= 20;

  // documentDate — "YYYY-MM-DD" от <input type="date">, разбираем строкой,
  // а не через new Date(), чтобы часовой пояс не сдвинул день.
  const [dy, dm, dd] = data.documentDate.split("-");
  const dateStr = dd && dm && dy ? `${dd}.${dm}.${dy}` : data.documentDate;
  text(`Данное предложение действительно 30 дней, начиная с ${dateStr}`, MARGIN, cursorY, {
    size: 9,
    color: GRAY,
  });

  return doc.save();
}
