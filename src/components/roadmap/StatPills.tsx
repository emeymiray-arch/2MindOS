"use client";

import { motion } from "framer-motion";

const DOTS = {
  green: "#30d158",
  blue: "#0a84ff",
  orange: "#ff9f0a",
  purple: "#bf5af2",
} as const;

export function StatPills({
  items,
}: {
  items: { label: string; value: string; tone: keyof typeof DOTS }[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item, i) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 * i, duration: 0.35 }}
          className="card flex items-center gap-4 p-5"
        >
          <span
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ background: DOTS[item.tone], boxShadow: `0 0 0 4px ${DOTS[item.tone]}22` }}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-[var(--ink-faint)]">{item.label}</p>
            <p className="font-display text-[22px] tabular-nums tracking-[-0.02em]">{item.value}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
