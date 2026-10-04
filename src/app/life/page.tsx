import Link from "next/link";

const LINKS = [
  { href: "/map", label: "Карта", hint: "Направления жизни" },
  { href: "/analytics", label: "Аналитика", hint: "План и факт" },
  { href: "/wishlist", label: "Wishlist", hint: "Покупки и желания" },
  { href: "/inbox", label: "Inbox", hint: "Черновики до привязки" },
  { href: "/principles", label: "Принципы", hint: "Правила" },
  { href: "/archive", label: "Архив", hint: "Закрытое" },
  { href: "/settings", label: "Настройки", hint: "Тема, фокус, ёмкость" },
  { href: "/privacy", label: "Хранение данных", hint: "Как хранится ваш профиль" },
] as const;

export default function LifePage() {
  return (
    <div className="space-y-8">
      <header>
        <p className="page-kicker">Ещё</p>
        <h1 className="page-title text-[2.2rem] md:text-[2.6rem]">Ещё</h1>
        <p className="page-lede">Карта, аналитика, inbox и настройки.</p>
      </header>
      <div className="bento">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="span-6 panel rise-in flex items-center justify-between gap-4 transition"
          >
            <div>
              <p className="font-display text-[1.25rem]">{l.label}</p>
              <p className="mt-1 text-[14px] text-[var(--ink-soft)]">{l.hint}</p>
            </div>
            <span className="text-[var(--ink-faint)]">→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
