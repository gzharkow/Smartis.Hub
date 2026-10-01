"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/auth";
import { canManageKpi } from "@/lib/permissions";
import { addMonths, defaultPlan, quarterOf, toDateOnly } from "@/lib/kpi";

// Раздел общий для всех, у кого есть доступ (флаг canAccessKpi): «все с
// доступом редактируют всё». Каждое действие всё равно проверяет доступ и
// сверяет организацию — id из браузера доверия не заслуживают.

const Int0 = z.number().int().min(0).max(1_000_000);
const Money = z.number().min(0).max(100_000_000_000);
const DateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Metric = z.enum(["MEETINGS", "QUALIFIED", "DEALS"]);
const Year = z.number().int().min(2000).max(2100);
const MonthNo = z.number().int().min(1).max(12);

/** Настройка таблицы (названия, должности, состав) — только ADMIN или тот,
 * кому дали право в админ-панели. Проверка здесь, а не только в интерфейсе. */
async function requireManage() {
  const user = await requireSection("kpi");
  if (!canManageKpi(user))
    throw new Error("Нет права менять настройки KPI-таблицы.");
  return user;
}

function done() {
  revalidatePath("/kpi");
}

async function ownPerson(organizationId: string, personId: string) {
  const p = await db.kpiPerson.findFirst({
    where: { id: personId, organizationId },
    select: { id: true },
  });
  if (!p) throw new Error("Участник не найден.");
}

const EntrySchema = z.object({
  personId: z.string().min(1),
  metric: Metric,
  scope: z.enum(["WEEK", "MONTH"]),
  periodStart: DateKey,
  // null — прочерк в ячейке.
  plan: Int0.nullable().optional(),
  fact: Int0.nullable().optional(),
  companies: z.array(z.string().trim().min(1).max(120)).max(40).optional(),
  // Примечания «!» к факту / плану; пустая строка — стереть.
  factNote: z.string().trim().max(500).nullable().optional(),
  planNote: z.string().trim().max(500).nullable().optional(),
});

export async function saveEntry(input: unknown) {
  const v = EntrySchema.parse(input);
  const user = await requireSection("kpi");
  const person = await db.kpiPerson.findFirst({
    where: { id: v.personId, organizationId: user.organizationId },
    select: { role: true },
  });
  if (!person) throw new Error("Участник не найден.");

  const data = {
    ...(v.plan !== undefined ? { plan: v.plan } : {}),
    ...(v.fact !== undefined ? { fact: v.fact } : {}),
    ...(v.companies !== undefined ? { companies: v.companies } : {}),
    ...(v.factNote !== undefined ? { factNote: v.factNote || null } : {}),
    ...(v.planNote !== undefined ? { planNote: v.planNote || null } : {}),
  };
  await db.kpiEntry.upsert({
    where: {
      organizationId_personId_metric_scope_periodStart: {
        organizationId: user.organizationId,
        personId: v.personId,
        metric: v.metric,
        scope: v.scope,
        periodStart: toDateOnly(v.periodStart),
      },
    },
    create: {
      organizationId: user.organizationId,
      personId: v.personId,
      metric: v.metric,
      scope: v.scope,
      periodStart: toDateOnly(v.periodStart),
      // Запись создаётся, например, вводом одного только факта — план при
      // этом не должен обнулиться: берём тот же дефолт, что показывает таблица.
      plan: defaultPlan(person.role, v.metric, v.scope),
      ...data,
    },
    update: data,
  });
  done();
}

const MonthPlanSchema = z.object({
  year: Year,
  month: MonthNo,
  planOptimal: Money,
  planMax: Money,
  planOptimalAuto: Money,
  planMaxAuto: Money,
});

export async function saveMonthPlan(input: unknown) {
  const user = await requireSection("kpi");
  const v = MonthPlanSchema.parse(input);
  await db.kpiMonth.upsert({
    where: {
      organizationId_year_month: {
        organizationId: user.organizationId,
        year: v.year,
        month: v.month,
      },
    },
    create: { organizationId: user.organizationId, ...v },
    update: {
      planOptimal: v.planOptimal,
      planMax: v.planMax,
      planOptimalAuto: v.planOptimalAuto,
      planMaxAuto: v.planMaxAuto,
    },
  });
  done();
}

const DealSchema = z.object({
  id: z.string().optional(),
  year: Year,
  month: MonthNo,
  client: z.string().trim().min(1, "Укажите клиента.").max(160),
  amount: Money,
  direction: z.enum(["AUTO", "REALTY"]).nullable(),
  managerName: z.string().trim().max(60),
  note: z.string().trim().max(300),
  isReserve: z.boolean(),
  confirmed: z.boolean(),
});

export async function saveDeal(input: unknown) {
  const user = await requireSection("kpi");
  const v = DealSchema.parse(input);

  const data = {
    year: v.year,
    month: v.month,
    client: v.client,
    amount: v.amount,
    direction: v.direction,
    managerName: v.managerName || null,
    note: v.note || null,
    isReserve: v.isReserve,
    // У резерва подписанного договора быть не может.
    confirmed: v.isReserve ? false : v.confirmed,
  };
  if (v.id) {
    const res = await db.kpiDeal.updateMany({
      where: { id: v.id, organizationId: user.organizationId },
      data,
    });
    if (res.count === 0) throw new Error("Сделка не найдена.");
  } else {
    const last = await db.kpiDeal.aggregate({
      where: {
        organizationId: user.organizationId,
        year: v.year,
        month: v.month,
      },
      _max: { position: true },
    });
    await db.kpiDeal.create({
      data: {
        organizationId: user.organizationId,
        position: (last._max.position ?? -1) + 1,
        ...data,
      },
    });
  }
  done();
}

export async function deleteDeal(id: string) {
  const user = await requireSection("kpi");
  await db.kpiDeal.deleteMany({
    where: { id, organizationId: user.organizationId },
  });
  done();
}

const Role = z.enum(["DEVELOPMENT", "ASSISTANT"]);

/** Резерв → обычная сделка выбранного месяца (в итоги и общую форму). */
export async function promoteReserve(id: string, year: number, month: number) {
  const user = await requireSection("kpi");
  const y = Year.parse(year);
  const m = MonthNo.parse(month);
  const last = await db.kpiDeal.aggregate({
    where: { organizationId: user.organizationId, year: y, month: m },
    _max: { position: true },
  });
  const res = await db.kpiDeal.updateMany({
    where: { id, organizationId: user.organizationId, isReserve: true },
    data: {
      isReserve: false,
      confirmed: false,
      year: y,
      month: m,
      position: (last._max.position ?? -1) + 1,
    },
  });
  if (res.count === 0) throw new Error("Запись резерва не найдена.");
  done();
}

/** Новый квартал: неподписанные сделки прошлого квартала переставляются
 * (не копируются) на 3 месяца вперёд — в соответствующие месяцы текущего. */
export async function carryOverUnconfirmed(year: number, month: number) {
  const user = await requireSection("kpi");
  const cur = { year: Year.parse(year), month: MonthNo.parse(month) };
  const prevQ = quarterOf(addMonths(cur, -3)).months;
  for (const m of prevQ) {
    const target = addMonths(m, 3);
    await db.kpiDeal.updateMany({
      where: {
        organizationId: user.organizationId,
        isReserve: false,
        confirmed: false,
        year: m.year,
        month: m.month,
      },
      data: { year: target.year, month: target.month },
    });
  }
  done();
}

const PersonSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Введите имя.").max(60),
  inActivity: z.boolean(),
  inSales: z.boolean(),
  role: Role.optional(),
  archived: z.boolean().optional(),
});

export async function savePerson(input: unknown) {
  const user = await requireManage();
  const v = PersonSchema.parse(input);
  if (v.id) {
    const res = await db.kpiPerson.updateMany({
      where: { id: v.id, organizationId: user.organizationId },
      data: {
        name: v.name,
        inActivity: v.inActivity,
        inSales: v.inSales,
        ...(v.role ? { role: v.role } : {}),
        ...(v.archived !== undefined ? { archived: v.archived } : {}),
      },
    });
    if (res.count === 0) throw new Error("Участник не найден.");
  } else {
    const last = await db.kpiPerson.aggregate({
      where: { organizationId: user.organizationId },
      _max: { position: true },
    });
    await db.kpiPerson.create({
      data: {
        organizationId: user.organizationId,
        name: v.name,
        inActivity: v.inActivity,
        inSales: v.inSales,
        role: v.role ?? "DEVELOPMENT",
        position: (last._max.position ?? -1) + 1,
      },
    });
  }
  done();
}

const AddToTableSchema = z.object({
  /** Существующий сотрудник… */
  personId: z.string().min(1).optional(),
  /** …или имя нового. */
  name: z.string().trim().min(1).max(60).optional(),
  role: Role,
});

/** Добавляет сотрудника в таблицу активности (сразу во все недели): включает
 * существующего или заводит нового, с выбранной должностью. */
export async function addToTable(input: unknown) {
  const user = await requireManage();
  const v = AddToTableSchema.parse(input);
  if (v.personId) {
    await ownPerson(user.organizationId, v.personId);
    await db.kpiPerson.update({
      where: { id: v.personId },
      data: { inActivity: true, archived: false, role: v.role },
    });
  } else if (v.name) {
    const last = await db.kpiPerson.aggregate({
      where: { organizationId: user.organizationId },
      _max: { position: true },
    });
    await db.kpiPerson.create({
      data: {
        organizationId: user.organizationId,
        name: v.name,
        inActivity: true,
        role: v.role,
        position: (last._max.position ?? -1) + 1,
      },
    });
  } else {
    throw new Error("Выберите сотрудника или введите имя.");
  }
  done();
}

/** Полное удаление участника вместе с его планами и фактами по всем неделям
 * (в отличие от «убрать из таблицы» / архива, где данные остаются). */
export async function deletePerson(personId: string) {
  const user = await requireManage();
  const res = await db.kpiPerson.deleteMany({
    where: { id: personId, organizationId: user.organizationId },
  });
  if (res.count === 0) throw new Error("Участник не найден.");
  done();
}
