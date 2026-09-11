"use client";

import { useCallback, useEffect, useState } from "react";
import { HistoryMap } from "@/components/history/HistoryMap";
import type { TimelineEvent, TimelineRange } from "@/lib/timeline";

type TimelinePayload = {
  range: TimelineRange;
  from: string;
  to: string;
  events: TimelineEvent[];
  total: number;
  hasMore: boolean;
  nextBefore?: string;
};

const RANGES: { id: TimelineRange; label: string }[] = [
  { id: "day", label: "День" },
  { id: "week", label: "Неделя" },
  { id: "month", label: "Месяц" },
  { id: "half", label: "Полгода" },
  { id: "year", label: "Год" },
];

export default function ArchivePage() {
  const [range, setRange] = useState<TimelineRange>("month");
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [nextBefore, setNextBefore] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchTimeline = useCallback(
    async (opts: { append?: boolean; before?: string } = {}) => {
      const params = new URLSearchParams({ range, limit: "500" });
      if (opts.before) params.set("before", opts.before);
      const res = await fetch(`/api/timeline?${params}`, { credentials: "include" });
      const data = (await res.json()) as TimelinePayload;
      setFrom(data.from);
      setTo(data.to);
      setHasMore(data.hasMore);
      setNextBefore(data.nextBefore);
      if (opts.append) {
        setEvents((prev) => {
          const seen = new Set(prev.map((e) => e.id));
          const merged = [...prev];
          for (const e of data.events) {
            if (!seen.has(e.id)) merged.push(e);
          }
          merged.sort((a, b) => b.at.localeCompare(a.at));
          return merged;
        });
      } else {
        setEvents(data.events ?? []);
      }
    },
    [range]
  );

  useEffect(() => {
    setLoading(true);
    void fetchTimeline().finally(() => setLoading(false));
  }, [fetchTimeline]);

  async function loadOlder() {
    if (!nextBefore || loadingMore) return;
    setLoadingMore(true);
    try {
      await fetchTimeline({ append: true, before: nextBefore });
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="history-page pt-8 md:pt-10">
      <header className="history-page-head">
        <h1 className="font-display text-[1.75rem] tracking-[-0.03em]">Архив</h1>
        <div className="flex flex-wrap items-center gap-2">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`range-tab ${range === r.id ? "range-tab-on" : ""}`}
              onClick={() => setRange(r.id)}
            >
              {r.label}
            </button>
          ))}
          {hasMore ? (
            <button
              type="button"
              className="btn text-[13px]"
              disabled={loadingMore}
              onClick={() => void loadOlder()}
            >
              {loadingMore ? "…" : "Раньше"}
            </button>
          ) : null}
        </div>
      </header>

      {loading ? (
        <div className="history-map-wrap history-map-loading">
          <p className="meta-text">Строим карту…</p>
        </div>
      ) : (
        <HistoryMap events={events} from={from} to={to} />
      )}
    </div>
  );
}
