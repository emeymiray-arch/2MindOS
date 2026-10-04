/** Lightweight SVG charts — no chart library. */

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
  size = 148,
  thickness = 14,
  centerLabel,
  centerSub,
}: {
  segments: { value: number; color: string; label: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerSub?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="progress-ring">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={thickness}
        />
        {segments.map((seg) => {
          const len = (seg.value / total) * c;
          const el = (
            <circle
              key={seg.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={thickness}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 6px ${seg.color})` }}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        {centerLabel ? (
          <p className="text-[1.5rem] font-semibold tabular-nums tracking-tight">{centerLabel}</p>
        ) : null}
        {centerSub ? <p className="text-[11px] font-medium text-[var(--ink-faint)]">{centerSub}</p> : null}
      </div>
    </div>
  );
}

export function LineChart({
  values,
  labels,
  height = 160,
}: {
  values: number[];
  labels?: string[];
  height?: number;
}) {
  const width = 420;
  const pad = 12;
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => {
    const x = pad + (i / Math.max(values.length - 1, 1)) * (width - pad * 2);
    const y = height - pad - (v / max) * (height - pad * 2);
    return { x, y, v };
  });
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const area = `${d} L${pts[pts.length - 1].x},${height - pad} L${pts[0].x},${height - pad} Z`;
  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img">
        <defs>
          <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(168,85,247,0.45)" />
            <stop offset="100%" stopColor="rgba(168,85,247,0)" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#lineFill)" />
        <path
          d={d}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{ filter: "drop-shadow(0 0 10px rgba(168,85,247,0.65))" }}
        />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#fff" stroke="var(--accent)" strokeWidth="2" />
        ))}
      </svg>
      {labels?.length ? (
        <div className="mt-1 flex justify-between px-1 text-[10px] font-medium text-[var(--ink-faint)]">
          {labels.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
      ) : null}
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
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex justify-between text-[12px] font-medium">
            <span className="truncate text-[var(--ink-soft)]">{item.label}</span>
            <span className="tabular-nums text-[var(--ink)]">{item.value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.round((item.value / max) * 100)}%`,
                background: item.color ?? "linear-gradient(90deg, #7c3aed, #c084fc)",
                boxShadow: "0 0 14px rgba(168,85,247,0.4)",
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
}: {
  percent: number;
  size?: number;
  color?: string;
  label?: string;
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
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={thickness}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeDasharray={`${filled} ${c - filled}`}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 8px ${color})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-[1.75rem] font-semibold tabular-nums tracking-tight">{p}%</p>
        {label ? <p className="text-[11px] font-medium text-[var(--ink-faint)]">{label}</p> : null}
      </div>
    </div>
  );
}
