"use client";

import { useId, useMemo, useState, type CSSProperties } from "react";

/** Lightweight SVG charts — no chart library, CSS motion only. */

export function Sparkline({
  values,
  color = "var(--accent)",
  width = 88,
  height = 28,
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);
  const pts = values
    .map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * width;
      const y = height - ((v - min) / span) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <polyline
        className="chart-draw"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts}
        style={{ filter: `drop-shadow(0 0 4px ${color})` }}
      />
    </svg>
  );
}

export function DonutChart({
  segments,
  size = 168,
  thickness = 16,
  centerLabel,
  centerSub,
}: {
  segments: { value: number; color: string; label: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerSub?: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const activeSeg = segments.find((s) => s.label === active);
  const showLabel = activeSeg
    ? String(activeSeg.value)
    : centerLabel;
  const showSub = activeSeg ? activeSeg.label : centerSub;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="progress-ring chart-spin-in"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={thickness}
          />
          {segments.map((seg, i) => {
            const value = Math.max(0, seg.value);
            const len = (value / total) * c;
            const isActive = active === seg.label;
            const el = (
              <circle
                key={seg.label}
                className="chart-arc"
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={isActive ? thickness + 3 : thickness}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
                opacity={active && !isActive ? 0.35 : 1}
                style={{
                  filter: `drop-shadow(0 0 ${isActive ? 12 : 6}px ${seg.color})`,
                  transition: "opacity 0.2s ease, stroke-width 0.2s ease",
                  animationDelay: `${0.05 + i * 0.06}s`,
                  cursor: value > 0 ? "pointer" : "default",
                }}
                onMouseEnter={() => value > 0 && setActive(seg.label)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => value > 0 && setActive(seg.label)}
                onBlur={() => setActive(null)}
              >
                <title>
                  {seg.label}: {seg.value}
                </title>
              </circle>
            );
            offset += len;
            return el;
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {showLabel ? (
            <p className="text-[1.55rem] font-semibold tabular-nums tracking-tight transition-all">
              {showLabel}
            </p>
          ) : null}
          {showSub ? (
            <p className="max-w-[7rem] truncate text-[11px] font-medium text-[var(--ink-faint)]">
              {showSub}
            </p>
          ) : null}
        </div>
      </div>
      <ul className="flex flex-wrap justify-center gap-2">
        {segments.map((seg) => (
          <li key={seg.label}>
            <button
              type="button"
              className="chart-legend"
              data-active={active === seg.label}
              onMouseEnter={() => seg.value > 0 && setActive(seg.label)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => seg.value > 0 && setActive(seg.label)}
              onBlur={() => setActive(null)}
            >
              <span className="chart-legend-dot" style={{ background: seg.color }} />
              {seg.label}
              <span className="tabular-nums text-[var(--ink-faint)]">{seg.value}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LineChart({
  values,
  labels,
  height = 160,
  color = "#a855f7",
}: {
  values: number[];
  labels?: string[];
  height?: number;
  color?: string;
}) {
  const gid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const width = 420;
  const pad = 14;
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => {
    const x = pad + (i / Math.max(values.length - 1, 1)) * (width - pad * 2);
    const y = height - pad - (v / max) * (height - pad * 2);
    return { x, y, v };
  });
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const area = `${d} L${pts[pts.length - 1].x},${height - pad} L${pts[0].x},${height - pad} Z`;
  const tip = hover != null ? pts[hover] : null;

  return (
    <div className="relative w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`lineFill-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.45" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path className="chart-area-in" d={area} fill={`url(#lineFill-${gid})`} />
        <path
          className="chart-draw"
          d={d}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 10px ${color})` }}
        />
        {pts.map((p, i) => (
          <g key={i} onMouseEnter={() => setHover(i)}>
            <circle
              cx={p.x}
              cy={p.y}
              r={hover === i ? 6 : 3.5}
              fill="#fff"
              stroke={color}
              strokeWidth="2"
              style={{ transition: "r 0.15s ease", cursor: "pointer" }}
            />
            <circle cx={p.x} cy={p.y} r="12" fill="transparent" />
          </g>
        ))}
        {tip ? (
          <g>
            <line
              x1={tip.x}
              x2={tip.x}
              y1={pad}
              y2={height - pad}
              stroke={color}
              strokeOpacity="0.35"
              strokeDasharray="3 3"
            />
            <rect
              x={Math.min(Math.max(tip.x - 22, 4), width - 48)}
              y={Math.max(tip.y - 28, 4)}
              width="44"
              height="20"
              rx="6"
              fill="rgba(12,8,22,0.92)"
              stroke={color}
              strokeOpacity="0.5"
            />
            <text
              x={Math.min(Math.max(tip.x, 26), width - 26)}
              y={Math.max(tip.y - 14, 18)}
              textAnchor="middle"
              fill="#fff"
              fontSize="11"
              fontWeight="600"
            >
              {tip.v}%
            </text>
          </g>
        ) : null}
      </svg>
      {labels?.length ? (
        <div className="mt-1 flex justify-between px-1 text-[10px] font-medium text-[var(--ink-faint)]">
          {labels.map((l, i) => (
            <span key={`${l}-${i}`} data-hot={hover === i} className="chart-axis-label">
              {l}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function VBarChart({
  items,
  height = 140,
}: {
  items: { label: string; value: number; max?: number; color: string }[];
  height?: number;
}) {
  const [active, setActive] = useState<string | null>(null);
  const max = Math.max(...items.map((i) => i.max ?? i.value), 1);
  return (
    <div className="flex h-full items-end gap-1.5" style={{ minHeight: height }}>
      {items.map((item, i) => {
        const pct = Math.max(4, Math.round((item.value / max) * 100));
        const hot = active === item.label;
        return (
          <button
            key={item.label}
            type="button"
            className="chart-vbar"
            style={{ animationDelay: `${0.04 + i * 0.04}s` }}
            data-active={hot}
            onMouseEnter={() => setActive(item.label)}
            onMouseLeave={() => setActive(null)}
            title={`${item.label}: ${item.value}`}
          >
            <span className="chart-vbar-tip tabular-nums">{hot || item.value > 0 ? item.value : ""}</span>
            <span
              className="chart-vbar-fill"
              style={{
                height: `${pct}%`,
                background: `linear-gradient(180deg, ${item.color} 0%, color-mix(in srgb, ${item.color} 55%, #1e1035) 100%)`,
                boxShadow: hot ? `0 0 16px ${item.color}` : `0 0 10px color-mix(in srgb, ${item.color} 45%, transparent)`,
              }}
            />
            <span className="chart-vbar-label">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function HBar({
  items,
}: {
  items: { label: string; value: number; max?: number; color?: string }[];
}) {
  const max = Math.max(...items.map((i) => i.max ?? i.value), 1);
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={item.label}>
          <div className="mb-1 flex justify-between text-[12px] font-medium">
            <span className="truncate text-[var(--ink-soft)]">{item.label}</span>
            <span className="tabular-nums text-[var(--ink)]">{item.value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
            <div
              className="chart-hbar-fill h-full rounded-full"
              style={{
                width: `${Math.round((item.value / max) * 100)}%`,
                background: item.color ?? "linear-gradient(90deg, #7c3aed, #c084fc)",
                boxShadow: "0 0 14px rgba(168,85,247,0.4)",
                animationDelay: `${0.05 + i * 0.05}s`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProgressRing({
  percent,
  size = 140,
  color = "var(--accent)",
  label,
  track = "rgba(255,255,255,0.08)",
}: {
  percent: number;
  size?: number;
  color?: string;
  label?: string;
  track?: string;
}) {
  const p = Math.max(0, Math.min(100, percent));
  const thickness = 12;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const filled = (p / 100) * c;
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="progress-ring">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={track}
          strokeWidth={thickness}
        />
        <circle
          className="chart-ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeDasharray={`${filled} ${c - filled}`}
          strokeLinecap="round"
          style={
            {
              filter: `drop-shadow(0 0 8px ${color})`,
              "--ring-len": c,
            } as CSSProperties
          }
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-[1.75rem] font-semibold tabular-nums tracking-tight">{p}%</p>
        {label ? <p className="text-[11px] font-medium text-[var(--ink-faint)]">{label}</p> : null}
      </div>
    </div>
  );
}

export function DualRing({
  outer,
  inner,
  size = 156,
}: {
  outer: { percent: number; color: string; label: string };
  inner: { percent: number; color: string; label: string };
  size?: number;
}) {
  const rings = useMemo(
    () => [
      { ...outer, thickness: 12, inset: 0 },
      { ...inner, thickness: 10, inset: 18 },
    ],
    [outer, inner]
  );
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="progress-ring">
        {rings.map((ring, idx) => {
          const s = size - ring.inset * 2;
          const r = (s - ring.thickness) / 2;
          const c = 2 * Math.PI * r;
          const p = Math.max(0, Math.min(100, ring.percent));
          const filled = (p / 100) * c;
          const cx = size / 2;
          const cy = size / 2;
          return (
            <g key={ring.label}>
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth={ring.thickness}
              />
              <circle
                className="chart-ring-fill"
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={ring.color}
                strokeWidth={ring.thickness}
                strokeDasharray={`${filled} ${c - filled}`}
                strokeLinecap="round"
                style={
                  {
                    filter: `drop-shadow(0 0 8px ${ring.color})`,
                    animationDelay: `${0.08 + idx * 0.12}s`,
                    "--ring-len": c,
                  } as CSSProperties
                }
              />
            </g>
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <p className="text-[1.45rem] font-semibold tabular-nums">{outer.percent}%</p>
        <p className="text-[10px] font-medium text-[var(--ink-faint)]">{outer.label}</p>
        <p className="mt-1 text-[12px] font-semibold tabular-nums" style={{ color: inner.color }}>
          {inner.percent}% · {inner.label}
        </p>
      </div>
    </div>
  );
}
