"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDownIcon } from "./nav-icons";

export function under(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export function NavLink({
  href,
  label,
  icon,
  collapsed,
  except,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Свёрнутое меню: остаются одни значки, подпись прячется. */
  collapsed: boolean;
  /**
   * Ветки, которые пункту не принадлежат, хотя и лежат внутри его адреса.
   * Сюда попадают адреса видимых подразделов: на /hubs/<id> горят «Хабы»,
   * а на /hubs/folders — уже сам подраздел, и родителя зажигать не надо.
   *
   * Когда подразделы спрятаны, список пустой: подсвечиваться больше нечему,
   * и пункт снова отвечает за всю свою ветку.
   */
  except?: string[];
}) {
  const pathname = usePathname();
  const active =
    under(pathname, href) &&
    !(except ?? []).some((other) => under(pathname, other));

  return (
    <Link
      href={href}
      // Пока меню свёрнуто, название видно только по наведению — иначе не
      // угадать, что означает значок.
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      className={`flex h-9 pointer-coarse:h-11 items-center gap-2.5 rounded-lg px-2.5 text-sm transition duration-100 ${
        collapsed ? "justify-center" : ""
      } ${
        active
          ? "bg-border/70 font-medium text-accent"
          : "text-muted hover:bg-border/40 hover:text-accent"
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className={collapsed ? "hidden" : "hidden truncate md:inline"}>
        {label}
      </span>
    </Link>
  );
}

/**
 * Подраздел — вложенная ссылка без значка.
 *
 * Вместо значка слева вертикальная черта: она показывает, что пункт
 * относится к разделу выше. Совпадение не точное, а по началу адреса —
 * внутри конкретной папки подраздел «Папки» обязан оставаться подсвеченным.
 */
export function SubNavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = under(pathname, href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex h-8 pointer-coarse:h-11 items-center rounded-lg pr-2.5 pl-3 text-sm transition duration-100 ${
        active
          ? "font-medium text-foreground"
          : "text-muted hover:text-foreground"
      }`}
    >
      <span
        aria-hidden="true"
        className={`mr-2.5 h-full w-px shrink-0 ${
          active ? "bg-foreground/50" : "bg-border"
        }`}
      />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export type NavChild = { href: string; label: string };

/**
 * Раздел меню вместе со своими подразделами и стрелкой, которая их прячет.
 *
 * Стрелка — отдельная кнопка рядом со ссылкой, а не внутри неё: ссылка
 * внутри ссылки — недопустимая разметка, и нажатие на стрелку уводило бы
 * на страницу вместо того, чтобы свернуть список.
 */
export function NavGroup({
  href,
  label,
  icon,
  items,
  collapsed,
  open,
  onToggle,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Подразделы. Названо не `children`: это данные, а не вложенная разметка. */
  items: NavChild[];
  collapsed: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  // В свёрнутом меню подразделов не видно: значками их не различить,
  // а подписи там не помещаются. Ниже md меню всегда узкое.
  const showChildren = !collapsed && open;

  return (
    <div>
      <div className={collapsed ? "" : "flex items-center gap-0.5"}>
        <div className="min-w-0 flex-1">
          <NavLink
            href={href}
            label={label}
            icon={icon}
            collapsed={collapsed}
            except={showChildren ? items.map((c) => c.href) : []}
          />
        </div>

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          title={open ? `Скрыть подразделы: ${label}` : `Показать подразделы: ${label}`}
          aria-label={open ? `Скрыть подразделы: ${label}` : `Показать подразделы: ${label}`}
          className={`shrink-0 rounded-lg p-1.5 pointer-coarse:p-3 text-muted transition duration-100 hover:bg-border/60 hover:text-foreground active:scale-[0.92] ${
            collapsed ? "hidden" : "hidden md:block"
          }`}
        >
          <span
            className={`block transition-transform duration-150 ${
              open ? "" : "-rotate-180"
            }`}
          >
            <ChevronDownIcon />
          </span>
        </button>
      </div>

      <div className={showChildren ? "hidden md:grid" : "hidden"}>
        {items.map((child) => (
          <SubNavLink key={child.href} href={child.href} label={child.label} />
        ))}
      </div>
    </div>
  );
}
