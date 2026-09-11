import Link from "next/link";

const LINKS = [
  {
    href: "/wishlist",
    label: "Wishlist",
    color: "var(--c-pink)",
    soft: "var(--c-pink-soft)",
  },
  {
    href: "/habits",
    label: "Привычки",
    color: "var(--c-green)",
    soft: "var(--c-green-soft)",
  },
  {
    href: "/archive",
    label: "Архив",
    color: "var(--c-violet)",
    soft: "var(--c-violet-soft)",
  },
  {
    href: "/settings",
    label: "Настройки",
    color: "var(--c-orange)",
    soft: "var(--c-orange-soft)",
  },
] as const;

export default function LifePage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-[34px]">Ещё</h1>
      </header>
      <div className="space-y-2.5">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="surface flex items-center gap-4 p-4 transition hover:shadow-[var(--shadow)]"
            style={{ background: l.soft, borderLeft: `4px solid ${l.color}` }}
          >
            <p className="text-[16px] font-bold" style={{ color: l.color }}>
              {l.label}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
