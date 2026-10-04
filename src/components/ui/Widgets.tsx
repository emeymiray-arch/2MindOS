"use client";

import Link from "next/link";
import { Sparkline } from "@/components/ui/Charts";

export type WidgetTone = "violet" | "green" | "blue" | "orange" | "pink";

export function PageHero({
  title,
  action,
  meta,
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
        <h1 className="page-title text-[1.85rem] md:text-[2.25rem]">{title}</h1>
        {meta ? <div className="home-hero-meta">{meta}</div> : null}
      </div>
      {action ? <div className="home-hero-action shrink-0">{action}</div> : null}
    </header>
  );
}

export function WidgetHead({
  title,
  action,
  tone = "violet",
  icon,
}: {
  title: string;
  action?: React.ReactNode;
  tone?: WidgetTone;
  icon?: React.ReactNode;
}) {
  return (
    <div className="widget-head">
      <div className="widget-head-left">
        {icon ? (
          <span className="widget-head-ico" data-tone={tone}>
            {icon}
          </span>
        ) : (
          <span className="widget-dot" data-tone={tone} aria-hidden />
        )}
        <h2 className="widget-title">{title}</h2>
      </div>
      {action ? <div className="widget-head-action">{action}</div> : null}
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
  icon?: React.ReactNode;
  series?: number[];
}) {
  return (
    <div className="kpi-card kpi-tile h-full">
      <div className="kpi-tile-top">
        <p className="kpi-label">{label}</p>
        {icon ? (
          <span className="kpi-ico" style={{ color, background: `${color}1f` }}>
            {icon}
          </span>
        ) : null}
      </div>
      <div className="kpi-tile-main">
        <p className="kpi-value">{value}</p>
        {series?.length ? (
          <Sparkline values={series} color={color} width={64} height={22} />
        ) : null}
      </div>
      {hint ? <p className="kpi-hint">{hint}</p> : null}
    </div>
  );
}

export function ViewAllLink({ href, label = "все →" }: { href: string; label?: string }) {
  return (
    <Link href={href} className="widget-link">
      {label}
    </Link>
  );
}
