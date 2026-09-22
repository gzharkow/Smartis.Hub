import Link from "next/link";
import { withPlural, WORDS } from "@/lib/plural";
import { OwnerBadge } from "@/components/owner-badge";
import { HubTileActions } from "./hub-tile-actions";
import { LocalDateTime } from "@/components/local-datetime";
import {
  VIEW_LIST_CLASS,
  type ViewMode,
} from "@/lib/view-mode";

// На телефоне — 2 гибкие колонки (плитка тянется под ½ ширины экрана), с
// sm: и выше — прежняя раскладка: колонки авто-заполняются (auto-fill) под
// доступную ширину фиксированной плиткой 220px, окно шире → плиток больше,
// но сама плитка не растягивается ни при какой ширине/масштабе.
const HUB_TILE_GRID_CLASS =
  "grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,220px)] sm:gap-4";

export type HubRow = {
  id: string;
  title: string;
  status: string;
  items: number;
  links: number;
  /** Название папки или null. Показываем только там, где хабы вперемешку. */
  folderName: string | null;
  /** Когда создан — сырая дата, подпись собирает LocalDateTime (в браузере
   *  зрителя, не сервера). */
  createdAt: Date;
  /**
   * Кто создал — только заполнено, когда список показывает чужие записи
   * (администратор видит хабы всех сотрудников). У обычного пользователя
   * список и так только его собственный, поле остаётся null.
   */
  owner?: { id: string; label: string } | null;
  /** Брендинг хаба — уже с фоллбэком на бренд организации, см. страницу-источник. */
  brandColor: string;
  logoUrl: string;
  /** Может ли ТЕКУЩИЙ пользователь копировать/удалять этот хаб — ADMIN
   *  либо владелец. Считается на странице-источнике, где есть текущий
   *  пользователь; без этого поля пришлось бы протаскивать его сюда целиком. */
  canManage: boolean;
};

function statusLabel(status: string): string {
  if (status === "PUBLISHED") return "Опубликован";
  if (status === "ARCHIVED") return "Удалён";
  return "Черновик";
}

/**
 * Мелкая подпись статуса над названием. В плитке лежит поверх фото витрины —
 * там нужны более светлые, контрастные оттенки, чем на нейтральном фоне списка.
 */
function StatusCaption({ status, grid = false }: { status: string; grid?: boolean }) {
  return (
    <span
      className={`shrink-0 text-[11px] leading-none font-medium tracking-wide uppercase ${
        status === "PUBLISHED"
          ? grid
            ? "text-green-300"
            : "text-ok"
          : grid
            ? "text-white/70"
            : "text-muted"
      }`}
    >
      {statusLabel(status)}
    </span>
  );
}

/**
 * Уменьшенная копия фона витрины (см. ShowcaseBackdrop) — фон плитки хаба.
 * Контраст подобран отдельно: плитка маленькая и текст лежит по всей её
 * площади, а не только снизу, как на настоящей витрине.
 */
function HubTilePreview({
  brandColor,
  logoUrl,
}: {
  brandColor: string;
  logoUrl: string;
}) {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden rounded-[inherit] bg-[#0b0f14]"
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/hub-bg.jpg')" }}
      />
      <div
        className="absolute inset-0 opacity-30 mix-blend-screen"
        style={{
          background: `radial-gradient(70% 60% at 15% 0%, ${brandColor}, transparent 65%)`,
        }}
      />
      {/* Лого — водяной знак по центру, а не чёткая метка в углу: все четыре
          угла карточки уже заняты текстом (статус, автор, счётчики, дата). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoUrl}
        alt=""
        className="absolute top-1/2 left-1/2 h-16 w-auto -translate-x-1/2 -translate-y-1/2 opacity-15"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/20 to-black/60" />
    </div>
  );
}

/** Бейдж автора в плитке — без цветной палитры OwnerBadge: на фото её тёмный
 * текст теряет контраст, здесь нужен гарантированно читаемый вариант. */
function GridOwnerChip({ label }: { label: string }) {
  return (
    <span
      className="min-w-0 max-w-[7.5rem] truncate rounded-full bg-black/35 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm"
      title={label}
    >
      {label}
    </span>
  );
}

/** Список хабов. Один и тот же на «Всех», внутри папки и в корзине. */
export function HubList({
  hubs,
  showFolder = false,
  view = "list",
  backHref = "/hubs",
}: {
  hubs: HubRow[];
  showFolder?: boolean;
  view?: ViewMode;
  /** Куда вернуться со страницы хаба — «Все хабы» по умолчанию, либо папка,
   *  из которой открыт этот список (см. HubPage/resolveBack). */
  backHref?: string;
}) {
  const grid = view === "grid";

  return (
    <ul className={grid ? HUB_TILE_GRID_CLASS : VIEW_LIST_CLASS}>
      {hubs.map((hub) => {
        const archived = hub.status === "ARCHIVED";

        // Материалы/ссылки и дата — на одной строке: счётчики слева,
        // дата прижата к правому краю той же строки. В плитке эта строка
        // отжимается вниз (mt-auto), чтобы держаться низа карточки
        // независимо от длины названия; в списке — просто идёт следом.
        const metaRow = (
          <span
            className={`relative z-10 flex items-center justify-between gap-3 text-xs ${
              grid ? "mt-auto pt-1 text-white/80" : "mt-0.5 text-muted"
            }`}
          >
            <span className="truncate">
              {withPlural(hub.items, WORDS.material)} ·{" "}
              {withPlural(hub.links, WORDS.link)}
              {showFolder && hub.folderName ? ` · ${hub.folderName}` : ""}
            </span>
            <span className="shrink-0" title="Дата и время создания">
              <LocalDateTime kind="hubCreated" date={hub.createdAt} />
            </span>
          </span>
        );

        return (
          <li key={hub.id}>
            <Link
              href={
                backHref === "/hubs"
                  ? `/hubs/${hub.id}`
                  : `/hubs/${hub.id}?from=${encodeURIComponent(backHref)}`
              }
              className={`group relative flex flex-col gap-0.5 overflow-hidden rounded-xl border border-border transition hover:border-muted ${
                grid
                  ? `h-[248px] p-4 text-white ${archived ? "opacity-60" : ""}`
                  : `px-4 py-3 ${archived ? "opacity-60" : "bg-surface"}`
              }`}
            >
              {grid ? (
                <HubTilePreview brandColor={hub.brandColor} logoUrl={hub.logoUrl} />
              ) : null}
              {hub.canManage && grid ? <HubTileActions hubId={hub.id} /> : null}
              <span
                // flex-wrap (не влияет на кнопки) — на узкой 2-колоночной
                // плитке телефона статус и бейдж автора иначе не помещаются
                // в одну строку; бейдж просто переносится вниз.
                className="relative z-10 flex flex-wrap items-center justify-between gap-x-2 gap-y-1"
              >
                <StatusCaption status={hub.status} grid={grid} />
                {hub.owner ? (
                  grid ? (
                    <GridOwnerChip label={hub.owner.label} />
                  ) : (
                    <OwnerBadge id={hub.owner.id} label={hub.owner.label} />
                  )
                ) : null}
              </span>
              <span
                className={`relative z-10 ${grid ? "line-clamp-2 font-medium" : "truncate font-medium"}`}
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
