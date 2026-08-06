"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { ownedQuote } from "./quotes";
import {
  QuoteCalculatorConfigSchema,
  DEFAULT_BUILDER_CONFIG,
  DEFAULT_AUTO_DEALER_CONFIG,
  deriveQuoteDocument,
  type QuoteCalculatorConfig,
} from "@/lib/quote-calculator";

function revalidateQuote(quoteId: string) {
  revalidatePath("/calculator");
  revalidatePath(`/calculator/${quoteId}`);
}

/**
 * Полная замена секций/строк КП выведенным документом — тот же bulk-create,
 * что уже делают createQuote/duplicateQuote в quotes.ts, но сперва сносит
 * текущие секции (каскадом сносятся и строки), а не добавляет поверх.
 * Для calculator-driven КП строки не редактируются вручную и не хранят
 * ничего, кроме своей позиции в выводе — полная пересборка проще и надёжнее
 * diff'а по id.
 */
async function replaceQuoteDocument(
  tx: Prisma.TransactionClient,
  quoteId: string,
  config: QuoteCalculatorConfig,
) {
  const derived = deriveQuoteDocument(config);

  await tx.quoteSection.deleteMany({ where: { quoteId } });

  for (const [sectionIndex, section] of derived.sections.entries()) {
    await tx.quoteSection.create({
      data: {
        quoteId,
        title: section.title,
        position: sectionIndex,
        countsTowardImplementationPayment: section.countsTowardImplementationPayment,
        lines: {
          create: section.lines.map((line, lineIndex) => ({
            title: line.title,
            description: line.description,
            position: lineIndex,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            autoStorageLimit: line.autoStorageLimit,
          })),
        },
      },
    });
  }

  await tx.quote.update({
    where: { id: quoteId },
    data: {
      // Prisma Json-поле — конфиг проходит валидацию до сюда (вызовы ниже),
      // но структурно это plain object, приводим явно под InputJsonValue.
      calculatorConfig: config as unknown as Prisma.InputJsonValue,
      boxIntegrationSelected: derived.boxIntegrationSelected,
    },
  });
}

const ClientTypeSchema = z.enum(["BUILDER", "AUTO_DEALER"]);

/**
 * Первый выбор типа клиента ИЛИ смена типа — оба случая полностью сбрасывают
 * конфиг на дефолтный для нового типа. Подтверждение сброса — на UI (см.
 * ClientTypePicker/ClientTypeSwitcher), это действие ничего не спрашивает
 * само, как и остальные server actions в этом файле.
 */
export async function setQuoteClientType(quoteId: string, clientType: string) {
  const { quote } = await ownedQuote(quoteId);
  const parsed = ClientTypeSchema.safeParse(clientType);
  if (!parsed.success) throw new Error("Некорректный тип клиента.");

  const config = parsed.data === "BUILDER" ? DEFAULT_BUILDER_CONFIG : DEFAULT_AUTO_DEALER_CONFIG;

  await db.$transaction(async (tx) => {
    await tx.quote.update({ where: { id: quote.id }, data: { clientType: parsed.data } });
    await replaceQuoteDocument(tx, quote.id, config);
  });

  revalidateQuote(quote.id);
}

/**
 * Клиент всегда шлёт целиком актуальную форму (не патч) — валидируем и
 * пишем весь объект разом, без диффа полей на сервере.
 */
export async function updateQuoteCalculatorConfig(quoteId: string, config: unknown) {
  const { quote } = await ownedQuote(quoteId);
  if (!quote.clientType) throw new Error("У этого КП не выбран тип клиента.");

  const parsed = QuoteCalculatorConfigSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Проверьте значения калькулятора.");
  }
  if (parsed.data.clientType !== quote.clientType) {
    throw new Error("Тип клиента в форме не совпадает с КП.");
  }

  await db.$transaction((tx) => replaceQuoteDocument(tx, quote.id, parsed.data));

  revalidateQuote(quote.id);
}
