"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ComponentType } from "react";
import {
  IconCalendar,
  IconChart,
  IconHabits,
  IconHome,
  IconInbox,
  IconMap,
  IconPath,
  IconWallet,
  IconWish,
} from "@/components/ui/Icons";
import { isAccentColor, persistAccent, type AccentColor } from "@/lib/accent";

type NavItem = {
  href: string;
  label: string;
  short: string;
  Icon: ComponentType<{ size?: number }>;
};

const NAV: NavItem[] = [
  { href: "/", label: "Сегодня", short: "Сегодня", Icon: IconHome },
  { href: "/goals", label: "Цели", short: "Цели", Icon: IconPath },
  { href: "/habits", label: "Привычки", short: "Ритм", Icon: IconHabits },
  { href: "/map", label: "Карта", short: "Карта", Icon: IconMap },
  { href: "/calendar", label: "Календарь", short: "Календ.", Icon: IconCalendar },
  { href: "/analytics", label: "Аналитика", short: "Аналит.", Icon: IconChart },
  { href: "/finance", label: "Финансы", short: "Финансы", Icon: IconWallet },
  { href: "/wishlist", label: "Wishlist", short: "Wish", Icon: IconWish },
  { href: "/inbox", label: "Inbox", short: "Inbox", Icon: IconInbox },
];

const MOBILE_NAV = [
  NAV[0], // Сегодня
  NAV[1], // Цели
  NAV[2], // Привычки
  NAV[6], // Финансы
  NAV[8], // Inbox
];

const WIDE = ["/calendar", "/analytics"];

function persistTheme(theme: "light" | "dark") {
  try {
    localStorage.setItem("mindos-theme", theme);
  } catch {
    /* ignore */
  }
  document.documentElement.setAttribute("data-theme", theme);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");
  const isPrivacy = pathname?.startsWith("/privacy");
  const bare = isAdmin || isPrivacy;
  const wide = WIDE.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  useEffect(() => {
    try {
      const saved = localStorage.getItem("mindos-theme");
      if (saved === "dark" || saved === "light") persistTheme(saved);
      else persistTheme("dark");
      const accent = localStorage.getItem("mindos-accent");
      if (isAccentColor(accent)) persistAccent(accent);
      else persistAccent("green");
    } catch {
      persistTheme("dark");
      persistAccent("green");
    }
    if (bare) return;
    const t = window.setTimeout(() => {
      fetch("/api/state", { credentials: "include" })
        .then((r) => r.json())
        .then((s) => {
          const theme = s.settings?.theme === "light" ? "light" : "dark";
          persistTheme(theme);
          const accent = s.settings?.accentColor as AccentColor | undefined;
          if (isAccentColor(accent)) persistAccent(accent);
          document.documentElement.setAttribute(
            "data-compact",
            s.settings?.compactMode ? "true" : "false"
          );
          document.documentElement.setAttribute(
            "data-reduce-motion",
            s.settings?.reduceMotion ? "true" : "false"
          );
        })
        .catch(() => undefined);
    }, 1200);
    return () => window.clearTimeout(t);
  }, [bare]);

  if (bare) {
    return (
      <div className="admin-shell">
        <div className="aurora" aria-hidden>
          <div className="aurora-veil" />
        </div>
        <div className="admin-shell-inner">{children}</div>
      </div>
    );
  }

  function active(href: string) {
    if (href === "/") return pathname === "/";
    if (href === "/inbox") {
      return (
        pathname === "/inbox" ||
        pathname.startsWith("/settings") ||
        pathname.startsWith("/principles") ||
        pathname.startsWith("/archive") ||
        pathname.startsWith("/life")
      );
    }
    if (href === "/map") {
      return pathname === "/map" || pathname.startsWith("/directions");
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="shell">
      <div className="aurora" aria-hidden>
        <div className="aurora-veil" />
      </div>
      <aside className="shell-rail">
        <Link href="/" className="shell-brand">
          <p className="shell-brand-mark">2Mind</p>
          <p className="shell-brand-sub">life os</p>
        </Link>
        <nav className="shell-nav">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              data-active={active(item.href)}
              className="nav-link"
            >
              <span className="nav-ico">
                <item.Icon size={18} />
              </span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      <main className="shell-main">
        <div
          key={pathname}
          className={`page-enter ${wide ? "shell-main-inner is-wide" : "shell-main-inner"}`}
        >
          {children}
        </div>
      </main>

      <nav className="shell-mobile shell-mobile-wide" aria-label="Основное меню">
        {MOBILE_NAV.map((item) => (
          <Link key={item.href} href={item.href} data-active={active(item.href)}>
            <span className="nav-ico">
              <item.Icon size={18} />
            </span>
            <span>{item.short}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
