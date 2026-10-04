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
  {
    href: "/inbox",
    label: "Inbox",
    hint: "Черновики до привязки",
    color: "#38bdf8",
    Icon: IconInbox,
  },
  {
    href: "/principles",
    label: "Принципы",
    hint: "Правила",
    color: "#a855f7",
    Icon: IconBook,
  },
  {
    href: "/archive",
    label: "Архив",
    hint: "Закрытое",
    color: "#fb923c",
    Icon: IconArchive,
  },
  {
    href: "/settings",
    label: "Настройки",
    hint: "Тема, фокус, ёмкость",
    color: "#34d399",
    Icon: IconSettings,
  },
  {
    href: "/privacy",
    label: "Хранение данных",
    hint: "Как хранится ваш профиль",
    color: "#f472b6",
    Icon: IconShield,
  },
] as const;

export default function LifePage() {
  return (
    <div className="space-y-4">
      <PageHero
        kicker="Ещё"
        title="Ещё"
        lede="Inbox, принципы, архив и настройки."
      />
      <div className="bento">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="span-6 next-card rise-in !p-5">
            <span
              className="next-ico !h-11 !w-11 !rounded-2xl"
              style={{ color: l.color, background: `${l.color}22` }}
            >
              <l.Icon size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[1.25rem]">{l.label}</span>
              <span className="mt-1 block text-[14px] text-[var(--ink-soft)]">{l.hint}</span>
            </span>
            <span className="text-[var(--ink-faint)]">→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
