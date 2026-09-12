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

function stageCaption(title: string, indexInPhase: number) {
  // Strip auto prefixes like "Фаза 1 · " so the card reads as an Этап.
  const cleaned = title.replace(/^Фаза\s+\d+\s*·\s*/i, "").trim();
  if (/^этап\s*\d+/i.test(cleaned)) return cleaned;
  return `Этап ${indexInPhase + 1}: ${cleaned || "без названия"}`;
}

function ActionBtn({
  label,
  onClick,
  danger,
  disabled,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="rounded-lg px-2 py-1 text-[12px] font-bold transition hover:bg-black/5 disabled:opacity-40"
      style={{ color: danger ? "var(--behind)" : "var(--ink-soft)" }}
    >
      {label}
    </button>
  );
}

function StageCard({
  planId,
  ph,
  index,
  skin,
  busyId,
  setBusyId,
  onChanged,
}: {
  planId: string;
  ph: PlanPhaseBlock;
  index: number;
  skin: (typeof PALETTE)[number];
  busyId: string | null;
  setBusyId: (id: string | null) => void;
  onChanged: () => void;
}) {
  const stageDone = ph.status === "done" || ph.progress >= 100;
  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(ph.title);
  const [addingStep, setAddingStep] = useState(false);
  const [stepTitle, setStepTitle] = useState("");
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [stepDraft, setStepDraft] = useState("");

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
    if (!window.confirm(`Удалить этап «${stageCaption(ph.title, index)}» и все его шаги?`)) return;
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
    if (!mod.done) toast("Шаг отмечен — смотри на Главной", "ok");
    onChanged();
  }

  async function saveStep(mod: PlanModuleBlock) {
    const title = stepDraft.trim();
    if (!title) return;
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
    toast("Шаг обновлён", "ok");
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
    toast("Шаг удалён", "ok");
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
    toast("Шаг добавлен", "ok");
    onChanged();
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-[20px] border border-[var(--line)] bg-white"
      style={{ boxShadow: "0 4px 14px rgba(18,24,38,0.05)" }}
    >
      <div
        className="flex items-start gap-3 px-4 py-3.5"
        style={{ background: stageDone ? skin.done : skin.idle }}
      >
        <span
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] text-[13px] font-black text-white"
          style={{ background: stageDone ? "rgba(255,255,255,0.28)" : skin.done }}
        >
          {stageDone ? "✓" : index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="text-[11px] font-bold uppercase tracking-wide"
            style={{ color: stageDone ? "rgba(255,255,255,0.8)" : skin.done }}
          >
            Этап · 2 месяца
          </p>
          {editing ? (
            <form
              className="mt-1 flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void saveStageTitle();
              }}
            >
              <input
                className="field min-w-0 flex-1 py-1 text-[14px] font-bold"
                value={titleDraft}
                autoFocus
                onChange={(e) => setTitleDraft(e.target.value)}
              />
              <button type="submit" className="btn btn-primary">
                Ок
              </button>
              <button type="button" className="btn" onClick={() => setEditing(false)}>
                Отмена
              </button>
            </form>
          ) : (
            <p
              className="mt-0.5 text-[15px] font-bold leading-snug"
              style={{ color: stageDone ? "#fff" : "var(--ink)" }}
            >
              {stageCaption(ph.title, index)}
            </p>
          )}
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/10">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, ph.progress)}%`,
                background: stageDone ? "#fff" : skin.done,
              }}
            />
          </div>
        </div>
        {!editing ? (
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span
              className="text-[12px] font-extrabold tabular-nums"
              style={{ color: stageDone ? "#fff" : skin.done }}
            >
              {Math.round(ph.progress)}%
            </span>
            <div className="flex">
              <ActionBtn
                label="Изменить"
                disabled={busyId === ph.id}
                onClick={() => {
                  setTitleDraft(ph.title);
                  setEditing(true);
                }}
              />
              <ActionBtn
                label="Удалить"
                danger
                disabled={busyId === ph.id}
                onClick={() => void deleteStage()}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-2 px-3 py-3">
        <p className="px-1 text-[11px] font-bold uppercase tracking-wide text-[var(--ink-faint)]">
          Шаги внутри этапа
        </p>
        <AnimatePresence initial={false}>
          {ph.modules.length === 0 ? (
            <p className="px-1 py-2 text-[13px] font-semibold text-[var(--ink-soft)]">
              Пока пусто — добавь первый шаг ниже
            </p>
          ) : (
            ph.modules.map((m) => {
              const done = m.done;
              return (
                <motion.div
                  key={m.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-1 rounded-[14px] border border-[var(--line)] px-2 py-2"
                  style={{
                    background: done ? skin.done : "#fff",
                    color: done ? "#fff" : "var(--ink)",
                  }}
                >
                  <button
                    type="button"
                    disabled={busyId === m.id}
                    onClick={() => void toggleModule(m)}
                    className="flex min-w-0 flex-1 items-center gap-2.5 px-1 py-1 text-left"
                    title="Отметить шаг"
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-black"
                      style={{
                        background: done ? "rgba(255,255,255,0.28)" : skin.soft,
                        color: done ? "#fff" : skin.done,
                      }}
                    >
                      {done ? "✓" : "◇"}
                    </span>
                    {editingStepId === m.id ? (
                      <input
                        className="field min-w-0 flex-1 py-1 text-[13px] font-bold"
                        value={stepDraft}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setStepDraft(e.target.value)}
                        onBlur={() => void saveStep(m)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void saveStep(m);
                          }
                        }}
                      />
                    ) : (
                      <span className="min-w-0 flex-1 text-[13.5px] font-bold leading-snug">
                        {m.title}
                      </span>
                    )}
                  </button>
                  {editingStepId !== m.id ? (
                    <div className="flex shrink-0">
                      <ActionBtn
                        label="Изменить"
                        disabled={busyId === m.id}
                        onClick={() => {
                          setEditingStepId(m.id);
                          setStepDraft(m.title);
                        }}
                      />
                      <ActionBtn
                        label="Удалить"
                        danger
                        disabled={busyId === m.id}
                        onClick={() => void deleteModule(m)}
                      />
                    </div>
                  ) : null}
                </motion.div>
              );
            })
          )}
        </AnimatePresence>

        {addingStep ? (
          <form onSubmit={addStep} className="flex flex-wrap gap-2 rounded-[14px] bg-[var(--bg-muted)] p-2">
            <input
              className="field min-w-0 flex-1"
              value={stepTitle}
              autoFocus
              placeholder="Название шага"
              onChange={(e) => setStepTitle(e.target.value)}
            />
            <button type="submit" className="btn btn-primary" disabled={busyId === `add-${ph.id}`}>
              Добавить шаг
            </button>
            <button type="button" className="btn" onClick={() => setAddingStep(false)}>
              Отмена
            </button>
          </form>
        ) : (
          <button
            type="button"
            className="w-full rounded-[14px] border border-dashed border-[var(--line-strong)] px-3 py-2.5 text-[13px] font-bold"
            style={{ color: skin.done }}
            onClick={() => setAddingStep(true)}
          >
            + Шаг в этот этап
          </button>
        )}
      </div>
    </motion.div>
  );
}

/**
 * План цели: Фаза (6 мес) → Этап (2 мес) → Шаг.
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
  const [newStageTitle, setNewStageTitle] = useState("");
  const [addingStageFor, setAddingStageFor] = useState<number | "end" | null>(null);

  const groups = useMemo((): PhaseGroup[] => {
    if (phaseGroups?.length) return phaseGroups;
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

  async function addStage(e: React.FormEvent) {
    e.preventDefault();
    const title = newStageTitle.trim();
    if (!title) return;
    setBusyId("add-stage");
    const res = await apiPost("/api/work-plans", {
      action: "addPhase",
      planId,
      title,
    });
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
    if (
      !window.confirm(
        `Удалить ${grp.label} целиком (${grp.stages.length} этап(а/ов) и все шаги внутри)?`
      )
    ) {
      return;
    }
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

  return (
    <div className="space-y-5">
      <div className="rounded-[18px] border border-[var(--line)] bg-[var(--bg-muted)] px-4 py-3.5">
        <p className="text-[13px] font-bold text-[var(--ink)]">Как устроен план</p>
        <ol className="mt-2 space-y-1.5 text-[13px] font-semibold text-[var(--ink-soft)]">
          <li>
            <span className="font-bold text-[var(--accent)]">Фаза</span> — ~6 месяцев (три этапа)
          </li>
          <li>
            <span className="font-bold text-[var(--accent)]">Этап</span> — ~2 месяца внутри фазы
          </li>
          <li>
            <span className="font-bold text-[var(--accent)]">Шаг</span> — конкретное действие; отметь —
            попадёт на Главную
          </li>
        </ol>
      </div>

      {groups.length === 0 ? (
        <p className="text-[14px] font-semibold text-[var(--ink-soft)]">
          План пуст — добавь первый этап ниже.
        </p>
      ) : null}

      {groups.map((grp, gi) => {
        const skin = PALETTE[gi % PALETTE.length];
        return (
          <section
            key={grp.phaseNum}
            className="space-y-3 rounded-[22px] border border-[var(--line)] p-3 sm:p-4"
            style={{ background: `color-mix(in srgb, ${skin.done} 6%, white)` }}
          >
            <div className="flex flex-wrap items-start justify-between gap-2 px-1">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: skin.done }}>
                  Фаза · 6 месяцев
                </p>
                <h3 className="font-display text-[1.35rem]" style={{ color: skin.done }}>
                  {grp.label}
                </h3>
                {(grp.start || grp.end) && (
                  <p className="mt-0.5 text-[12px] font-semibold text-[var(--ink-soft)]">
                    {[grp.start, grp.end].filter(Boolean).join(" → ")}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-extrabold tabular-nums" style={{ color: skin.done }}>
                  {grp.progress}%
                </span>
                {grp.stages.length > 0 ? (
                  <ActionBtn
                    label="Удалить фазу"
                    danger
                    disabled={busyId === `del-phase-${grp.phaseNum}`}
                    onClick={() => void deletePhaseGroup(grp)}
                  />
                ) : null}
              </div>
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
                  setBusyId={setBusyId}
                  onChanged={onChanged}
                />
              ))}
            </div>

            {addingStageFor === grp.phaseNum ? (
              <form onSubmit={addStage} className="flex flex-wrap gap-2 rounded-[16px] bg-white p-3">
                <input
                  className="field min-w-0 flex-1"
                  value={newStageTitle}
                  autoFocus
                  placeholder="Название этапа"
                  onChange={(e) => setNewStageTitle(e.target.value)}
                />
                <button type="submit" className="btn btn-primary" disabled={busyId === "add-stage"}>
                  Добавить этап
                </button>
                <button type="button" className="btn" onClick={() => setAddingStageFor(null)}>
                  Отмена
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="w-full rounded-[16px] border border-dashed px-3 py-2.5 text-[13px] font-bold"
                style={{ color: skin.done, borderColor: skin.soft }}
                onClick={() => {
                  setAddingStageFor(grp.phaseNum);
                  setNewStageTitle("");
                }}
              >
                + Этап в эту фазу
              </button>
            )}
          </section>
        );
      })}

      {addingStageFor === "end" ? (
        <form onSubmit={addStage} className="surface flex flex-wrap gap-2 p-4">
          <input
            className="field min-w-0 flex-1"
            value={newStageTitle}
            autoFocus
            placeholder="Название этапа"
            onChange={(e) => setNewStageTitle(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={busyId === "add-stage"}>
            Добавить этап
          </button>
          <button type="button" className="btn" onClick={() => setAddingStageFor(null)}>
            Отмена
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="btn w-full"
          onClick={() => {
            setAddingStageFor("end");
            setNewStageTitle("");
          }}
        >
          + Новый этап (продолжит план / следующую фазу)
        </button>
      )}
    </div>
  );
}
