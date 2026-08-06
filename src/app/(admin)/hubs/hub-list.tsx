import Link from "next/link";
import { withPlural, WORDS } from "@/lib/plural";
import { OwnerBadge } from "@/components/owner-badge";
import {
  VIEW_GRID_CLASS,
  VIEW_LIST_CLASS,
  type ViewMode,
} from "@/lib/view-mode";

export type HubRow = {
  id: string;
  title: string;
  status: string;
  items: number;
  links: number;
  /** Название папки или null. Показываем только там, где хабы вперемешку. */
  folderName: string | null;
  /** Готовая подпись «когда создан», дата и время. */
  createdLabel: string;
  /**
   * Кто создал — только заполнено, когда список показывает чужие записи
   * (администратор видит хабы всех сотрудников). У обычного пользователя
   * список и так только его собственный, поле остаётся null.
   */
  owner?: { id: string; label: string } | null;
};

function statusLabel(status: string): string {
  if (status === "PUBLISHED") return "Опубликован";
  if (status === "ARCHIVED") return "Удалён";
  return "Черновик";
}

/** Мелкая подпись статуса над названием — одинаковая в списке и в плитке. */
function StatusCaption({ status }: { status: string }) {
  return (
    <span
      className={`text-[11px] leading-none font-medium tracking-wide uppercase ${
        status === "PUBLISHED"
          ? "text-green-700 dark:text-green-400"
          : "text-muted"
      }`}
    >
      {statusLabel(status)}
    </span>
  );
}

/** Список хабов. Один и тот же на «Всех», внутри папки и в корзине. */
export function HubList({
  hubs,
  showFolder = false,
  view = "list",
}: {
  hubs: HubRow[];
  showFolder?: boolean;
  view?: ViewMode;
}) {
  const grid = view === "grid";

  return (
    <ul className={grid ? VIEW_GRID_CLASS : VIEW_LIST_CLASS}>
      {hubs.map((hub) => {
        const archived = hub.status === "ARCHIVED";

        // Материалы/ссылки и дата — на одной строке: счётчики слева,
        // дата прижата к правому краю той же строки. В плитке эта строка
        // отжимается вниз (mt-auto), чтобы держаться низа карточки
        // независимо от длины названия; в списке — просто идёт следом.
        const metaRow = (
          <span
            className={`flex items-center justify-between gap-3 text-xs text-muted ${
              grid ? "mt-auto pt-1" : "mt-0.5"
            }`}
          >
            <span className="truncate">
              {withPlural(hub.items, WORDS.material)} ·{" "}
              {withPlural(hub.links, WORDS.link)}
              {showFolder && hub.folderName ? ` · ${hub.folderName}` : ""}
            </span>
            <span className="shrink-0" title="Дата и время создания">
              {hub.createdLabel}
            </span>
          </span>
        );

        return (
          <li key={hub.id}>
            <Link
              href={`/hubs/${hub.id}`}
              className={`flex flex-col gap-0.5 rounded-xl border border-border px-4 py-3 transition hover:border-muted ${
                archived ? "opacity-60" : "bg-surface"
              } ${grid ? "h-full" : ""}`}
            >
              <span className="flex items-center justify-between gap-2">
                <StatusCaption status={hub.status} />
                {hub.owner ? <OwnerBadge id={hub.owner.id} label={hub.owner.label} /> : null}
              </span>
              <span
                className={grid ? "line-clamp-2 font-medium" : "truncate font-medium"}
              >
                {hub.title}
              </span>
              {metaRow}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
