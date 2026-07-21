"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { monthTitle } from "@/lib/roadmap";
import type { RoadmapMonth } from "@/lib/types";

const PREVIEW = 4;

export function MonthCard({
  stageId,
  month,
}: {
  stageId: string;
  month: RoadmapMonth;
}) {
  const [expanded, setExpanded] = useState(false);
  const goals = month.goals ?? [];
  const done = goals.filter((g) => g.done);
  const list = done.length > 0 ? done : goals;
  const visible = expanded ? list : list.slice(0, PREVIEW);
  const more = list.length - PREVIEW;

  return (
    <motion.div
      layout
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      className="h-full"
    >
      <Link
        href={`/roadmap/${stageId}/${month.id}`}
        className="roadmap-month-card card flex h-full min-h-[200px] flex-col p-5"
      >
        <h3 className="font-display text-[17px] tracking-[-0.02em]">
          {monthTitle(month.year, month.month)}
        </h3>

        <ul className="mt-4 flex flex-1 flex-col gap-2.5">
          {visible.length === 0 ? (
            <li className="text-[13px] text-[var(--ink-faint)]">—</li>
          ) : (
            visible.map((g) => (
              <li key={g.id} className="roadmap-goal-row">
                <span className={`roadmap-tick ${g.done ? "on" : "off"}`} aria-hidden>
                  {g.done ? "✔" : "○"}
                </span>
                <span className="roadmap-goal-text">{g.title}</span>
              </li>
            ))
          )}
        </ul>

        {more > 0 && !expanded ? (
          <button
            type="button"
            className="mt-3 self-start text-[12px] font-semibold text-[var(--ink-soft)]"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setExpanded(true);
            }}
          >
            +{more} more
          </button>
        ) : null}
        {expanded && list.length > PREVIEW ? (
          <button
            type="button"
            className="mt-3 self-start text-[12px] font-semibold text-[var(--ink-soft)]"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setExpanded(false);
            }}
          >
            Show less
          </button>
        ) : null}
      </Link>
    </motion.div>
  );
}
