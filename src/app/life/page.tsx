import Link from "next/link";
import {
  IconArchive,
  IconBook,
  IconInbox,
  IconSettings,
  IconShield,
} from "@/components/ui/Icons";
import { PageHero } from "@/components/ui/Widgets";

const LINKS = [
  { href: "/inbox", label: "Inbox", hint: "Черновики", color: "#38bdf8", Icon: IconInbox },
  { href: "/principles", label: "Принципы", hint: "Правила", color: "#a855f7", Icon: IconBook },
  { href: "/archive", label: "Архив", hint: "Закрытое", color: "#fb923c", Icon: IconArchive },
  { href: "/settings", label: "Настройки", hint: "Профиль", color: "#34d399", Icon: IconSettings },
  { href: "/privacy", label: "Данные", hint: "Хранение", color: "#f472b6", Icon: IconShield },
] as const;

export default function LifePage() {
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
      </div>
    </div>
  );
}
