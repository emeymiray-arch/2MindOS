import { id, now, todayKey } from "@/lib/id";
import {
  activePlan,
  calcWorkPlanProgress,
  createWorkPlan,
  currentPhase,
  currentWorkPhase,
  ensureActivePlan,
  ensurePhaseModules,
  findWorkPlan,
  milestoneProgress,
  phasesOf,
  syncWorkPlanProgress,
  weekStartMonday,
} from "@/lib/lifeos";
import { apiError, apiJson } from "@/lib/api-response";
import { getStore, updateStore } from "@/lib/store";
import { calcGoalProgress, goalAnalytics, tasksForDate } from "@/lib/tasks";
import { formatMinutes, sumMinutesForGoal } from "@/lib/time";
import type { Goal, GoalStage, PriorityLevel } from "@/lib/types";
import {
  bucketForHorizonStage,
  effectiveHorizonStage,
  groupGoalsByHorizonStage,
  horizonStageLabel,
  horizonStageShort,
  stageWindow,
  horizonAnchor,
  currentHorizonStage,
  normalizePlanCalendar,
  rescheduleAllStages,
  unlockNextPlanStep,
  STAGES_PER_PHASE,
} from "@/lib/plan-calendar";

function weekAgo(iso: string) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() - 6);
  return d.toISOString().slice(0, 10);
}

function enrichGoal(store: Awaited<ReturnType<typeof getStore>>, g: Goal) {
  const today = todayKey();
  const minutesWeek = sumMinutesForGoal(store, g.id, weekAgo(today), today);
  const workPlan = g.workPlanId ? findWorkPlan(store, g.workPlanId) : undefined;
  const progress = workPlan ? calcWorkPlanProgress(workPlan) : calcGoalProgress(g, store);
  const phase = workPlan ? currentWorkPhase(workPlan) : currentPhase(g);
  const weekStart = weekStartMonday(todayKey());
  const week = store.weeks?.find((w) => w.weekStart === weekStart);
  const weekObj =
    week?.objectives.filter((o) => o.goalId === g.id || o.workPlanId === g.workPlanId) ?? [];
  const todayTasks = tasksForDate(store, todayKey()).filter(
    (t) => t.goalId === g.id || t.workPlanId === g.workPlanId
  );
  return {
    ...g,
    progress,
    horizonStage: effectiveHorizonStage(g),
    horizonStageLabel: horizonStageLabel(effectiveHorizonStage(g)),
    horizonStageShort: horizonStageShort(effectiveHorizonStage(g)),
    horizonWindow: stageWindow(horizonAnchor(store), effectiveHorizonStage(g)),
    bucket: bucketForHorizonStage(effectiveHorizonStage(g), currentHorizonStage(store)),
    workPlanId: g.workPlanId ?? workPlan?.id,
    workPlan: workPlan
      ? {
          id: workPlan.id,
          title: workPlan.title,
          progress: calcWorkPlanProgress(workPlan),
          desiredResult: workPlan.desiredResult,
          status: workPlan.status,
        }
      : null,
    analytics: goalAnalytics(g, store.stageDayLogs),
    area: store.spheres.find((s) => s.id === g.lifeAreaId) ?? null,
    plan: g.planId ? store.plans?.find((p) => p.id === g.planId) ?? null : activePlan(store) ?? null,
    currentPhase: phase
      ? {
          id: phase.id,
          title: phase.title,
          status: phase.status,
          done: "done" in phase ? Boolean((phase as GoalStage).done) : phase.status === "done",
        }
      : null,
    planActs: workPlan
      ? phasesOf(workPlan)
          .sort((a, b) => a.order - b.order)
          .map((ph) => ({ id: ph.id, title: ph.title, progress: milestoneProgress(ph) }))
      : [],
    weekObjectives: weekObj,
    todayActions: todayTasks,
    timeMinutesWeek: minutesWeek,
    timeFormattedWeek: formatMinutes(minutesWeek),
  };
}

function goalsPayload(store: Awaited<ReturnType<typeof getStore>>, showArchived = false) {
  const goals = store.goals.filter((g) => (showArchived ? g.archived : !g.archived && g.active));
  const enriched = goals.map((g) => enrichGoal(store, g));
  const curStage = currentHorizonStage(store);
  const stageGroups = groupGoalsByHorizonStage(store, goals).map((grp) => ({
    order: grp.order,
    label: grp.label,
    short: grp.short,
    start: grp.start,
    end: grp.end,
    current: grp.current,
    goals: grp.goals.map((g) => enrichGoal(store, g)),
  }));
  return {
    goals: enriched,
    stageGroups,
    currentStage: curStage,
    areas: store.spheres,
    plan: activePlan(store),
    foundation: goals
      .filter((g) => bucketForHorizonStage(effectiveHorizonStage(g), curStage) === "foundation")
      .map((g) => enrichGoal(store, g)),
    development: goals
      .filter((g) => bucketForHorizonStage(effectiveHorizonStage(g), curStage) === "development")
      .map((g) => enrichGoal(store, g)),
    later: goals
      .filter((g) => bucketForHorizonStage(effectiveHorizonStage(g), curStage) === "later")
      .map((g) => enrichGoal(store, g)),
  };
}

export async function GET(request: Request) {
  try {
    const store = await getStore();
    const showArchived = new URL(request.url).searchParams.get("archived") === "1";
    const goalId = new URL(request.url).searchParams.get("id");
    if (goalId) {
      const g = store.goals.find((x) => x.id === goalId);
      if (!g) return apiJson({ error: "not found" }, { status: 404 });
      return apiJson({ goal: enrichGoal(store, g), areas: store.spheres, plan: activePlan(store) });
    }
    return apiJson(goalsPayload(store, showArchived));
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = String(body.action ?? "create");

    if (action === "create") {
      const title = String(body.title ?? "").trim();
      if (!title) return apiJson({ error: "title" }, { status: 400 });
      const store = await updateStore((s) => {
        const plan = ensureActivePlan(s);
        const t = now();
        const nodeId = id();
        s.nodes.unshift({
          id: nodeId,
          kind: "goal",
          title,
          metadata: {},
          salience: 0.9,
          createdAt: t,
          updatedAt: t,
          sphereId: body.lifeAreaId ? String(body.lifeAreaId) : undefined,
        });
        const stageRaw = body.horizonStage != null ? Number(body.horizonStage) : NaN;
        const horizonStage =
          Number.isFinite(stageRaw) && stageRaw >= 1 ? Math.floor(stageRaw) : 1;
        const goal: Goal = {
          id: id(),
          nodeId,
          title,
          description: body.description ? String(body.description) : undefined,
          deadline: body.deadline ? String(body.deadline) : undefined,
          stages: [],
          notes: body.notes ? String(body.notes) : undefined,
          progress: 0,
          active: true,
          archived: false,
          createdAt: t,
          lifeAreaId: body.lifeAreaId ? String(body.lifeAreaId) : undefined,
          planId: plan.id,
          priority: (body.priority as PriorityLevel) || "medium",
          status: "active",
          horizonStage,
          bucket: bucketForHorizonStage(horizonStage, currentHorizonStage(s)),
        };
        s.goals.unshift(goal);
        if (!s.workPlans) s.workPlans = [];
        const wp = createWorkPlan({
          ownerType: "goal",
          ownerId: goal.id,
          title: `План: ${goal.title}`,
          deadline: goal.deadline,
          phases: [],
        });
        normalizePlanCalendar(wp, s);
        s.workPlans.push(wp);
        goal.workPlanId = wp.id;
        unlockNextPlanStep(s, wp.id);
        syncWorkPlanProgress(s, wp);
      });
      return apiJson(goalsPayload(store));
    }

    if (action === "update") {
      const store = await updateStore((s) => {
        const g = s.goals.find((x) => x.id === body.id);
        if (!g) return;
        if (body.title != null) g.title = String(body.title);
        if (body.description !== undefined) g.description = body.description || undefined;
        if (body.deadline !== undefined) g.deadline = body.deadline || undefined;
        if (body.notes !== undefined) g.notes = body.notes || undefined;
        if (body.lifeAreaId !== undefined) g.lifeAreaId = body.lifeAreaId || undefined;
        if (body.priority != null) g.priority = body.priority as PriorityLevel;
        if (body.horizonStage != null) {
          const n = Math.floor(Number(body.horizonStage));
          if (Number.isFinite(n) && n >= 1) {
            g.horizonStage = n;
            g.bucket = bucketForHorizonStage(n, currentHorizonStage(s));
            if (g.workPlanId) {
              const wp = findWorkPlan(s, g.workPlanId);
              if (wp) rescheduleAllStages(wp, s);
            }
          }
        } else if (body.bucket != null) {
          // Deprecated write — map bucket → stage, never store bucket as SoT alone.
          const cur = currentHorizonStage(s);
          const phaseBase = (Math.ceil(cur / STAGES_PER_PHASE) - 1) * STAGES_PER_PHASE;
          const b = String(body.bucket);
          g.horizonStage =
            b === "foundation"
              ? phaseBase + 1
              : b === "development"
                ? phaseBase + 2
                : phaseBase + STAGES_PER_PHASE + 1;
          g.bucket = bucketForHorizonStage(g.horizonStage, cur);
        }
        if (body.status != null) {
          g.status = body.status;
          g.active = body.status === "active";
          g.archived = body.status === "archived";
        }
        if (body.planId !== undefined) g.planId = body.planId || undefined;
      });
      return apiJson(goalsPayload(store));
    }

    if (action === "archive") {
      const store = await updateStore((s) => {
        const g = s.goals.find((x) => x.id === body.id);
        if (g) {
          g.archived = true;
          g.active = false;
          g.status = "archived";
        }
      });
      return apiJson(goalsPayload(store));
    }

    if (action === "delete") {
      const store = await updateStore((s) => {
        s.goals = s.goals.filter((x) => x.id !== body.id);
      });
      return apiJson(goalsPayload(store));
    }

    if (action === "addStage") {
      const goalId = String(body.goalId ?? "");
      const title = String(body.title ?? "").trim();
      if (!goalId || !title) return apiJson({ error: "fields" }, { status: 400 });
      const store = await updateStore((s) => {
        const g = s.goals.find((x) => x.id === goalId);
        if (!g) return;
        if (!s.workPlans) s.workPlans = [];
        let wp = g.workPlanId ? findWorkPlan(s, g.workPlanId) : undefined;
        if (!wp) {
          wp = createWorkPlan({
            ownerType: "goal",
            ownerId: g.id,
            title: `План: ${g.title}`,
            deadline: g.deadline,
            phases: [],
          });
          normalizePlanCalendar(wp, s);
          s.workPlans.push(wp);
          g.workPlanId = wp.id;
        }
        const phase =
          phasesOf(wp).find((p) => p.status === "active") ??
          [...phasesOf(wp)].sort((a, b) => a.order - b.order)[0];
        if (!phase) return;
        const modules = ensurePhaseModules(phase);
        modules.push({
          id: id(),
          title,
          done: false,
          order: modules.length + 1,
          deadlineStart: body.deadlineStart ? String(body.deadlineStart) : phase.deadlineStart,
          deadlineEnd: body.deadlineEnd ? String(body.deadlineEnd) : phase.deadlineEnd,
        });
        phase.modules = modules;
        phase.milestones = modules;
        unlockNextPlanStep(s, wp.id);
        syncWorkPlanProgress(s, wp);
      });
      return apiJson(goalsPayload(store));
    }

    if (
      action === "toggleStage" ||
      action === "activateStage" ||
      action === "updateStage" ||
      action === "archiveStage" ||
      action === "unarchiveStage" ||
      action === "deleteStage"
    ) {
      return apiJson(
        {
          error:
            "Этапы цели ведутся в плане (WorkPlan). Меняй блоки плана, не legacy Goal.stages.",
        },
        { status: 400 }
      );
    }

    return apiJson({ error: "unknown" }, { status: 400 });
  } catch (e) {
    return apiError(e);
  }
}
