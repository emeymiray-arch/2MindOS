"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useMemo, useState } from "react";
import { apiPost } from "@/lib/client-api";
import { toast } from "@/components/ui/Toast";
import type { PlanPhaseBlock, PlanModuleBlock } from "./PlanQuest";

const PALETTE = [
  { idle: "#e8efff", done: "#2f6bff", soft: "#b8cbff" },
  { idle: "#dff8ed", done: "#00b87a", soft: "#9ae8c8" },
  { idle: "#ffe6dc", done: "#ff6b3d", soft: "#ffb89a" },
  { idle: "#ece6ff", done: "#7c5cff", soft: "#c4b4ff" },
  { idle: "#ffe3f0", done: "#ff4d9a", soft: "#ff9fc8" },
  { idle: "#fff0d6", done: "#ff9f1a", soft: "#ffd28a" },
];

type PhaseGroup = {
  phaseNum: number;
  label: string;
  start?: string;
  end?: string;
  progress: number;
  stages: PlanPhaseBlock[];
};

function StageCard({
  planId,
  ph,
  index,
  skin,
  busyId,
  burstId,
  setBusyId,
  setBurstId,
  onChanged,
}: {
  planId: string;
  ph: PlanPhaseBlock;
  index: number;
  skin: (typeof PALETTE)[number];
  busyId: string | null;
  burstId: string | null;
  setBusyId: (id: string | null) => void;
  setBurstId: (id: string | null) => void;
  onChanged: () => void;
}) {
  const phaseDone = ph.status === "done" || ph.progress >= 100;
  const active = ph.status === "active" || (!phaseDone && index === 0);

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
    if (next) {
      setBurstId(mod.id);
      window.setTimeout(() => setBurstId(null), 500);
      toast("Шаг пройден — следующий в Сегодня", "ok");
    }
    onChanged();
  }

  async function deleteModule(phaseId: string, mod: PlanModuleBlock) {
    if (busyId) return;
    if (!window.confirm(`Удалить шаг «${mod.title}»?`)) return;
    setBusyId(mod.id);
    const res = await apiPost("/api/work-plans", {
      action: "deleteModule",
      planId,
      phaseId,
      moduleId: mod.id,
    });
    setBusyId(null);
    if (!res.ok) {
      toast(res.error ?? "Не удалось удалить", "warn");
      return;
    }
    toast("Удалила", "ok");
    onChanged();
  }

  async function togglePhase() {
    if (busyId || ph.modules.length > 0) return;
    setBusyId(ph.id);
    const done = phaseDone;
    const res = await apiPost("/api/work-plans", {
      action: "updatePhase",
      planId,
      phaseId: ph.id,
      status: done ? "active" : "done",
    });
    setBusyId(null);
    if (!res.ok) {
      toast(res.error ?? "Не удалось отметить", "warn");
      return;
    }
    if (!done) {
      setBurstId(ph.id);
      window.setTimeout(() => setBurstId(null), 500);
      toast("Этап пройден!", "ok");
    }
    onChanged();
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 360, damping: 26, delay: index * 0.04 }}
      className="overflow-hidden rounded-[22px]"
      style={{
        background: phaseDone ? skin.done : skin.idle,
        boxShadow: active ? `0 12px 30px ${skin.done}30` : "0 4px 14px rgba(18,24,38,0.05)",
        outline: active && !phaseDone ? `2px solid ${skin.done}` : "none",
        outlineOffset: 2,
      }}
    >
      <button
        type="button"
        onClick={() => void togglePhase()}
        disabled={ph.modules.length > 0 || busyId === ph.id}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left disabled:cursor-default"
      >
        <motion.span
          animate={burstId === ph.id ? { scale: [1, 1.2, 1], rotate: [0, -8, 0] } : {}}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] text-[15px] font-black"
          style={{
            background: phaseDone ? "rgba(255,255,255,0.25)" : skin.done,
            color: "#fff",
          }}
        >
          {phaseDone ? "✓" : index + 1}
        </motion.span>

        <div className="min-w-0 flex-1">
          <p
            className="truncate text-[15px] font-bold"
            style={{ color: phaseDone ? "#fff" : "var(--ink)" }}
          >
            {ph.title}
          </p>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-black/10">
            <motion.div
              className="h-full rounded-full"
              style={{ background: phaseDone ? "#fff" : skin.done }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, ph.progress)}%` }}
              transition={{ duration: 0.45 }}
            />
          </div>
        </div>

        <span
          className="text-[13px] font-extrabold tabular-nums"
          style={{ color: phaseDone ? "#fff" : skin.done }}
        >
          {Math.round(ph.progress)}%
        </span>
      </button>

      {ph.modules.length > 0 ? (
        <div className="grid gap-2 px-3 pb-3 sm:grid-cols-2">
          <AnimatePresence initial={false}>
            {ph.modules.map((m, mi) => {
              const done = m.done;
              return (
                <motion.div
                  key={m.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: mi * 0.03 }}
                  className="relative flex min-h-[64px] items-center gap-1 rounded-[16px] pr-1"
                  style={{
                    background: done ? skin.done : "#fff",
                    color: done ? "#fff" : "var(--ink)",
                    boxShadow: done
                      ? `inset 0 0 0 2px ${skin.soft}`
                      : "0 1px 4px rgba(18,24,38,0.06)",
                  }}
                >
                  <motion.button
                    type="button"
                    disabled={busyId === m.id}
                    onClick={() => void toggleModule(ph.id, m)}
                    whileTap={{ scale: 0.96 }}
                    className="flex min-h-[64px] min-w-0 flex-1 items-center gap-2.5 px-3 py-3 text-left"
                  >
                    <motion.span
                      key={`${m.id}-${done}`}
                      initial={{ scale: 0.6 }}
                      animate={burstId === m.id ? { scale: [0.6, 1.25, 1] } : { scale: 1 }}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-black"
                      style={{
                        background: done ? "rgba(255,255,255,0.28)" : skin.soft,
                        color: done ? "#fff" : skin.done,
                      }}
                    >
                      {done ? "✓" : "◇"}
                    </motion.span>
                    <span className="min-w-0 flex-1 text-[13.5px] font-bold leading-snug">
                      {m.title}
                    </span>
                  </motion.button>
                  <button
                    type="button"
                    className="mr-2 shrink-0 rounded-lg px-2 py-1 text-[14px] font-bold opacity-70 hover:opacity-100"
                    style={{ color: done ? "#fff" : "var(--behind)" }}
                    disabled={busyId === m.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      void deleteModule(ph.id, m);
                    }}
                    aria-label="Удалить шаг"
                  >
                    ×
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      ) : null}
    </motion.div>
  );
}

/**
 * Вариант B — фазы (6 мес) → этапы (2 мес) → шаги.
 * Пройденный шаг заливается цветом; следующий появляется в Сегодня.
 */
export function PlanQuestB({
  planId,
  phases,
  phaseGroups,
  onChanged,
}: {
  planId: string;
  phases: PlanPhaseBlock[];
  phaseGroups?: PhaseGroup[];
  onChanged: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [burstId, setBurstId] = useState<string | null>(null);

  const groups = useMemo((): PhaseGroup[] => {
    if (phaseGroups?.length) return phaseGroups;
    // Fallback: every 3 stages = one 6-month фаза
    const sorted = [...phases];
    const out: PhaseGroup[] = [];
    for (let i = 0; i < sorted.length; i += 3) {
      const chunk = sorted.slice(i, i + 3);
      const n = Math.floor(i / 3) + 1;
      const prog =
        chunk.length === 0
          ? 0
          : Math.round(chunk.reduce((s, p) => s + (p.progress ?? 0), 0) / chunk.length);
      out.push({
        phaseNum: n,
        label: `Фаза ${n}`,
        start: chunk[0]?.deadlineStart,
        end: chunk[chunk.length - 1]?.deadlineEnd,
        progress: prog,
        stages: chunk,
      });
    }
    return out;
  }, [phaseGroups, phases]);

  return (
    <div className="space-y-6">
      {groups.map((grp, gi) => {
        const skin = PALETTE[gi % PALETTE.length];
        return (
          <div key={grp.phaseNum} className="space-y-3">
            <div className="flex items-end justify-between gap-3 px-1">
              <p className="text-[15px] font-bold" style={{ color: skin.done }}>
                {grp.label}
              </p>
              <span className="text-[13px] font-extrabold tabular-nums" style={{ color: skin.done }}>
                {grp.progress}%
              </span>
            </div>
            <div className="space-y-3">
              {grp.stages.map((ph, i) => (
                <StageCard
                  key={ph.id}
                  planId={planId}
                  ph={ph}
                  index={i}
                  skin={PALETTE[(gi * 3 + i) % PALETTE.length]}
                  busyId={busyId}
                  burstId={burstId}
                  setBusyId={setBusyId}
                  setBurstId={setBurstId}
                  onChanged={onChanged}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
