import { id, now, todayKey } from "@/lib/id";
import {
  activePlan,
  calcWorkPlanProgress,
  currentPhase,
  currentWorkPhase,
  ensureActivePlan,
  findWorkPlan,
  weekStartMonday,
} from "@/lib/lifeos";
import { apiError, apiJson } from "@/lib/api-response";
import { getStore, updateStore } from "@/lib/store";
import { calcGoalProgress, goalAnalytics, tasksForDate } from "@/lib/tasks";
import type { Goal, GoalStage, PlanBucket, PriorityLevel } from "@/lib/types";

function enrichGoal(store: Awaited<ReturnType<typeof getStore>>, g: Goal) {
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
    weekObjectives: weekObj,
    todayActions: todayTasks,
  };
}

function goalsPayload(store: Awaited<ReturnType<typeof getStore>>, showArchived = false) {
  const goals = store.goals.filter((g) => (showArchived ? g.archived : !g.archived && g.active));
  return {
    goals: goals.map((g) => enrichGoal(store, g)),
    areas: store.spheres,
    plan: activePlan(store),
    foundation: goals
      .filter((g) => (g.bucket ?? "development") === "foundation")
      .map((g) => enrichGoal(store, g)),
    development: goals
      .filter((g) => (g.bucket ?? "development") === "development")
      .map((g) => enrichGoal(store, g)),
    later: goals.filter((g) => g.bucket === "later").map((g) => enrichGoal(store, g)),
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
          bucket: (body.bucket as PlanBucket) || "development",
        };
        s.goals.unshift(goal);
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
        if (body.bucket != null) g.bucket = body.bucket as PlanBucket;
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
        const hasActive = g.stages.some((st) => !st.archived && st.status === "active");
        const stage: GoalStage = {
          id: id(),
          title,
          done: false,
          deadlineStart: body.deadlineStart ? String(body.deadlineStart) : undefined,
          deadlineEnd: body.deadlineEnd ? String(body.deadlineEnd) : undefined,
          order: g.stages.length + 1,
          status: hasActive ? "planned" : "active",
          progress: 0,
        };
        g.stages.push(stage);
        g.progress = calcGoalProgress(g);
      });
      return apiJson(goalsPayload(store));
    }

    if (action === "toggleStage") {
      const store = await updateStore((s) => {
        const g = s.goals.find((x) => x.id === body.goalId);
        const st = g?.stages.find((x) => x.id === body.stageId);
        if (!st || !g) return;
        st.done = Boolean(body.done ?? !st.done);
        st.status = st.done ? "done" : "active";
        st.progress = st.done ? 100 : st.progress ?? 0;
        g.progress = calcGoalProgress(g);
      });
      return apiJson(goalsPayload(store));
    }

    if (action === "activateStage") {
      const store = await updateStore((s) => {
        const g = s.goals.find((x) => x.id === body.goalId);
        if (!g) return;
        for (const st of g.stages) {
          if (st.archived || st.done) continue;
          st.status = st.id === body.stageId ? "active" : "planned";
        }
      });
      return apiJson(goalsPayload(store));
    }

    if (action === "updateStage") {
      const store = await updateStore((s) => {
        const g = s.goals.find((x) => x.id === body.goalId);
        const st = g?.stages.find((x) => x.id === body.stageId);
        if (!st) return;
        if (body.title != null) st.title = String(body.title);
        if (body.deadlineStart !== undefined) st.deadlineStart = body.deadlineStart || undefined;
        if (body.deadlineEnd !== undefined) st.deadlineEnd = body.deadlineEnd || undefined;
        if (body.status != null) st.status = body.status;
        if (g) g.progress = calcGoalProgress(g);
      });
      return apiJson(goalsPayload(store));
    }

    if (action === "archiveStage") {
      const store = await updateStore((s) => {
        const g = s.goals.find((x) => x.id === body.goalId);
        const st = g?.stages.find((x) => x.id === body.stageId);
        if (st) st.archived = true;
        if (g) g.progress = calcGoalProgress(g);
      });
      return apiJson(goalsPayload(store));
    }

    if (action === "unarchiveStage") {
      const store = await updateStore((s) => {
        const g = s.goals.find((x) => x.id === body.goalId);
        const st = g?.stages.find((x) => x.id === body.stageId);
        if (st) st.archived = false;
        if (g) g.progress = calcGoalProgress(g);
      });
      return apiJson(goalsPayload(store));
    }

    if (action === "deleteStage") {
      const store = await updateStore((s) => {
        const g = s.goals.find((x) => x.id === body.goalId);
        if (!g) return;
        g.stages = g.stages.filter((x) => x.id !== body.stageId);
        g.progress = calcGoalProgress(g);
      });
      return apiJson(goalsPayload(store));
    }

    return apiJson({ error: "unknown" }, { status: 400 });
  } catch (e) {
    return apiError(e);
  }
}
