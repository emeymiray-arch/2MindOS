"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/client-api";
import { EmptyState, StatusChip } from "@/components/ui/Progress";
import { toast } from "@/components/ui/Toast";
import { PlanQuestB } from "@/components/plan/PlanQuestB";

type Reality = {
  actual: number;
  expected: number | null;
  status: "ahead" | "on_track" | "behind" | "no_plan";
  label: string;
  detail: string;
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
};

export default function GoalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const goalId = String(params.id ?? "");
  const [data, setData] = useState<GoalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [outcomeText, setOutcomeText] = useState("");

  const load = useCallback(async () => {
    if (!goalId) return;
    const res = await apiGet(`/api/os?goalId=${encodeURIComponent(goalId)}`);
    if (res.ok) setData(res.data as unknown as GoalDetail);
    setLoading(false);
  }, [goalId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function closeGoal() {
    if (!window.confirm("Закрыть эту цель?")) return;
    const res = await apiPost("/api/goals", { action: "archive", id: goalId });
    if (!res.ok) toast(res.error ?? "Не удалось", "warn");
    else {
      toast("Закрыто", "ok");
      router.push("/goals");
    }
  }

  async function setSide(layer: "inner" | "outer") {
    const res = await apiPost("/api/goals", { action: "update", id: goalId, layer });
    if (!res.ok) toast(res.error ?? "Не сохранилось", "warn");
    else {
      toast(layer === "inner" ? "Внутреннее" : "Внешнее", "ok");
      await load();
    }
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
      toast("Результат записан", "ok");
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

  return (
    <div className="space-y-10">
      <div>
        <Link href="/goals" className="text-[13px] font-bold text-[var(--accent)]">
          ← Намерения
        </Link>
        <h1 className="page-title mt-4 text-[2.1rem] md:text-[2.5rem]">{goal.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusChip status={reality.status} label={reality.label} />
          {goal.area?.name ? (
            <span className="text-[13px] font-medium text-[var(--ink-faint)]">{goal.area.name}</span>
          ) : null}
          <span className="text-[13px] font-medium text-[var(--c-violet)]">
            {goal.layer === "inner"
              ? "Внутреннее"
              : goal.layer === "outer"
                ? "Внешнее"
                : "Сторона не задана"}
          </span>
        </div>
        {reality.detail ? (
          <p className="mt-3 text-[14px] font-medium text-[var(--ink-soft)]">{reality.detail}</p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn"
            data-active={goal.layer === "inner"}
            onClick={() => void setSide("inner")}
          >
            Внутреннее
          </button>
          <button
            type="button"
            className="btn"
            data-active={goal.layer === "outer"}
            onClick={() => void setSide("outer")}
          >
            Внешнее
          </button>
          <button type="button" className="btn" onClick={() => void closeGoal()}>
            Закрыть цель
          </button>
        </div>
      </div>

      <form onSubmit={addOutcome} className="flex gap-2 border-t border-[var(--line)] pt-6">
        <input
          className="field min-w-0 flex-1"
          value={outcomeText}
          onChange={(e) => setOutcomeText(e.target.value)}
          placeholder="Что изменилось?"
        />
        <button type="submit" className="btn shrink-0">
          Результат
        </button>
      </form>

      {!plan ? (
        <div className="space-y-3">
          <p className="text-[15px] font-medium text-[var(--ink-soft)]">Плана ещё нет.</p>
          <button type="button" className="btn btn-primary" onClick={() => void ensurePlan()}>
            Открыть план
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
    </div>
  );
}
