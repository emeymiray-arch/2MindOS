"use client";

import { motion } from "framer-motion";
import type { TimelineBucket } from "./QuestTimeline";

const DOT = {
  done: "#00b87a",
  current: "#2f6bff",
  ahead: "#c8d0e0",
};

/** Вариант B: линия проходит через центр кружков */
export function QuestTimelineB({ buckets }: { buckets: TimelineBucket[] }) {
  const flat = buckets.flatMap((b) => b.items.map((item) => ({ ...item })));
  if (!flat.length) return null;

  return (
    <ul className="relative space-y-2 py-1">
      {/* линия по центру колонки кружков (колонка 24px, линия 3px → left 10.5px) */}
      <div className="pointer-events-none absolute bottom-4 left-[10px] top-4 w-[4px] overflow-hidden rounded-full bg-[var(--bg-muted)]">
        <motion.div
          className="h-full w-full origin-top rounded-full"
          style={{
            background: "linear-gradient(180deg, #00b87a 0%, #2f6bff 50%, #c8d0e0 100%)",
          }}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      {flat.map((item, i) => {
        const kind = item.done ? "done" : item.current ? "current" : "ahead";
        const color = DOT[kind];

        return (
          <motion.li
            key={item.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 + i * 0.05, type: "spring", stiffness: 340, damping: 24 }}
            className="relative flex items-center gap-3"
          >
            <div className="relative z-[1] flex h-6 w-6 shrink-0 items-center justify-center">
              <motion.span
                className="flex h-6 w-6 items-center justify-center rounded-full border-[3px] border-white"
                style={{ background: color, boxShadow: `0 0 0 2px ${color}33` }}
                animate={
                  kind === "current"
                    ? {
                        scale: [1, 1.12, 1],
                        boxShadow: [
                          `0 0 0 2px ${color}33`,
                          `0 0 0 10px ${color}00`,
                          `0 0 0 2px ${color}33`,
                        ],
                      }
                    : { scale: 1 }
                }
                transition={
                  kind === "current"
                    ? { duration: 1.7, repeat: Infinity, ease: "easeInOut" }
                    : undefined
                }
              >
                {kind === "done" ? (
                  <span className="text-[11px] font-black text-white">✓</span>
                ) : kind === "current" ? (
                  <span className="h-2 w-2 rounded-full bg-white" />
                ) : null}
              </motion.span>
            </div>

            <div
              className="min-w-0 flex-1 rounded-[16px] px-3.5 py-2.5 font-semibold"
              style={{
                background:
                  kind === "done"
                    ? "var(--c-green-soft)"
                    : kind === "current"
                      ? "var(--c-blue-soft)"
                      : "#fff",
                color: kind === "done" ? "var(--c-green)" : "var(--ink)",
              }}
            >
              <div className="flex items-center gap-2">
                <span className="truncate text-[14px]">{item.title}</span>
                {kind === "current" ? (
                  <span className="shrink-0 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-bold text-white">
                    сейчас
                  </span>
                ) : null}
                {kind === "done" ? (
                  <span className="shrink-0 rounded-full bg-[var(--ahead)] px-2 py-0.5 text-[10px] font-bold text-white">
                    ✓
                  </span>
                ) : null}
              </div>
            </div>
          </motion.li>
        );
      })}
    </ul>
  );
}
