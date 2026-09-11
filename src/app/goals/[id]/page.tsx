"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { apiGet, apiPost } from "@/lib/client-api";
import { EmptyState, ProgressRing, StatusChip } from "@/components/ui/Progress";
import { TaskRow, type TaskRowData } from "@/components/tasks/TaskRow";
import { toast } from "@/components/ui/Toast";
import { PlanQuestB } from "@/components/plan/PlanQuestB";
import { QuestTimelineB } from "@/components/plan/QuestTimelineB";

type Reality = {
  actual: number;
  expected: number | null;
  delta: number | null;
  status: "ahead" | "on_track" | "behind" | "no_plan";
  label: string;
  detail: string;
  deadlineRisk: boolean;
  daysLeft: number | null;
};

type GoalDetail = {
  goal: {
    id: string;
    title: string;
    description?: string;
    deadline?: string;
    progress: number;
    area?: { name?: string } | null;
    horizonStage?: number;
    horizonStageLabel?: string;
    horizonStageShort?: string;
    horizonWindow?: { start: string; end: string };
  };
  reality: Reality;
  week: { planned: number; completed: number; remaining: number; percent: number };
  month: {
    key: string;
    items: { id: string; title: string; done: boolean; phaseTitle?: string; deadlineEnd?: string }[];
  };
  timeline: {
    month: string;
    label: string;
    items: { id: string; title: string; date?: string; done: boolean; current: boolean }[];
  }[];
  plan: {
    id: string;
    title: string;
    progress: number;
    desiredResult?: string;
    phases: {
      id: string;
      title: string;
      progress: number;
      status?: string;
      deadlineStart?: string;
      deadlineEnd?: string;
      durationWeeks?: number;
      modules: { id: string; title: string; done: boolean; deadlineEnd?: string }[];
    }[];
    phaseGroups?: {
      phaseNum: number;
      label: string;
      start?: string;
      end?: string;
      progress: number;
      stages: {
        id: string;
        title: string;
        progress: number;
        status?: string;
        deadlineStart?: string;
        deadlineEnd?: string;
        durationWeeks?: number;
        modules: { id: string; title: string; done: boolean; deadlineEnd?: string }[];
      }[];
    }[];
  } | null;
  todayTasks: TaskRowData[];
};

const MONTH_RU = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

const MONTH_COLORS = ["#2f6bff", "#00b87a", "#ff6b3d", "#7c5cff", "#ff4d9a", "#ff9f1a"];

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return `${MONTH_RU[Number(m) - 1] ?? key} ${y}`;
}

export default function GoalDetailPage() {
  const params = useParams();
  const goalId = String(params.id ?? "");
  const [data, setData] = useState<GoalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [phaseTitle, setPhaseTitle] = useState("");
  const [moduleTitle, setModuleTitle] = useState("");
  const [modulePhaseId, setModulePhaseId] = useState("");
  const [moduleEnd, setModuleEnd] = useState("");

  const load = useCallback(async () => {
    if (!goalId) return;
    const res = await apiGet(`/api/os?goalId=${encodeURIComponent(goalId)}`);
    if (res.ok) setData(res.data as unknown as GoalDetail);
    setLoading(false);
  }, [goalId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function ensurePlan() {
    const res = await apiPost("/api/work-plans", {
      action: "create",
      ownerType: "goal",
      ownerId: goalId,
    });
    if (!res.ok) {
      toast(res.error ?? "Не удалось создать план", "warn");
      return;
    }
    toast("Квест открыт", "ok");
    await load();
  }

  async function addPhase(e: React.FormEvent) {
    e.preventDefault();
    if (!data?.plan || !phaseTitle.trim()) return;
    const res = await apiPost("/api/work-plans", {
      action: "addPhase",
      planId: data.plan.id,
      title: phaseTitle.trim(),
    });
    if (!res.ok) {
      toast(res.error ?? "Ошибка", "warn");
      return;
    }
    setPhaseTitle("");
    toast("Новый этап", "ok");
    await load();
  }

  async function addModule(e: React.FormEvent) {
    e.preventDefault();
    if (!data?.plan || !moduleTitle.trim() || !modulePhaseId) return;
    const res = await apiPost("/api/work-plans", {
      action: "addModule",
      planId: data.plan.id,
      phaseId: modulePhaseId,
      title: moduleTitle.trim(),
      deadlineEnd: moduleEnd || undefined,
    });
    if (!res.ok) {
      toast(res.error ?? "Ошибка", "warn");
      return;
    }
    setModuleTitle("");
    setModuleEnd("");
    toast("Блок добавлен", "ok");
    await load();
  }

  async function composeToday() {
    if (!data?.plan) {
      toast("Сначала создай план", "warn");
      return;
    }
    const res = await apiPost("/api/tasks", { action: "composeToday" });
    if (!res.ok) {
      toast(res.error ?? "Не удалось собрать день", "warn");
      return;
    }
    const after = await apiGet(`/api/os?goalId=${encodeURIComponent(goalId)}`);
    if (after.ok) setData(after.data as unknown as GoalDetail);
    const tasks =
      after.ok && Array.isArray((after.data as { todayTasks?: { goalId?: string; done?: boolean }[] }).todayTasks)
        ? ((after.data as { todayTasks: { goalId?: string; done?: boolean }[] }).todayTasks ?? [])
        : [];
    const mineOpen = tasks.some((t) => t.goalId === goalId && !t.done);
    if (!mineOpen) {
      toast(
        "На Главной нет шага этой цели — она не в текущем этапе или план без открытого модуля",
        "warn"
      );
      return;
    }
    toast("Шаг дня на Главной", "ok");
  }

  if (loading) return <p className="text-[var(--ink-faint)]">Открываю…</p>;
  if (!data) {
    return (
      <EmptyState
        title="Цель не найдена"
        action={
          <Link href="/goals" className="btn">
            К списку
          </Link>
        }
      />
    );
  }

  const { goal, reality, plan, week, month, timeline, todayTasks } = data;

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Link href="/goals" className="text-[13px] font-semibold text-[var(--accent)]">
          ← Цели
        </Link>
        <div className="mt-4 flex flex-wrap items-start gap-5">
          <ProgressRing value={reality.actual} expected={reality.expected} size={88} stroke={7} />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[32px] md:text-[36px]">{goal.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusChip status={reality.status} label={reality.label} />
              {goal.horizonStageLabel ? (
                <span className="rounded-full bg-[var(--bg-muted)] px-2.5 py-1 text-[12px] font-bold text-[var(--accent)]">
                  {goal.horizonStageLabel}
                </span>
              ) : null}
              {reality.deadlineRisk ? (
                <span className="rounded-full bg-[var(--behind)] px-2.5 py-1 text-[12px] font-bold text-white">
                  Риск
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </motion.div>

      <motion.section
        className="surface overflow-hidden p-5"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <p className="text-[13px] font-bold text-[var(--accent)]">Счёт</p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { label: "План", value: reality.expected == null ? "—" : `${reality.expected}%`, color: "var(--track)" },
            { label: "Факт", value: `${reality.actual}%`, color: "var(--accent)" },
            {
              label: "Δ",
              value:
                reality.delta == null
                  ? "—"
                  : `${reality.delta > 0 ? "+" : ""}${reality.delta}%`,
              color: (reality.delta ?? 0) < 0 ? "var(--behind)" : "var(--ahead)",
            },
          ].map((cell) => (
            <div
              key={cell.label}
              className="rounded-[16px] px-3 py-3 text-center"
              style={{ background: `color-mix(in srgb, ${cell.color} 14%, white)` }}
            >
              <p className="text-[12px] font-bold" style={{ color: cell.color }}>
                {cell.label}
              </p>
              <p className="mt-1 font-display text-[1.55rem] tabular-nums" style={{ color: cell.color }}>
                {cell.value}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[13px]">
          <div className="rounded-[14px] bg-[var(--c-blue-soft)] px-2 py-2.5 font-semibold text-[var(--c-blue)]">
            {week.completed}/{week.planned} нед.
          </div>
          <div className="rounded-[14px] bg-[var(--c-orange-soft)] px-2 py-2.5 font-semibold text-[var(--c-orange)]">
            {week.remaining} осталось
          </div>
          <div className="rounded-[14px] bg-[var(--c-green-soft)] px-2 py-2.5 font-semibold text-[var(--c-green)]">
            {week.percent}%
          </div>
        </div>
      </motion.section>

      <section>
        <h2 className="font-display text-[1.5rem]">{monthLabel(month.key)}</h2>
        {month.items.length === 0 ? null : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {month.items.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3 rounded-[16px] bg-white px-3.5 py-3 shadow-[var(--shadow-sm)]"
                style={{
                  borderLeft: `4px solid ${
                    item.done ? "var(--ahead)" : MONTH_COLORS[i % MONTH_COLORS.length]
                  }`,
                }}
              >
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-xl text-[12px] font-black text-white"
                  style={{
                    background: item.done
                      ? "var(--ahead)"
                      : MONTH_COLORS[i % MONTH_COLORS.length],
                  }}
                >
                  {item.done ? "✓" : i + 1}
                </span>
                <p className={`truncate text-[14px] font-bold ${item.done ? "opacity-40 line-through" : ""}`}>
                  {item.title}
                </p>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-[1.5rem]">
            {plan ? plan.title : "План"}
          </h2>
          {!plan ? (
            <button type="button" className="btn btn-primary" onClick={() => void ensurePlan()}>
              Открыть
            </button>
          ) : (
            <button type="button" className="btn" onClick={() => void composeToday()}>
              В сегодня
            </button>
          )}
        </div>

        {!plan ? (
          <button type="button" className="btn btn-primary" onClick={() => void ensurePlan()}>
            Создать план
          </button>
        ) : (
          <div className="space-y-4">
            <PlanQuestB
              planId={plan.id}
              phases={plan.phases}
              phaseGroups={plan.phaseGroups}
              onChanged={() => void load()}
            />

            <form onSubmit={addPhase} className="surface space-y-3 p-4">
              <p className="text-[13px] font-bold text-[var(--accent)]">+ Этап (2 месяца)</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={phaseTitle}
                  onChange={(e) => setPhaseTitle(e.target.value)}
                  placeholder="Название этапа"
                  className="field min-w-0 flex-1"
                />
                <button type="submit" className="btn btn-primary">
                  Добавить
                </button>
              </div>
            </form>

            {plan.phases.length > 0 ? (
              <form onSubmit={addModule} className="surface space-y-3 p-4">
                <p className="text-[13px] font-bold text-[var(--accent)]">+ Шаг</p>
                <select
                  value={modulePhaseId}
                  onChange={(e) => setModulePhaseId(e.target.value)}
                  className="field w-full"
                >
                  <option value="">Этап</option>
                  {plan.phases.map((ph) => (
                    <option key={ph.id} value={ph.id}>
                      {ph.title}
                    </option>
                  ))}
                </select>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={moduleTitle}
                    onChange={(e) => setModuleTitle(e.target.value)}
                    placeholder="Конкретный шаг"
                    className="field min-w-0 flex-1"
                  />
                  <input
                    type="date"
                    value={moduleEnd}
                    onChange={(e) => setModuleEnd(e.target.value)}
                    className="field"
                  />
                  <button type="submit" className="btn btn-primary">
                    Добавить
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        )}
      </section>

      {timeline.length > 0 ? (
        <section>
          <h2 className="font-display text-[1.5rem]">Путь</h2>
          <div className="surface mt-4 p-3 sm:p-4">
            <QuestTimelineB buckets={timeline} />
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="font-display text-[1.5rem]">Сегодня</h2>
        {todayTasks.length === 0 ? null : (
          <div className="surface mt-3 px-4">
            {todayTasks.map((t) => (
              <TaskRow key={t.id} task={t} onToggle={() => void load()} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
