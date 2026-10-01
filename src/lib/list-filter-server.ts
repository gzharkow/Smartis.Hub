import "server-only";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { ownerLabel } from "@/lib/owner-color";
import {
  listFilterCookie,
  parseListFilter,
  type ListFilterScope,
} from "@/lib/list-filter";

type FilterUser = { organizationId: string; role: string };

/** Фильтр из cookie + список создателей для выпадашки (только ADMIN). */
export async function loadListFilter(scope: ListFilterScope, user: FilterUser) {
  const isAdmin = user.role === "ADMIN";
  const jar = await cookies();
  const filter = parseListFilter(jar.get(listFilterCookie(scope))?.value, isAdmin);
  const creators = isAdmin
    ? (
        await db.user.findMany({
          where: { organizationId: user.organizationId },
          select: { id: true, name: true, email: true },
          orderBy: [{ name: "asc" }, { email: "asc" }],
        })
      ).map((u) => ({ id: u.id, label: ownerLabel(u) }))
    : undefined;
  return { filter, creators, active: filter.industry !== null || filter.creator !== null };
}
