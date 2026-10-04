"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useMemo, useState } from "react";
import { apiPost } from "@/lib/client-api";
import { toast } from "@/components/ui/Toast";
import { WidgetHead } from "@/components/ui/Widgets";
import type { PlanPhaseBlock, PlanModuleBlock } from "./PlanQuest";

const TONES = ["#c084fc", "#38bdf8", "#34d399", "#fb923c", "#f472b6", "#fbbf24"] as const;

type PhaseGroup = {
  phaseNum: number;
  label: string;
  start?: string;
  end?: string;
  progress: number;
  stages: PlanPhaseBlock[];
};

function stageCaption(title: string, indexInPhase: number) {
  const cleaned = title.replace(/^Фаза\s+\d+\s*·\s*/i, "").trim();
  if (/^этап\s*\d+/i.test(cleaned)) return cleaned;
  return cleaned || `Этап ${indexInPhase + 1}`;
}

function IconBtn({
  label,
  onClick,
  danger,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="plan-icon-btn"
      data-danger={danger ? "true" : undefined}
    >
      {children}
    </button>
  );
}

function StageCard({
  planId,
  ph,
  index,
  tone,
  busyId,
  setBusyId,
  onChanged,
}: {
  planId: string;
  ph: PlanPhaseBlock;
  index: number;
  tone: string;
  busyId: string | null;
  setBusyId: (id: string | null) => void;
  onChanged: () => void;
}) {
  const stageDone = ph.status === "done" || ph.progress >= 100;
  const [open, setOpen] = useState(!stageDone);
  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(ph.title);
  const [addingStep, setAddingStep] = useState(false);
  const [stepTitle, setStepTitle] = useState("");
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [stepDraft, setStepDraft] = useState("");
  const doneCount = ph.modules.filter((m) => m.done).length;

  async function saveStageTitle() {
    const title = titleDraft.trim();
    if (!title) return;
    setBusyId(ph.id);
    const res = await apiPost("/api/work-plans", {
      action: "updatePhase",
      planId,
      phaseId: ph.id,
      title,
    });
    setBusyId(null);
    if (!res.ok) {
      toast(res.error ?? "Не удалось изменить этап", "warn");
      return;
    }
    setEditing(false);
    toast("Этап обновлён", "ok");
    onChanged();
  }

  async function deleteStage() {
    if (busyId) return;
    if (!window.confirm(`Удалить этап «${stageCaption(ph.title, index)}» и все шаги?`)) return;
    setBusyId(ph.id);
    const res = await apiPost("/api/work-plans", {
      action: "deletePhase",
      planId,
      phaseId: ph.id,
    });
    setBusyId(null);
    if (!res.ok) {
      toast(res.error ?? "Не удалось удалить этап", "warn");
      return;
    }
    toast("Этап удалён", "ok");
    onChanged();
  }

  async function toggleModule(mod: PlanModuleBlock) {
    if (busyId) return;
    setBusyId(mod.id);
    const res = await apiPost("/api/work-plans", {
      action: "toggleModule",
      planId,
      phaseId: ph.id,
      moduleId: mod.id,
      done: !mod.done,
    });
    setBusyId(null);
    if (!res.ok) {
      toast(res.error ?? "Не удалось отметить", "warn");
      return;
    }
    onChanged();
  }

  async function saveStep(mod: PlanModuleBlock) {
    const title = stepDraft.trim();
    if (!title) {
      setEditingStepId(null);
      return;
    }
    setBusyId(mod.id);
    const res = await apiPost("/api/work-plans", {
      action: "updateModule",
      planId,
      phaseId: ph.id,
      moduleId: mod.id,
      title,
    });
    setBusyId(null);
    if (!res.ok) {
      toast(res.error ?? "Не удалось изменить шаг", "warn");
      return;
    }
    setEditingStepId(null);
    onChanged();
  }

  async function deleteModule(mod: PlanModuleBlock) {
    if (busyId) return;
    if (!window.confirm(`Удалить шаг «${mod.title}»?`)) return;
    setBusyId(mod.id);
    const res = await apiPost("/api/work-plans", {
      action: "deleteModule",
      planId,
      phaseId: ph.id,
      moduleId: mod.id,
    });
    setBusyId(null);
    if (!res.ok) {
      toast(res.error ?? "Не удалось удалить шаг", "warn");
      return;
    }
    onChanged();
  }

  async function addStep(e: React.FormEvent) {
    e.preventDefault();
    const title = stepTitle.trim();
    if (!title) return;
    setBusyId(`add-${ph.id}`);
    const res = await apiPost("/api/work-plans", {
      action: "addModule",
      planId,
      phaseId: ph.id,
      title,
    });
    setBusyId(null);
    if (!res.ok) {
      toast(res.error ?? "Не удалось добавить шаг", "warn");
      return;
    }
    setStepTitle("");
    setAddingStep(false);
    onChanged();
  }

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className="plan-stage"
      data-done={stageDone ? "true" : undefined}
      style={{ ["--tone" as string]: tone }}
    >
      <header className="plan-stage-head">
        <button
          type="button"
          className="plan-stage-toggle"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span className="plan-stage-num">{stageDone ? "✓" : index + 1}</span>
          <span className="min-w-0 flex-1 text-left">
            {editing ? null : (
              <span className="block truncate text-[15px] font-semibold tracking-tight">
                {stageCaption(ph.title, index)}
              </span>
            )}
            <span className="mt-0.5 block text-[12px] text-[var(--ink-faint)]">
              {doneCount}/{ph.modules.length} шагов
            </span>
          </span>
        </button>

        {editing ? (
          <form
            className="flex min-w-0 flex-1 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void saveStageTitle();
            }}
          >
            <input
              className="field min-w-0 flex-1 py-1.5 text-[14px] font-semibold"
              value={titleDraft}
              autoFocus
              onChange={(e) => setTitleDraft(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">
              Ок
            </button>
            <button type="button" className="btn" onClick={() => setEditing(false)}>
              ×
            </button>
          </form>
        ) : (
          <div className="flex shrink-0 items-center gap-1">
            <span className="plan-stage-pct">{Math.round(ph.progress)}%</span>
            <IconBtn
              label="Изменить этап"
              disabled={busyId === ph.id}
              onClick={() => {
                setTitleDraft(ph.title);
                setEditing(true);
              }}
            >
              ✎
            </IconBtn>
            <IconBtn
              label="Удалить этап"
              danger
              disabled={busyId === ph.id}
              onClick={() => void deleteStage()}
            >
              ×
            </IconBtn>
          </div>
        )}
      </header>

      <div className="plan-stage-bar">
        <motion.span
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, ph.progress)}%` }}
          transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
        />
      </div>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <ul className="stack-tight mt-3">
              <AnimatePresence initial={false}>
                {ph.modules.length === 0 ? (
                  <li className="px-1 py-2 text-[13px] text-[var(--ink-faint)]">Нет шагов</li>
                ) : (
                  ph.modules.map((m) => (
                    <motion.li
                      key={m.id}
                      layout
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      className="plan-step"
                      data-done={m.done ? "true" : undefined}
                    >
                      <button
                        type="button"
                        disabled={busyId === m.id}
                        onClick={() => void toggleModule(m)}
                        className="plan-check"
                        aria-label={m.done ? "Снять" : "Отметить"}
                      >
                        {m.done ? "✓" : ""}
                      </button>
                      {editingStepId === m.id ? (
                        <input
                          className="field min-w-0 flex-1 py-1 text-[13px]"
                          value={stepDraft}
                          autoFocus
                          onChange={(e) => setStepDraft(e.target.value)}
                          onBlur={() => void saveStep(m)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void saveStep(m);
                            }
                            if (e.key === "Escape") setEditingStepId(null);
                          }}
                        />
                      ) : (
                        <button
                          type="button"
                          className="min-w-0 flex-1 truncate text-left text-[14px] font-medium"
                          onClick={() => void toggleModule(m)}
                        >
                          {m.title}
                        </button>
                      )}
                      {editingStepId !== m.id ? (
                        <div className="plan-step-actions">
                          <IconBtn
                            label="Изменить шаг"
                            disabled={busyId === m.id}
                            onClick={() => {
                              setEditingStepId(m.id);
                              setStepDraft(m.title);
                            }}
                          >
                            ✎
                          </IconBtn>
                          <IconBtn
                            label="Удалить шаг"
                            danger
                            disabled={busyId === m.id}
                            onClick={() => void deleteModule(m)}
                          >
                            ×
                          </IconBtn>
                        </div>
                      ) : null}
                    </motion.li>
                  ))
                )}
              </AnimatePresence>
            </ul>

            {addingStep ? (
              <form onSubmit={addStep} className="mt-2 flex gap-2">
                <input
                  className="field min-w-0 flex-1 py-2"
                  value={stepTitle}
                  autoFocus
                  placeholder="Новый шаг"
                  onChange={(e) => setStepTitle(e.target.value)}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={busyId === `add-${ph.id}`}
                >
                  +
                </button>
                <button type="button" className="btn" onClick={() => setAddingStep(false)}>
                  ×
                </button>
              </form>
            ) : (
              <button type="button" className="plan-add" onClick={() => setAddingStep(true)}>
                + шаг
              </button>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.article>
  );
}

/** План цели: Фаза → Этап → Шаг. */
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
  const [newStageTitle, setNewStageTitle] = useState("");
  const [addingStageFor, setAddingStageFor] = useState<number | "end" | null>(null);

  const groups = useMemo((): PhaseGroup[] => {
    if (phaseGroups?.length) return phaseGroups;
    const out: PhaseGroup[] = [];
    for (let i = 0; i < phases.length; i += 3) {
      const chunk = phases.slice(i, i + 3);
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

  async function addStage(e: React.FormEvent) {
    e.preventDefault();
    const title = newStageTitle.trim();
    if (!title) return;
    setBusyId("add-stage");
    const res = await apiPost("/api/work-plans", { action: "addPhase", planId, title });
    setBusyId(null);
    if (!res.ok) {
      toast(res.error ?? "Не удалось добавить этап", "warn");
      return;
    }
    setNewStageTitle("");
    setAddingStageFor(null);
    toast("Этап добавлен", "ok");
    onChanged();
  }

  async function deletePhaseGroup(grp: PhaseGroup) {
    if (!grp.stages.length) return;
    if (!window.confirm(`Удалить ${grp.label} целиком?`)) return;
    setBusyId(`del-phase-${grp.phaseNum}`);
    for (const stage of [...grp.stages].reverse()) {
      const res = await apiPost("/api/work-plans", {
        action: "deletePhase",
        planId,
        phaseId: stage.id,
      });
      if (!res.ok) {
        setBusyId(null);
        toast(res.error ?? "Не удалось удалить фазу", "warn");
        onChanged();
        return;
      }
    }
    setBusyId(null);
    toast("Фаза удалена", "ok");
    onChanged();
  }

  const addForm = (
    <form onSubmit={addStage} className="flex gap-2">
      <input
        className="field min-w-0 flex-1"
        value={newStageTitle}
        autoFocus
        placeholder="Название этапа"
        onChange={(e) => setNewStageTitle(e.target.value)}
      />
      <button type="submit" className="btn btn-primary" disabled={busyId === "add-stage"}>
        Добавить
      </button>
      <button type="button" className="btn" onClick={() => setAddingStageFor(null)}>
        ×
      </button>
    </form>
  );

  return (
    <div className="plan-root">
      {groups.length === 0 ? (
        <section className="panel">
          <p className="text-[14px] text-[var(--ink-soft)]">План пуст — добавь первый этап.</p>
        </section>
      ) : null}

      {groups.map((grp, gi) => {
        const tone = TONES[gi % TONES.length];
        return (
          <motion.section
            key={grp.phaseNum}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: gi * 0.06, type: "spring", stiffness: 300, damping: 30 }}
            className="panel plan-phase"
            style={{ ["--tone" as string]: tone }}
          >
            <WidgetHead
              title={grp.label}
              tone={(["violet", "blue", "green", "orange", "pink", "orange"] as const)[gi % 6]}
              action={
                <div className="flex items-center gap-2">
                  {(grp.start || grp.end) && (
                    <span className="hidden text-[11px] text-[var(--ink-faint)] sm:inline">
                      {[grp.start, grp.end].filter(Boolean).join(" → ")}
                    </span>
                  )}
                  <span className="plan-phase-pct">{grp.progress}%</span>
                  {grp.stages.length > 0 ? (
                    <IconBtn
                      label="Удалить фазу"
                      danger
                      disabled={busyId === `del-phase-${grp.phaseNum}`}
                      onClick={() => void deletePhaseGroup(grp)}
                    >
                      ×
                    </IconBtn>
                  ) : null}
                </div>
              }
            />
            <div className="plan-phase-bar">
              <motion.span
                initial={{ width: 0 }}
                animate={{ width: `${grp.progress}%` }}
                transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
              />
            </div>

            <div className="plan-stages">
              {grp.stages.map((ph, i) => (
                <StageCard
                  key={ph.id}
                  planId={planId}
                  ph={ph}
                  index={i}
                  tone={TONES[(gi * 3 + i) % TONES.length]}
                  busyId={busyId}
                  setBusyId={setBusyId}
                  onChanged={onChanged}
                />
              ))}
            </div>

            {addingStageFor === grp.phaseNum ? (
              <div className="mt-3">{addForm}</div>
            ) : (
              <button
                type="button"
                className="plan-add mt-3"
                onClick={() => {
                  setAddingStageFor(grp.phaseNum);
                  setNewStageTitle("");
                }}
              >
                + этап
              </button>
            )}
          </motion.section>
        );
      })}

      {addingStageFor === "end" ? (
        <section className="panel">{addForm}</section>
      ) : (
        <button
          type="button"
          className="btn w-full"
          onClick={() => {
            setAddingStageFor("end");
            setNewStageTitle("");
          }}
        >
          + Новый этап
        </button>
      )}
    </div>
  );
}
