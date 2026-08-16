"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/now", label: "Now" },
  { href: "/goals", label: "Goals" },
  { href: "/week", label: "Week" },
  { href: "/today", label: "Today" },
  { href: "/habits", label: "Habits" },
  { href: "/mind", label: "Second Brain" },
  { href: "/things", label: "Things" },
  { href: "/projects", label: "Projects" },
  { href: "/settings", label: "Settings" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    fetch("/api/state")
      .then((r) => r.json())
      .then((s) => {
        const t = s.settings?.theme === "dark" ? "dark" : "light";
        setTheme(t);
        document.documentElement.setAttribute("data-theme", t);
      })
      .catch(() => undefined);
  }, [pathname]);

  return (
    <div className="flex min-h-full">
      <aside className="sticky top-0 flex h-screen w-[var(--sidebar-w)] shrink-0 flex-col border-r border-[var(--line)] bg-[var(--bg-panel)]/95 px-3 py-5 backdrop-blur-xl">
        <Link href="/now" className="mb-6 px-3">
          <div className="text-[15px] font-semibold tracking-[-0.02em]">2MindOS</div>
        </Link>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto scroll-thin">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-[12px] px-3 py-2.5 text-[13px] font-semibold transition-colors ${
                  active
                    ? "bg-[var(--ink)] text-[var(--bg-card)]"
                    : "text-[var(--ink-soft)] hover:bg-[var(--bg)] hover:text-[var(--ink)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-2 border-t border-[var(--line)] px-3 pt-4 text-[11px] text-[var(--ink-faint)]">
          <p className="font-semibold uppercase tracking-[0.06em]">Ещё</p>
          <Link href="/capital" className="block hover:text-[var(--ink-soft)]">
            Капитал
          </Link>
          <Link href="/passwords" className="block hover:text-[var(--ink-soft)]">
            Пароли
          </Link>
          <Link href="/oracle" className="block hover:text-[var(--ink-soft)]">
            Oracle
          </Link>
          <Link href="/graph" className="block hover:text-[var(--ink-soft)]">
            Карта
          </Link>
          <Link href="/horizon" className="block hover:text-[var(--ink-soft)]">
            Horizon
          </Link>
          <span className="block opacity-40">{theme}</span>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-5 py-7 md:px-10 md:py-9">
        <div key={pathname} className="page-enter">
          {children}
        </div>
      </main>
    </div>
  );
}
