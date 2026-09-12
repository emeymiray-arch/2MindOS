"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { apiGet, apiPost } from "@/lib/client-api";
import { EmptyState, ProgressRing, StatusChip } from "@/components/ui/Progress";
import { TaskRow, type TaskRowData } from "@/components/tasks/TaskRow";
import { toast } from "@/components/ui/Toast";
import { PlanQuestB } from "@/components/plan/PlanQuestB";

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

export default function GoalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const goalId = String(params.id ?? "");
  const [data, setData] = useState<GoalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  const load = useCallback(async () => {
    if (!goalId) return;
    const res = await apiGet(`/api/os?goalId=${encodeURIComponent(goalId)}`);
    if (res.ok) setData(res.data as unknown as GoalDetail);
    setLoading(false);
  }, [goalId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveTitle() {
    const title = titleDraft.trim();
    if (!title) return;
    const res = await apiPost("/api/goals", { action: "update", id: goalId, title });
    if (!res.ok) {
      toast(res.error ?? "Не удалось изменить", "warn");
      return;
    }
    setRenaming(false);
    toast("Название обновлено", "ok");
    await load();
  }

  async function archiveGoal() {
    if (!window.confirm("Убрать цель в архив?")) return;
    const res = await apiPost("/api/goals", { action: "archive", id: goalId });
    if (!res.ok) {
      toast(res.error ?? "Не удалось", "warn");
      return;
    }
    toast("В архиве", "ok");
    router.push("/goals");
  }

  async function deleteGoal() {
    if (!window.confirm("Удалить цель полностью? Это нельзя отменить.")) return;
    const res = await apiPost("/api/goals", { action: "delete", id: goalId });
    if (!res.ok) {
      toast(res.error ?? "Не удалось удалить", "warn");
      return;
    }
    toast("Удалила", "ok");
    router.push("/goals");
  }

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
    toast("План открыт", "ok");
    await load();
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

  const { goal, reality, plan, week, todayTasks } = data;

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Link href="/goals" className="text-[13px] font-semibold text-[var(--accent)]">
          ← Цели
        </Link>
        <div className="mt-4 flex flex-wrap items-start gap-5">
          <ProgressRing value={reality.actual} expected={reality.expected} size={88} stroke={7} />
          <div className="min-w-0 flex-1">
            {renaming ? (
              <form
                className="flex flex-wrap gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void saveTitle();
                }}
              >
                <input
                  className="field min-w-0 flex-1 font-display text-[24px]"
                  value={titleDraft}
                  autoFocus
                  onChange={(e) => setTitleDraft(e.target.value)}
                />
                <button type="submit" className="btn btn-primary">
                  Сохранить
                </button>
                <button type="button" className="btn" onClick={() => setRenaming(false)}>
                  Отмена
                </button>
              </form>
            ) : (
              <h1 className="font-display text-[32px] md:text-[36px]">{goal.title}</h1>
            )}
            <p className="mt-2 text-[14px] font-semibold text-[var(--ink-soft)]">
              Цель → план из фаз → этапы → шаги. Шаги появляются на Главной.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusChip status={reality.status} label={reality.label} />
              {goal.horizonStageLabel ? (
                <span className="rounded-full bg-[var(--bg-muted)] px-2.5 py-1 text-[12px] font-bold text-[var(--accent)]">
                  {goal.horizonStageLabel}
                </span>
              ) : null}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setTitleDraft(goal.title);
                  setRenaming(true);
                }}
              >
                Изменить название
              </button>
              <button type="button" className="btn" onClick={() => void archiveGoal()}>
                В архив
              </button>
              <button
                type="button"
                className="btn"
                style={{ color: "var(--behind)" }}
                onClick={() => void deleteGoal()}
              >
                Удалить цель
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      <section className="surface grid grid-cols-3 gap-2 p-4 text-center">
        <div>
          <p className="text-[11px] font-bold text-[var(--ink-faint)]">Факт</p>
          <p className="font-display text-[1.4rem] text-[var(--accent)]">{reality.actual}%</p>
        </div>
        <div>
          <p className="text-[11px] font-bold text-[var(--ink-faint)]">План</p>
          <p className="font-display text-[1.4rem]">
            {reality.expected == null ? "—" : `${reality.expected}%`}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-bold text-[var(--ink-faint)]">Неделя</p>
          <p className="font-display text-[1.4rem]">
            {week.completed}/{week.planned}
          </p>
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-[1.5rem]">План</h2>
            <p className="mt-1 text-[13px] font-semibold text-[var(--ink-soft)]">
              Сверху вниз: фаза → этап → шаг. У каждого есть «Изменить» и «Удалить».
            </p>
          </div>
          {!plan ? (
            <button type="button" className="btn btn-primary" onClick={() => void ensurePlan()}>
              Создать план
            </button>
          ) : null}
        </div>

        {!plan ? (
          <div className="surface space-y-3 p-5">
            <p className="text-[14px] font-semibold text-[var(--ink-soft)]">
              Пока плана нет. Создай его — внутри появятся фазы, этапы и шаги.
            </p>
            <button type="button" className="btn btn-primary" onClick={() => void ensurePlan()}>
              Создать план
            </button>
          </div>
        ) : (
          <PlanQuestB
            planId={plan.id}
            phases={plan.phases}
            phaseGroups={plan.phaseGroups}
            onChanged={() => void load()}
          />
        )}
      </section>

      <section>
        <h2 className="font-display text-[1.5rem]">Сегодня по этой цели</h2>
        <p className="mt-1 text-[13px] font-semibold text-[var(--ink-soft)]">
          Сюда попадают открытые шаги текущего этапа.
        </p>
        {todayTasks.length === 0 ? (
          <p className="mt-3 text-[14px] font-semibold text-[var(--ink-faint)]">
            Пока пусто — отметь или добавь шаг в плане выше.
          </p>
        ) : (
          <div className="surface mt-3 px-4">
            {todayTasks.map((t) => (
              <TaskRow key={t.id} task={t} onChanged={() => void load()} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
