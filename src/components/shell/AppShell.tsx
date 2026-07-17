"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/", label: "Пульт" },
  { href: "/tasks", label: "Задачи" },
  { href: "/goals", label: "Цели" },
  { href: "/wishes", label: "Wish list" },
  { href: "/mind", label: "Мысли" },
  { href: "/graph", label: "Карта" },
  { href: "/projects", label: "Проекты" },
  { href: "/capital", label: "Капитал" },
  { href: "/passwords", label: "Пароли" },
  { href: "/oracle", label: "Oracle" },
  { href: "/settings", label: "Настройки" },
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
        <Link href="/" className="mb-6 px-3">
          <div className="text-[15px] font-semibold tracking-[-0.02em]">2MindOS</div>
        </Link>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto scroll-thin">
          {NAV.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
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
      </aside>
      <main className="min-w-0 flex-1 px-5 py-7 md:px-10 md:py-9">
        <div key={pathname} className="page-enter">
          {children}
        </div>
      </main>
    </div>
  );
}
