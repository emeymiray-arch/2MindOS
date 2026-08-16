"use client";

import { motion } from "framer-motion";

export function StatPills({
  items,
}: {
  items: { label: string; value: string; tone?: string }[];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {items.map((item, i) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 * i, duration: 0.3 }}
          className="card space-y-1 p-6"
        >
          <p className="text-[12px] font-medium text-[var(--ink-faint)]">{item.label}</p>
          <p className="font-display text-[22px] tabular-nums tracking-[-0.03em]">{item.value}</p>
        </motion.div>
      ))}
    </div>
  );
}
