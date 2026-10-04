"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/client-api";
import { EmptyState, StatusChip } from "@/components/ui/Progress";
import { DualRing } from "@/components/ui/Charts";
import { IconInner, IconOuter, IconPath, IconSteps } from "@/components/ui/Icons";
import { KpiTile, PageHero, WidgetHead } from "@/components/ui/Widgets";
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
  const stagesDone = plan?.phases.filter((p) => p.status === "done" || p.progress >= 100).length ?? 0;
  const progress = Math.round(plan?.progress ?? reality.actual ?? 0);

  return (
    <div className="page-stack">
      <Link href="/goals" className="widget-link w-fit">
        ← Цели
      </Link>

      <PageHero
        title={goal.title}
        meta={
          <>
            <StatusChip status={reality.status} label={reality.label} />
            {goal.area?.name ? <span className="chip-soft">{goal.area.name}</span> : null}
            <button
              type="button"
              className="chip-soft"
              data-active={goal.layer === "inner"}
              onClick={() => void setSide("inner")}
            >
              Внутреннее
            </button>
            <button
              type="button"
              className="chip-soft"
              data-active={goal.layer === "outer"}
              onClick={() => void setSide("outer")}
            >
              Внешнее
            </button>
          </>
        }
        action={
          <button type="button" className="btn" onClick={() => void closeGoal()}>
            Закрыть
          </button>
        }
      />

      <div className="bento">
        <div className="span-3">
          <KpiTile
            label="Прогресс"
            value={<>{progress}%</>}
            color="#c084fc"
            icon={<IconPath size={16} />}
          />
        </div>
        <div className="span-3">
          <KpiTile
            label="Шаги"
            value={
              <>
                {stepsDone}
                <span className="kpi-den">/{allSteps.length}</span>
              </>
            }
            color="#34d399"
            icon={<IconSteps size={16} />}
          />
        </div>
        <div className="span-3">
          <KpiTile
            label="Этапы"
            value={
              <>
                {stagesDone}
                <span className="kpi-den">/{plan?.phases.length ?? 0}</span>
              </>
            }
            color="#38bdf8"
            icon={goal.layer === "outer" ? <IconOuter size={16} /> : <IconInner size={16} />}
          />
        </div>
        <div className="span-3">
          <section className="panel flex h-full items-center justify-center">
            <DualRing
              size={112}
              outer={{ percent: progress, color: "#c084fc", label: "факт" }}
              inner={{
                percent: Math.round(reality.expected ?? progress),
                color: "#38bdf8",
                label: "план",
              }}
            />
          </section>
        </div>

        <div className="span-12">
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
        </div>
      </div>

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
    </div>
  );
}
