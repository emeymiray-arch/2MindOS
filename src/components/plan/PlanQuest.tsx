"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { apiPost } from "@/lib/client-api";
import { toast } from "@/components/ui/Toast";

export type PlanModuleBlock = {
  id: string;
  title: string;
  done: boolean;
  deadlineEnd?: string;
};

export type PlanPhaseBlock = {
  id: string;
  title: string;
  progress: number;
  status?: string;
  deadlineStart?: string;
  deadlineEnd?: string;
  modules: PlanModuleBlock[];
};

const PALETTE = [
  { bg: "#e8efff", accent: "#2f6bff", soft: "#c9d9ff" },
  { bg: "#e3faf1", accent: "#00b87a", soft: "#b6f0d8" },
  { bg: "#ffe9e1", accent: "#ff6b3d", soft: "#ffcbb8" },
  { bg: "#efeaff", accent: "#7c5cff", soft: "#d5cbff" },
  { bg: "#ffe5f1", accent: "#ff4d9a", soft: "#ffbdd9" },
  { bg: "#fff3dd", accent: "#ff9f1a", soft: "#ffe0a3" },
];

export function PlanQuest({
  planId,
  phases,
  onChanged,
}: {
  planId: string;
  phases: PlanPhaseBlock[];
  onChanged: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggleModule(phaseId: string, mod: PlanModuleBlock) {
    if (busyId) return;
    setBusyId(mod.id);
    const next = !mod.done;
    const res = await apiPost("/api/work-plans", {
      action: "toggleModule",
      planId,
      phaseId,
      moduleId: mod.id,
      done: next,
    });
    setBusyId(null);
    if (!res.ok) {
      toast(res.error ?? "Не удалось отметить", "warn");
      return;
    }
    if (next) toast("Готово", "ok");
    onChanged();
  }

  async function togglePhase(phase: PlanPhaseBlock) {
    if (busyId || phase.modules.length > 0) return;
    setBusyId(phase.id);
    const done = phase.status === "done" || phase.progress >= 100;
    const res = await apiPost("/api/work-plans", {
      action: "updatePhase",
      planId,
      phaseId: phase.id,
      status: done ? "active" : "done",
    });
    setBusyId(null);
    if (!res.ok) {
      toast(res.error ?? "Не удалось отметить", "warn");
      return;
    }
    if (!done) toast("Этап пройден", "ok");
    onChanged();
  }

  return (
    <div className="space-y-3">
      {phases.map((ph, i) => {
        const skin = PALETTE[i % PALETTE.length];
        const phaseDone = ph.status === "done" || ph.progress >= 100;
        const active =
          ph.status === "active" ||
          (!phaseDone &&
            i === phases.findIndex((p) => p.status !== "done" && (p.progress ?? 0) < 100));

        return (
          <motion.div
            key={ph.id}
            layout
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: i * 0.04 }}
            className="overflow-hidden rounded-[20px] border-2 bg-white"
            style={{
              borderColor: active || phaseDone ? skin.accent : skin.soft,
              boxShadow: active ? `0 12px 28px ${skin.accent}28` : "0 2px 10px rgba(18,24,38,0.04)",
            }}
          >
            <button
              type="button"
              onClick={() => void togglePhase(ph)}
              disabled={ph.modules.length > 0 || busyId === ph.id}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left disabled:cursor-default"
              style={{ background: skin.bg }}
            >
              <motion.span
                animate={phaseDone ? { scale: [1, 1.12, 1] } : {}}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-[15px] font-extrabold text-white"
                style={{ background: skin.accent }}
              >
                {phaseDone ? "✓" : i + 1}
              </motion.span>
              <p
                className={`min-w-0 flex-1 truncate text-[15px] font-bold ${
                  phaseDone ? "line-through opacity-55" : ""
                }`}
              >
                {ph.title}
              </p>
              <p className="text-[13px] font-extrabold tabular-nums" style={{ color: skin.accent }}>
                {Math.round(ph.progress)}%
              </p>
            </button>

            {ph.modules.length > 0 ? (
              <div className="space-y-2 bg-white px-3 py-3">
                <AnimatePresence initial={false}>
                  {ph.modules.map((m, mi) => (
                    <motion.button
                      key={m.id}
                      type="button"
                      layout
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: mi * 0.03 }}
                      disabled={busyId === m.id}
                      onClick={() => void toggleModule(ph.id, m)}
                      whileTap={{ scale: 0.97 }}
                      className="flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition"
                      style={{ background: m.done ? skin.bg : varMuted(skin.bg) }}
                    >
                      <motion.span
                        key={`${m.id}-${m.done}`}
                        initial={{ scale: 0.7 }}
                        animate={{ scale: 1 }}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-[13px] font-bold text-white"
                        style={{ background: m.done ? skin.accent : skin.soft, color: m.done ? "#fff" : skin.accent }}
                      >
                        {m.done ? "✓" : "◇"}
                      </motion.span>
                      <span
                        className={`min-w-0 flex-1 text-[14px] font-semibold ${
                          m.done ? "opacity-45 line-through" : ""
                        }`}
                      >
                        {m.title}
                      </span>
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>
            ) : null}
          </motion.div>
        );
      })}
    </div>
  );
}

function varMuted(bg: string) {
  return `color-mix(in srgb, ${bg} 35%, white)`;
}
