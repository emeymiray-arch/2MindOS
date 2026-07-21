"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { dayLabel } from "@/lib/roadmap";
import type { RoadmapDay } from "@/lib/types";

const PREVIEW = 4;

export function DayCard({
  day,
  onToggle,
}: {
  day: RoadmapDay;
  onToggle?: (taskId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const tasks = day.tasks ?? [];
  const visible = expanded ? tasks : tasks.slice(0, PREVIEW);
  const more = tasks.length - PREVIEW;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="roadmap-day-card card flex h-full min-h-[200px] flex-col p-5"
    >
      <h3 className="font-display text-[17px] tracking-[-0.02em]">{dayLabel(day.date)}</h3>
      <ul className="mt-4 flex flex-1 flex-col gap-2.5">
        {visible.length === 0 ? (
          <li className="text-[13px] text-[var(--ink-faint)]">—</li>
        ) : (
          visible.map((t) => (
            <li key={t.id} className="roadmap-goal-row">
              <button
                type="button"
                className={`roadmap-tick ${t.done ? "on" : "off"}`}
                onClick={() => onToggle?.(t.id)}
                aria-label={t.done ? "done" : "open"}
              >
                {t.done ? "✓" : "○"}
              </button>
              <span className="roadmap-goal-text">{t.title}</span>
            </li>
          ))
        )}
      </ul>
      {more > 0 && !expanded ? (
        <button
          type="button"
          className="mt-3 self-start text-[12px] font-semibold text-[var(--ink-soft)]"
          onClick={() => setExpanded(true)}
        >
          +{more} more
        </button>
      ) : null}
    </motion.div>
  );
}
