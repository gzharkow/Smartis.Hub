import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { daysLeft, purgeExpiredHubs, TRASH_DAYS } from "@/lib/hub-trash";
import {
  parseViewMode,
  VIEW_COOKIE,
  VIEW_GRID_CLASS,
  VIEW_LIST_CLASS,
} from "@/lib/view-mode";
import { ViewToggle } from "@/components/view-toggle";
import { HubTabs } from "../hub-tabs";
import { TrashRow, type TrashRowData } from "./trash-row";

export const dynamic = "force-dynamic";

export default async function TrashPage() {
  const user = await requireUser();
  const view = parseViewMode((await cookies()).get(VIEW_COOKIE)?.value);

  // Уборка просроченного — здесь, при открытии раздела. Настоящее место для
  // неё — задача по расписанию, но запускать её пока негде: сервис живёт
  // локально. Последствие честное: если в раздел долго не заходить, хаб
  // переживёт свой срок. Это лучше, чем стирать данные по расписанию,
  // за которым никто не следит.
  await purgeExpiredHubs(user.organizationId);

  const hubs = await db.hub.findMany({
    where: {
      organizationId: user.organizationId,
      ...(user.role === "ADMIN" ? {} : { ownerId: user.id }),
      status: "ARCHIVED",
    },
    include: { _count: { select: { items: true, shareLinks: true } } },
    orderBy: { archivedAt: "desc" },
  });

  const rows: TrashRowData[] = hubs.map((h) => ({
    id: h.id,
    title: h.title,
    items: h._count.items,
    links: h._count.shareLinks,
    daysLeft: h.archivedAt ? daysLeft(h.archivedAt) : null,
  }));

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight">
          Недавно удалённые
        </h1>
        <p className="mt-0.5 text-sm text-muted">
          Хранятся {TRASH_DAYS} дней, потом исчезают навсегда. Ссылки у клиентов
          уже не открываются
        </p>
      </div>

      <HubTabs
        current="trash"
        right={rows.length > 0 ? <ViewToggle value={view} /> : null}
      />

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="font-medium">Здесь пусто</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Удалённые хабы попадают сюда и ждут {TRASH_DAYS} дней — на случай,
            если удалили не тот.
          </p>
        </div>
      ) : (
        <ul className={view === "grid" ? VIEW_GRID_CLASS : VIEW_LIST_CLASS}>
          {rows.map((hub) => (
            <TrashRow key={hub.id} hub={hub} view={view} />
          ))}
        </ul>
      )}
    </div>
  );
}
