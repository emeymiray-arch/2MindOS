"use client";

import Link from "next/link";
import { Sparkline } from "@/components/ui/Charts";

export type WidgetTone = "violet" | "green" | "blue" | "orange" | "pink";

export function PageHero({
  kicker,
  title,
  lede,
  meta,
  action,
}: {
  kicker?: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  meta?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <header className="home-hero">
      <div className="min-w-0">
        {kicker ? <p className="page-kicker">{kicker}</p> : null}
        <h1 className="page-title text-[2rem] md:text-[2.4rem]">{title}</h1>
        {lede ? <p className="page-lede mt-2">{lede}</p> : null}
        {meta ? <div className="mt-2 flex flex-wrap gap-1.5">{meta}</div> : null}
      </div>
      {action ? <div className="home-clock shrink-0">{action}</div> : null}
    </header>
  );
}

export function WidgetHead({
  title,
  action,
  tone = "violet",
}: {
  title: string;
  action?: React.ReactNode;
  tone?: WidgetTone;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="widget-title" data-tone={tone}>
        {title}
      </h2>
      {action}
    </div>
  );
}

export function KpiTile({
  label,
  value,
  hint,
  color,
  icon,
  series,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  color: string;
  icon: React.ReactNode;
  series?: number[];
}) {
  return (
    <div className="kpi-card kpi-tile h-full">
      <div className="flex items-start justify-between gap-2">
        <span className="kpi-ico" style={{ background: `${color}22`, color }}>
          {icon}
        </span>
        {series?.length ? <Sparkline values={series} color={color} width={72} height={26} /> : null}
      </div>
      <p className="kpi-value mt-3">{value}</p>
      <p className="kpi-label">{label}</p>
      {hint ? <p className="kpi-hint">{hint}</p> : null}
    </div>
  );
}

export function ViewAllLink({ href, label = "все →" }: { href: string; label?: string }) {
  return (
    <Link href={href} className="text-[12px] font-semibold text-[var(--accent)]">
      {label}
    </Link>
  );
}
