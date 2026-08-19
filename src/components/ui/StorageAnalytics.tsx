"use client";

type Segment = {
  label: string;
  value: number;
  color: string;
};

export function StorageAnalytics({
  title,
  subtitle,
  segments,
  centerLabel,
  centerValue,
}: {
  title: string;
  subtitle?: string;
  segments: Segment[];
  centerLabel: string;
  centerValue: string;
}) {
  const total = Math.max(
    1,
    segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0)
  );
  const normalized = segments.map((segment) => ({
    ...segment,
    value: Math.max(0, segment.value),
  }));

  let acc = 0;
  const circles = normalized.map((segment) => {
    const part = segment.value / total;
    const dash = part * 100;
    const offset = 100 - acc;
    acc += dash;
    return { ...segment, dash, offset };
  });

  return (
    <section className="card p-5">
      <div className="mb-4">
        <p className="text-[12px] font-medium text-[var(--ink-faint)]">{title}</p>
        {subtitle ? <p className="mt-1 text-[13px] text-[var(--ink-soft)]">{subtitle}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-6">
        <div className="storage-ring">
          <svg viewBox="0 0 42 42" className="storage-ring-svg" aria-hidden="true">
            <circle cx="21" cy="21" r="15.915" className="storage-ring-bg" />
            {circles.map((segment) => (
              <circle
                key={segment.label}
                cx="21"
                cy="21"
                r="15.915"
                fill="none"
                stroke={segment.color}
                strokeWidth="3.6"
                strokeDasharray={`${segment.dash} ${100 - segment.dash}`}
                strokeDashoffset={segment.offset}
                strokeLinecap="round"
                transform="rotate(-90 21 21)"
              />
            ))}
          </svg>
          <div className="storage-ring-center">
            <p className="storage-ring-value">{centerValue}</p>
            <p className="storage-ring-label">{centerLabel}</p>
          </div>
        </div>
        <ul className="min-w-[180px] flex-1 space-y-2">
          {normalized.map((segment) => {
            const pct = Math.round((segment.value / total) * 100);
            return (
              <li key={segment.label} className="flex items-center justify-between gap-3 text-[13px]">
                <span className="inline-flex items-center gap-2">
                  <span className="storage-dot" style={{ background: segment.color }} />
                  <span>{segment.label}</span>
                </span>
                <span className="tabular-nums text-[var(--ink-faint)]">{pct}%</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
