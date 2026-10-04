"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** Mental model: Today → Path → Calendar → Money → Habits → Wishlist → More */
const NAV = [
  { href: "/", label: "Сегодня" },
  { href: "/goals", label: "Путь" },
  { href: "/calendar", label: "Календарь" },
  { href: "/finance", label: "Финансы" },
  { href: "/habits", label: "Привычки" },
  { href: "/wishlist", label: "Wishlist" },
  { href: "/life", label: "Ещё" },
] as const;

/** Compact mobile strip — full set lives in the side rail. */
const MOBILE_NAV = [
  { href: "/", label: "Сегодня" },
  { href: "/goals", label: "Путь" },
  { href: "/finance", label: "Финансы" },
  { href: "/habits", label: "Привычки" },
  { href: "/life", label: "Ещё" },
] as const;

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
    } catch {
      persistTheme("dark");
    }
    if (bare) return;
    const t = window.setTimeout(() => {
      fetch("/api/state", { credentials: "include" })
        .then((r) => r.json())
        .then((s) => {
          const theme = s.settings?.theme === "light" ? "light" : "dark";
          persistTheme(theme);
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
    }, 4000);
    return () => window.clearTimeout(t);
  }, [bare]);

  if (bare) {
    return (
      <div className="admin-shell">
        <div className="aurora" aria-hidden>
          <img className="aurora-scene" src="/bg/scene-3d.jpg" alt="" draggable={false} />
          <div className="aurora-veil" />
        </div>
        <div className="admin-shell-inner">{children}</div>
      </div>
    );
  }

  function active(href: string) {
    if (href === "/") return pathname === "/";
    if (href === "/life") {
      return (
        pathname === "/life" ||
        pathname.startsWith("/settings") ||
        pathname.startsWith("/inbox") ||
        pathname.startsWith("/principles") ||
        pathname.startsWith("/map") ||
        pathname.startsWith("/directions") ||
        pathname.startsWith("/analytics") ||
        pathname.startsWith("/archive")
      );
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="shell">
      <div className="aurora" aria-hidden>
        <img className="aurora-scene" src="/bg/scene-3d.jpg" alt="" draggable={false} />
        <div className="aurora-veil" />
      </div>
      <aside className="shell-rail">
        <Link href="/" className="shell-brand">
          <p className="shell-brand-mark">2Mind</p>
          <p className="shell-brand-sub">life quest</p>
        </Link>
        <nav className="shell-nav">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              data-active={active(item.href)}
              className="nav-link"
            >
              {item.label}
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

      <nav className="shell-mobile" aria-label="Основное меню">
        {MOBILE_NAV.map((item) => (
          <Link key={item.href} href={item.href} data-active={active(item.href)}>
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
