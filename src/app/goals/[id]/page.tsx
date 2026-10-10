"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/client-api";
import { EmptyState } from "@/components/ui/Progress";
import { PageHero, WidgetHead } from "@/components/ui/Widgets";
import { toast } from "@/components/ui/Toast";
import { PlanQuestB } from "@/components/plan/PlanQuestB";

type Reality = {
  actual: number;
  expected: number | null;
  status: "ahead" | "on_track" | "behind" | "no_plan";
  label: string;
  detail: string;
};

type Module = { id: string; title: string; done: boolean; deadlineEnd?: string };
type Phase = {
  id: string;
  title: string;
  progress: number;
  status?: string;
  deadlineStart?: string;
  deadlineEnd?: string;
  durationWeeks?: number;
  modules: Module[];
};

type GoalDetail = {
  goal: {
    id: string;
    title: string;
    description?: string;
    area?: { name?: string } | null;
    layer?: "inner" | "outer";
    horizonStageLabel?: string;
  };
  reality: Reality;
  plan: {
    id: string;
    title: string;
    progress: number;
    desiredResult?: string;
    phases: Phase[];
    phaseGroups?: {
      phaseNum: number;
      label: string;
      start?: string;
      end?: string;
      progress: number;
      stages: Phase[];
    }[];
  } | null;
};

export default function GoalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const goalId = String(params.id ?? "");
  const [data, setData] = useState<GoalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [outcomeText, setOutcomeText] = useState("");
  const [celebrate, setCelebrate] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const load = useCallback(async () => {
    if (!goalId) return;
    const res = await apiGet(`/api/os?goalId=${encodeURIComponent(goalId)}`);
    if (res.ok) setData(res.data as unknown as GoalDetail);
    setLoading(false);
  }, [goalId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function completeGoal() {
    if (finishing) return;
    setFinishing(true);
    const res = await apiPost("/api/goals", {
      action: "complete",
      id: goalId,
      note: outcomeText.trim() || undefined,
    });
    setFinishing(false);
    if (!res.ok) {
      toast(res.error ?? "Не удалось завершить", "warn");
      return;
    }
    setCelebrate(false);
    toast("Цель завершена", "ok");
    router.push("/goals");
  }

  async function setSide(layer: "inner" | "outer") {
    const res = await apiPost("/api/goals", { action: "update", id: goalId, layer });
    if (!res.ok) toast(res.error ?? "Не сохранилось", "warn");
    else await load();
  }

  async function ensurePlan() {
    const res = await apiPost("/api/work-plans", {
      action: "create",
      ownerType: "goal",
      ownerId: goalId,
    });
    if (!res.ok) toast(res.error ?? "Не удалось", "warn");
    else await load();
  }

  async function addOutcome(e: React.FormEvent) {
    e.preventDefault();
    if (!outcomeText.trim()) return;
    const res = await apiPost("/api/life", {
      action: "createOutcome",
      text: outcomeText.trim(),
      goalId,
    });
    if (!res.ok) toast(res.error ?? "Не сохранилось", "warn");
    else {
      setOutcomeText("");
      toast("Записано", "ok");
    }
  }

  if (loading) return <p className="text-[var(--ink-faint)]">…</p>;
  if (!data) {
    return (
      <EmptyState
        title="Не найдено"
        action={
          <Link href="/goals" className="btn">
            Назад
          </Link>
        }
      />
    );
  }

  const { goal, reality, plan } = data;
  const allSteps = plan?.phases.flatMap((p) => p.modules) ?? [];
  const stepsDone = allSteps.filter((m) => m.done).length;
  const stepsTotal = allSteps.length;
  const progress = Math.round(plan?.progress ?? reality.actual ?? 0);
  const expected = Math.round(reality.expected ?? 0);
  const stagesTotal = plan?.phases.length ?? 0;
  const stagesDone =
    plan?.phases.filter((p) => p.status === "done" || p.progress >= 100).length ?? 0;

  return (
    <div className="page-stack">
      <Link href="/goals" className="widget-link w-fit">
        ← Цели
      </Link>

      <PageHero
        title={goal.title}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="chip-soft"
              data-active={goal.layer === "inner"}
              onClick={() => void setSide("inner")}
            >
              Внутр
            </button>
            <button
              type="button"
              className="chip-soft"
              data-active={goal.layer === "outer"}
              onClick={() => void setSide("outer")}
            >
              Внеш
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setCelebrate(true)}
            >
              Завершить
            </button>
          </div>
        }
      />

      <section className="panel goal-stats">
        <div className="goal-stat">
          <p className="goal-stat-label">План</p>
          <p className="goal-stat-value" style={{ color: "var(--accent)" }}>
            {progress}%
          </p>
        </div>
        <div className="goal-stat">
          <p className="goal-stat-label">Шаги</p>
          <p className="goal-stat-value" style={{ color: "#34d399" }}>
            {stepsDone}
            <span className="goal-stat-den">/{stepsTotal || 0}</span>
          </p>
        </div>
        <div className="goal-stat">
          <p className="goal-stat-label">Этапы</p>
          <p className="goal-stat-value" style={{ color: "#a855f7" }}>
            {stagesDone}
            <span className="goal-stat-den">/{stagesTotal || 0}</span>
          </p>
        </div>
        <div className="goal-stat">
          <p className="goal-stat-label">Ожидание</p>
          <p className="goal-stat-value" style={{ color: "#38bdf8" }}>
            {expected > 0 ? `${expected}%` : "—"}
          </p>
        </div>
        <div className="goal-stat-bar">
          <span style={{ width: `${progress}%` }} />
        </div>
      </section>

      <form onSubmit={addOutcome} className="panel flex flex-wrap items-end gap-3">
        <div className="min-w-[12rem] flex-1">
          <WidgetHead title="Результат" tone="green" />
          <input
            className="field"
            value={outcomeText}
            onChange={(e) => setOutcomeText(e.target.value)}
            placeholder="Что изменилось?"
          />
        </div>
        <button type="submit" className="btn btn-primary shrink-0">
          Записать
        </button>
      </form>

      {!plan ? (
        <section className="panel">
          <WidgetHead title="План" tone="violet" />
          <p className="mb-3 text-[14px] text-[var(--ink-soft)]">Плана ещё нет.</p>
          <button type="button" className="btn btn-primary" onClick={() => void ensurePlan()}>
            Открыть план
          </button>
        </section>
      ) : (
        <PlanQuestB
          planId={plan.id}
          phases={plan.phases}
          phaseGroups={plan.phaseGroups}
          onChanged={() => void load()}
        />
      )}

      {celebrate ? (
        <div
          className="celebrate-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="celebrate-title"
          onClick={() => !finishing && setCelebrate(false)}
        >
          <div
            className="celebrate-card"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="celebrate-kicker">Цель закрыта</p>
            <h2 id="celebrate-title" className="celebrate-title">
              {goal.title}
            </h2>
            <p className="celebrate-lede">Красиво. Ты довела это до конца.</p>
            <div className="celebrate-stats">
              <span>{progress}%</span>
              <span>
                {stepsDone}/{stepsTotal || 0} шагов
              </span>
              <span>
                {stagesDone}/{stagesTotal || 0} этапов
              </span>
            </div>
            {goal.area?.name ? (
              <p className="celebrate-area">{goal.area.name}</p>
            ) : null}
            <div className="celebrate-actions">
              <button
                type="button"
                className="btn"
                disabled={finishing}
                onClick={() => setCelebrate(false)}
              >
                Ещё нет
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={finishing}
                onClick={() => void completeGoal()}
              >
                {finishing ? "…" : "Завершить"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
