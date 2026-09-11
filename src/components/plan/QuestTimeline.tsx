"use client";

import { motion } from "framer-motion";

export type TimelineBucket = {
  month: string;
  label: string;
  items: { id: string; title: string; date?: string; done: boolean; current: boolean }[];
};

const DOT = {
  done: "#00b87a",
  current: "#2f6bff",
  ahead: "#d5dbeb",
};

export function QuestTimeline({ buckets }: { buckets: TimelineBucket[] }) {
  const flat = buckets.flatMap((b) => b.items.map((item) => ({ ...item })));
  if (!flat.length) return null;

  return (
    <div className="relative pl-2">
      <div className="absolute bottom-3 left-[19px] top-3 w-[3px] overflow-hidden rounded-full bg-[var(--bg-muted)]">
        <motion.div
          className="w-full origin-top rounded-full"
          style={{
            background: "linear-gradient(180deg, #00b87a 0%, #2f6bff 55%, #d5dbeb 100%)",
            height: "100%",
          }}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      <ul className="space-y-1">
        {flat.map((item, i) => {
          const kind = item.done ? "done" : item.current ? "current" : "ahead";
          const color = DOT[kind];

          return (
            <motion.li
              key={item.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.06 + i * 0.05, type: "spring", stiffness: 320, damping: 24 }}
              className="relative flex items-start gap-3 py-2 pl-10"
            >
              <span className="absolute left-[11px] top-3">
                <motion.span
                  className="relative flex h-5 w-5 items-center justify-center rounded-full"
                  style={{ background: color }}
                  animate={
                    kind === "current"
                      ? {
                          scale: [1, 1.18, 1],
                          boxShadow: [
                            "0 0 0 0 rgba(47,107,255,0.45)",
                            "0 0 0 10px rgba(47,107,255,0)",
                            "0 0 0 0 rgba(47,107,255,0)",
                          ],
                        }
                      : { scale: 1 }
                  }
                  transition={
                    kind === "current"
                      ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
                      : { duration: 0.3 }
                  }
                >
                  {kind === "done" ? (
                    <span className="text-[10px] font-black text-white">✓</span>
                  ) : kind === "current" ? (
                    <motion.span
                      className="h-2 w-2 rounded-full bg-white"
                      animate={{ scale: [0.85, 1.1, 0.85] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                    />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
                  )}
                </motion.span>
              </span>

              <div
                className={`min-w-0 flex-1 rounded-[14px] px-3.5 py-2.5 ${
                  kind === "current"
                    ? "bg-[var(--c-blue-soft)]"
                    : kind === "done"
                      ? "bg-[var(--c-green-soft)]"
                      : "bg-white"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p
                    className={`text-[14px] font-semibold ${
                      kind === "done" ? "opacity-45 line-through" : ""
                    }`}
                  >
                    {item.title}
                  </p>
                  {kind === "current" ? (
                    <motion.span
                      className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-bold text-white"
                      animate={{ y: [0, -1, 0] }}
                      transition={{ duration: 1.4, repeat: Infinity }}
                    >
                      сейчас
                    </motion.span>
                  ) : null}
                </div>
              </div>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
