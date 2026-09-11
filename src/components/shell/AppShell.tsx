"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

const NAV = [
  { href: "/", label: "Главная" },
  { href: "/goals", label: "Цели" },
  { href: "/analytics", label: "Аналитика" },
  { href: "/finance", label: "Финансы" },
  { href: "/life", label: "Ещё" },
] as const;

const MOBILE = [
  { href: "/", label: "Сегодня" },
  { href: "/goals", label: "Цели" },
  { href: "/analytics", label: "Аналитика" },
  { href: "/finance", label: "Финансы" },
  { href: "/life", label: "Ещё" },
] as const;

const WIDE = ["/archive"];

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
  const wide = WIDE.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  useEffect(() => {
    try {
      const saved = localStorage.getItem("mindos-theme");
      if (saved === "dark" || saved === "light") persistTheme(saved);
    } catch {
      /* ignore */
    }
    // Theme/settings from server can wait — don't compete with page data.
    const t = window.setTimeout(() => {
      fetch("/api/state", { credentials: "include" })
        .then((r) => r.json())
        .then((s) => {
          const theme = s.settings?.theme === "dark" ? "dark" : "light";
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
    }, 1200);
    return () => window.clearTimeout(t);
  }, []);

  function active(href: string) {
    if (href === "/") return pathname === "/";
    if (href === "/life") {
      return (
        pathname === "/life" ||
        pathname.startsWith("/wishlist") ||
        pathname.startsWith("/habits") ||
        pathname.startsWith("/settings") ||
        pathname.startsWith("/archive")
      );
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="flex min-h-full pb-[4.5rem] md:pb-0">
      <aside className="sticky top-0 hidden h-screen w-[var(--sidebar-w)] shrink-0 flex-col border-r border-[var(--line)] bg-[var(--bg-panel)]/80 px-5 py-8 backdrop-blur-md md:flex">
        <Link href="/" className="mb-10 px-2">
          <p className="font-display text-[28px] text-[var(--ink)]">2Mind</p>
        </Link>
        <nav className="flex flex-col gap-0.5">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              data-active={active(item.href)}
              className={`nav-link ${
                active(item.href) ? "" : "text-[var(--ink-soft)] hover:bg-[var(--bg-muted)]"
              }`}
            >
              <span className="nav-dot" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto" />
      </aside>

      <main className="min-w-0 flex-1">
        <div
          key={pathname}
          className={
            wide
              ? "page-enter w-full"
              : "page-enter mx-auto w-full max-w-[42rem] px-5 py-8 md:px-12 md:py-12"
          }
        >
          {children}
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex gap-1 border-t border-[var(--line)] bg-[var(--bg-panel)]/95 px-2 py-2 backdrop-blur-md md:hidden">
        {MOBILE.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center rounded-xl px-1 py-2 text-[11px] font-semibold ${
              active(item.href)
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "text-[var(--ink-faint)]"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
