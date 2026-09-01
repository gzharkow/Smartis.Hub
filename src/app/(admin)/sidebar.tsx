"use client";

import { useState } from "react";
import Link from "next/link";
import { SECTIONS } from "@/lib/asset-sections";
import { NavGroup, NavLink, type NavChild } from "./nav-link";
import { NAV_COOKIE, NAV_COOKIE_MAX_AGE, NAV_SHUT_COOKIE } from "./nav-cookie";
import {
  AssetsIcon,
  CalculatorIcon,
  ChevronIcon,
  HubsIcon,
  SettingsIcon,
  StatsIcon,
} from "./nav-icons";

type Child = NavChild & { key: string };

type Group = {
  key: string;
  href: string;
  label: string;
  icon: React.ReactNode;
  children: Child[];
};

const GROUPS: Group[] = [
  {
    key: "hubs",
    href: "/hubs",
    label: "Хабы",
    icon: <HubsIcon />,
    children: [
      { key: "hubs.folders", href: "/hubs/folders", label: "Папки" },
      { key: "hubs.trash", href: "/hubs/trash", label: "Недавно удалённые" },
    ],
  },
  {
    key: "assets",
    href: "/assets",
    label: "Материалы",
    icon: <AssetsIcon />,
    children: SECTIONS.map((s) => ({
      key: `assets.${s.slug}`,
      href: `/assets/${s.slug}`,
      label: s.label,
    })),
  },
  {
    key: "calculator",
    href: "/calculator",
    label: "Генератор КП",
    icon: <CalculatorIcon />,
    children: [
      { key: "calculator.files", href: "/calculator/files", label: "Файлы" },
      { key: "calculator.spec", href: "/calculator/spec", label: "Спецификации" },
    ],
  },
];

/** Запомнить настройку вида. Вне компонента — записью в cookie React не ведает. */
function remember(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=${NAV_COOKIE_MAX_AGE}; samesite=lax`;
}

/**
 * Боковое меню админки.
 *
 * Что свёрнуто — помним в cookie, а не в localStorage, потому что cookie
 * видна серверу: страница приходит из браузера уже в нужном виде, и меню
 * не «прыгает» на глазах при каждом открытии.
 *
 * Cookie служебные — это лишь настройки вида, ничего личного в них нет.
 */
export function Sidebar({
  initialCollapsed,
  initialShut,
}: {
  initialCollapsed: boolean;
  /** Разделы, у которых подразделы свёрнуты. */
  initialShut: string[];
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [shut, setShut] = useState<string[]>(initialShut);

  function toggleSidebar() {
    const next = !collapsed;
    setCollapsed(next);
    remember(NAV_COOKIE, next ? "1" : "0");
  }

  function toggleGroup(key: string) {
    const next = shut.includes(key)
      ? shut.filter((k) => k !== key)
      : [...shut, key];
    setShut(next);
    remember(NAV_SHUT_COOKIE, next.join(","));
  }

  return (
    // sticky + h-screen: меню остаётся на месте, когда список хабов длинный.
    // На узких экранах остаются одни значки — там просто нет места на подписи.
    <aside
      className={`sticky top-0 flex h-screen shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 ${
        collapsed ? "w-14" : "w-14 md:w-60"
      }`}
    >
      <div
        className={`flex h-14 shrink-0 items-center border-b border-border px-3 ${
          collapsed ? "justify-center" : "justify-center md:justify-between"
        }`}
      >
        <Link
          href="/hubs"
          className="flex items-center gap-2 font-semibold tracking-tight"
          title="Smartis.Flite"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-6 w-auto shrink-0" />
          <span className={collapsed ? "hidden" : "hidden md:inline"}>
            Smartis.Flite
          </span>
        </Link>

        {/* На узком экране сворачивать нечего — меню и так одни значки. */}
        <button
          type="button"
          onClick={toggleSidebar}
          title="Свернуть меню"
          aria-label="Свернуть меню"
          className={`rounded-lg p-1.5 pointer-coarse:p-3 text-muted transition duration-100 hover:bg-border/60 hover:text-foreground active:scale-[0.92] ${
            collapsed ? "hidden" : "hidden md:block"
          }`}
        >
          <ChevronIcon />
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {GROUPS.map((group) => (
          <NavGroup
            key={group.key}
            href={group.href}
            label={group.label}
            icon={group.icon}
            items={group.children}
            collapsed={collapsed}
            open={!shut.includes(group.key)}
            onToggle={() => toggleGroup(group.key)}
          />
        ))}

        {/* У статистики подразделов нет — стрелка ей не нужна. */}
        <NavLink
          href="/stats"
          label="Статистика"
          icon={<StatsIcon />}
          collapsed={collapsed}
        />

        {/* Раздел /settings открыт любому вошедшему (подраздел «Общие» —
            тема/аккаунт/смена пароля); «Администрирование» внутри него
            видно только админу, см. (admin)/settings/settings-tabs.tsx. */}
        <NavLink
          href="/settings"
          label="Настройки"
          icon={<SettingsIcon />}
          collapsed={collapsed}
        />

        {/* Кнопка «развернуть» переезжает сюда: когда меню свёрнуто, в шапке
            для неё нет места рядом с логотипом. */}
        {collapsed ? (
          <button
            type="button"
            onClick={toggleSidebar}
            title="Развернуть меню"
            aria-label="Развернуть меню"
            className="mt-1 hidden h-9 place-items-center rounded-lg text-muted transition hover:bg-border/40 hover:text-foreground md:grid"
          >
            <span className="rotate-180">
              <ChevronIcon />
            </span>
          </button>
        ) : null}
      </nav>
    </aside>
  );
}
