import type { ReactNode } from "react";

export function ProgressRing({
  value,
  size = 64,
  stroke = 6,
  expected,
}: {
  value: number;
  size?: number;
  stroke?: number;
  expected?: number | null;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const offset = c - (pct / 100) * c;
  const exp = expected == null ? null : Math.max(0, Math.min(100, expected));
  const expOffset = exp == null ? null : c - (exp / 100) * c;

  return (
    <div className="relative inline-flex" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="progress-ring">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--bg-muted)"
          strokeWidth={stroke}
        />
        {expOffset != null ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="color-mix(in srgb, var(--ink-faint) 40%, transparent)"
            strokeWidth={stroke}
            strokeDasharray={c}
            strokeDashoffset={expOffset}
            strokeLinecap="round"
          />
        ) : null}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[12px] font-bold tabular-nums">
        {pct}%
      </span>
    </div>
  );
}

export function StatusChip({
  status,
  label,
}: {
  status: "ahead" | "on_track" | "behind" | "no_plan";
  label: string;
}) {
  return <span className={`status-${status}`}>{label}</span>;
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="surface px-6 py-11 text-center">
      <p className="font-display text-[22px]">{title}</p>
      {body ? (
        <p className="mx-auto mt-2 max-w-sm text-[14px] text-[var(--ink-soft)]">{body}</p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
