"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  IconArchive,
  IconBook,
  IconInbox,
  IconSettings,
  IconShield,
  IconTarget,
} from "@/components/ui/Icons";
import { PageHero } from "@/components/ui/Widgets";
import { apiGet } from "@/lib/client-api";

const LINKS = [
  { href: "/inbox", label: "Inbox", hint: "Черновики", color: "#38bdf8", Icon: IconInbox },
  { href: "/principles", label: "Принципы", hint: "Правила", color: "#a855f7", Icon: IconBook },
  { href: "/archive", label: "Архив", hint: "Закрытое", color: "#fb923c", Icon: IconArchive },
  { href: "/settings", label: "Настройки", hint: "Профиль", color: "#34d399", Icon: IconSettings },
  { href: "/privacy", label: "Данные", hint: "Хранение", color: "#f472b6", Icon: IconShield },
] as const;

export default function LifePage() {
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => {
    void apiGet("/api/auth").then((res) => {
      if (!res.ok) return;
      const d = res.data as { isAdmin?: boolean; login?: string };
      setShowAdmin(Boolean(d.isAdmin) || d.login === "owner");
    });
  }, []);

  return (
    <div className="page-stack">
      <PageHero title="Ещё" />
      <div className="bento">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="span-6 next-card life-tile rise-in">
            <span className="next-ico" style={{ color: l.color, background: `${l.color}22` }}>
              <l.Icon size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[1.05rem] font-semibold tracking-tight">{l.label}</span>
              <span className="mt-1 block text-[13px] text-[var(--ink-faint)]">{l.hint}</span>
            </span>
          </Link>
        ))}
        {showAdmin ? (
          <Link href="/admin" className="span-6 next-card life-tile rise-in">
            <span className="next-ico" style={{ color: "#c084fc", background: "#c084fc22" }}>
              <IconTarget size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[1.05rem] font-semibold tracking-tight">Админ</span>
              <span className="mt-1 block text-[13px] text-[var(--ink-faint)]">Клиенты</span>
            </span>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
