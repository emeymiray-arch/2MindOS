import { buildEngineeringPhase1Plan, ENGINEERING_PHASE1_META } from "@/lib/curricula/engineering-phase1";
import { NextResponse } from "next/server";
import { id, now, todayKey } from "@/lib/id";
import {
  breakWeekIntoDays,
  calcWorkPlanProgress,
  createWorkPlan,
  currentWorkPhase,
  ensurePhaseModules,
  ensureWeek,
  findWorkPlan,
  generateWeekOutline,
  milestoneProgress,
  ownerOfWorkPlan,
  phaseModules,
  phasesOf,
  recomputeFromTaskToggle,
  stagesToPhases,
  syncWorkPlanProgress,
  weekStartMonday,
  workPlanForOwner,
} from "@/lib/lifeos";
import { getStore, updateStore } from "@/lib/store";
import { tasksForDate } from "@/lib/tasks";
import type { PlanModule, PlanPhase, WeeklyObjective, WorkPlanOwner } from "@/lib/types";

function enrich(
  store: Awaited<ReturnType<typeof getStore>>,
  planId: string,
  lite = false
) {
  const plan = findWorkPlan(store, planId);
  if (!plan) return null;
  const progress = calcWorkPlanProgress(plan);
  const phases = phasesOf(plan).map((ph) => ({
    ...ph,
    modules: phaseModules(ph),
    progress: milestoneProgress(ph),
  }));

  if (lite) {
    return {
      plan: {
        id: plan.id,
        title: plan.title,
        progress,
        phases,
      },
    };
  }

  const owner = ownerOfWorkPlan(store, plan);
  const phase = currentWorkPhase(plan);
  const weekStart = weekStartMonday(todayKey());
  const week =
    store.weeks?.find(
      (w) => w.weekStart === weekStart && (w.workPlanId === plan.id || !w.workPlanId)
    ) ??
    store.weeks?.find((w) => w.weekStart === weekStart) ??
    null;
  const today = tasksForDate(store, todayKey()).filter(
    (t) => t.workPlanId === plan.id || (owner.goal && t.goalId === owner.goal.id)
  );
  return {
    plan: {
      ...plan,
      progress,
      phases,
    },
    owner,
    currentPhase: phase
      ? { ...phase, progress: milestoneProgress(phase) }
      : null,
    currentWeek: week,
    today,
    horizon: store.plans?.find((p) => p.status === "active") ?? null,
  };
}

export async function GET(request: Request) {
  const store = await getStore();
  const url = new URL(request.url);
  const planId = url.searchParams.get("id");
  const ownerType = url.searchParams.get("ownerType") as WorkPlanOwner | null;
  const ownerId = url.searchParams.get("ownerId");
  const lite = url.searchParams.get("lite") === "1";

  if (planId) {
    const data = enrich(store, planId, lite);
    if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(data);
  }

  if (ownerType && ownerId) {
    const existing = workPlanForOwner(store, ownerType, ownerId);
    if (!existing) return NextResponse.json({ plan: null, ownerType, ownerId });
    return NextResponse.json(enrich(store, existing.id, lite));
  }

  return NextResponse.json({
    workPlans: (store.workPlans ?? []).map((p) => ({
      id: p.id,
      title: p.title,
      ownerType: p.ownerType,
      ownerId: p.ownerId,
      status: p.status,
      progress: calcWorkPlanProgress(p),
    })),
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "create");
  const lite = body.lite === true || body.lite === "1";

  if (action === "create") {
    const ownerType = String(body.ownerType ?? "") as WorkPlanOwner;
    const ownerId = String(body.ownerId ?? "");
    if (ownerType !== "goal" && ownerType !== "project") {
      return NextResponse.json({ error: "ownerType" }, { status: 400 });
    }
    if (!ownerId) return NextResponse.json({ error: "ownerId" }, { status: 400 });

    const store = await updateStore((s) => {
      if (!s.workPlans) s.workPlans = [];
      const existing = workPlanForOwner(s, ownerType, ownerId);
      if (existing) return;

      let title = String(body.title ?? "").trim();
      let phases: PlanPhase[] = [];
      if (ownerType === "goal") {
        const g = s.goals.find((x) => x.id === ownerId);
        if (!g) return;
        title = title || `Plan: ${g.title}`;
        phases = stagesToPhases(g.stages ?? []);
        const plan = createWorkPlan({
          ownerType,
          ownerId,
          title,
          deadline: body.deadline ? String(body.deadline) : g.deadline,
          phases: phases.length
            ? phases
            : [
                {
                  id: id(),
                  title: "Фундамент",
                  order: 1,
                  status: "active",
                  objectives: [],
                  modules: [],
                  progress: 0,
                },
              ],
        });
        s.workPlans.push(plan);
        g.workPlanId = plan.id;
        syncWorkPlanProgress(s, plan);
      } else {
        const p = s.projects.find((x) => x.id === ownerId);
        if (!p) return;
        title = title || `План: ${p.name}`;
        const fromModules = (p.modules?.tasks ?? []).map((t, i) => ({
          id: t.id || id(),
          title: t.title,
          order: i + 1,
          status: (t.done ? "done" : i === 0 ? "active" : "planned") as PlanPhase["status"],
          objectives: [] as string[],
          modules: [] as PlanModule[],
          progress: t.done ? 100 : 0,
        }));
        const plan = createWorkPlan({
          ownerType,
          ownerId,
          title,
          deadline: body.deadline ? String(body.deadline) : p.deadline,
          phases: fromModules.length
            ? fromModules
            : [
                {
                  id: id(),
                  title: "Фундамент",
                  order: 1,
                  status: "active",
                  objectives: [],
                  modules: [],
                  progress: 0,
                },
              ],
        });
        s.workPlans.push(plan);
        p.workPlanId = plan.id;
        syncWorkPlanProgress(s, plan);
      }
    });

    const created = workPlanForOwner(store, ownerType, ownerId);
    if (!created) return NextResponse.json({ error: "owner not found" }, { status: 404 });
    return NextResponse.json(enrich(store, created.id, lite));
  }

  if (action === "installEngineeringPhase1") {
    const store = await updateStore((s) => {
      if (!s.workPlans) s.workPlans = [];
      const career = s.spheres.find((x) => x.slug === "career");
      let goal = s.goals.find(
        (g) =>
          /engineering programming/i.test(g.title) ||
          /инженерн.*программ/i.test(g.title) ||
          g.title === "Engineering Programming — Фаза 1"
      );
      const t = now();
      if (!goal) {
        const nodeId = id();
        s.nodes.unshift({
          id: nodeId,
          kind: "goal",
          title: "Engineering Programming — Фаза 1",
          metadata: {},
          salience: 0.95,
          createdAt: t,
          updatedAt: t,
          sphereId: career?.id,
        });
        goal = {
          id: id(),
          nodeId,
          title: "Engineering Programming — Фаза 1",
          stages: [],
          progress: 0,
          active: true,
          archived: false,
          createdAt: t,
          lifeAreaId: career?.id,
          priority: "critical",
          status: "active",
          bucket: "foundation",
          deadline: ENGINEERING_PHASE1_META.end,
        };
        s.goals.unshift(goal);
      }

      // Replace previous plan for this goal if any
      if (goal.workPlanId) {
        s.workPlans = s.workPlans.filter((p) => p.id !== goal!.workPlanId);
      }
      const plan = buildEngineeringPhase1Plan({
        ownerType: "goal",
        ownerId: goal.id,
      });
      plan.deadline = ENGINEERING_PHASE1_META.end;
      s.workPlans.push(plan);
      goal.workPlanId = plan.id;
      goal.title = "Engineering Programming — Фаза 1";
      goal.deadline = ENGINEERING_PHASE1_META.end;      goal.bucket = "foundation";
      goal.priority = "critical";
      if (career?.id) goal.lifeAreaId = career.id;
      syncWorkPlanProgress(s, plan);
    });

    const goal = store.goals.find(
      (g) => g.title === "Engineering Programming — Фаза 1" || g.workPlanId
    );
    const planId =
      store.goals.find((g) => g.title === "Engineering Programming — Фаза 1")?.workPlanId ??
      goal?.workPlanId;
    if (!planId) return NextResponse.json({ error: "install failed" }, { status: 500 });
    return NextResponse.json({
      ...enrich(store, planId, lite),
      goalId: store.goals.find((g) => g.workPlanId === planId)?.id,
    });
  }

  if (action === "update") {
    const planId = String(body.id ?? "");
    const store = await updateStore((s) => {
      const plan = findWorkPlan(s, planId);
      if (!plan) return;
      if (body.title != null) plan.title = String(body.title);
      if (body.desiredResult !== undefined) plan.desiredResult = String(body.desiredResult || "") || undefined;
      if (body.why !== undefined) plan.why = String(body.why || "") || undefined;
      if (body.startingPoint !== undefined)
        plan.startingPoint = String(body.startingPoint || "") || undefined;
      if (body.strategy !== undefined) plan.strategy = String(body.strategy || "") || undefined;
      if (body.deadline !== undefined) plan.deadline = String(body.deadline || "") || undefined;
      if (body.status != null) plan.status = body.status;
      plan.updatedAt = now();
      syncWorkPlanProgress(s, plan);
    });
    const data = enrich(store, planId, lite);
    if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(data);
  }

  if (action === "addPhase") {
    const planId = String(body.planId ?? body.id ?? "");
    const title = String(body.title ?? "").trim();
    if (!title) return NextResponse.json({ error: "title" }, { status: 400 });
    const store = await updateStore((s) => {
      const plan = findWorkPlan(s, planId);
      if (!plan) return;
      const order = phasesOf(plan).length + 1;
      const phase: PlanPhase = {
        id: id(),
        title,
        order,
        durationWeeks: body.durationWeeks != null ? Number(body.durationWeeks) : undefined,
        deadlineStart: body.deadlineStart ? String(body.deadlineStart) : undefined,
        deadlineEnd: body.deadlineEnd ? String(body.deadlineEnd) : undefined,
        status: order === 1 ? "active" : "planned",
        objectives: Array.isArray(body.objectives)
          ? body.objectives.map(String).filter(Boolean)
          : [],
        modules: [],
        progress: 0,
      };
      plan.phases.push(phase);
      syncWorkPlanProgress(s, plan);
    });
    return NextResponse.json(enrich(store, planId, lite));
  }

  if (action === "updatePhase") {
    const planId = String(body.planId ?? "");
    const phaseId = String(body.phaseId ?? "");
    const store = await updateStore((s) => {
      const plan = findWorkPlan(s, planId);
      const phase = plan?.phases.find((p) => p.id === phaseId);
      if (!plan || !phase) return;
      if (body.title != null) phase.title = String(body.title);
      if (body.durationWeeks !== undefined)
        phase.durationWeeks = body.durationWeeks === "" ? undefined : Number(body.durationWeeks);
      if (body.deadlineStart !== undefined)
        phase.deadlineStart = String(body.deadlineStart || "") || undefined;
      if (body.deadlineEnd !== undefined)
        phase.deadlineEnd = String(body.deadlineEnd || "") || undefined;
      if (body.objectives !== undefined)
        phase.objectives = Array.isArray(body.objectives)
          ? body.objectives.map(String).filter(Boolean)
          : String(body.objectives)
              .split("\n")
              .map((x) => x.trim())
              .filter(Boolean);
      if (body.status != null) phase.status = body.status;
      syncWorkPlanProgress(s, plan);
    });
    return NextResponse.json(enrich(store, planId, lite));
  }

  if (action === "activatePhase") {
    const planId = String(body.planId ?? "");
    const phaseId = String(body.phaseId ?? "");
    const store = await updateStore((s) => {
      const plan = findWorkPlan(s, planId);
      if (!plan) return;
      for (const ph of plan.phases) {
        if (ph.id === phaseId) ph.status = "active";
        else if (ph.status === "active") ph.status = "planned";
      }
      syncWorkPlanProgress(s, plan);
    });
    return NextResponse.json(enrich(store, planId, lite));
  }

  if (action === "archivePhase") {
    const planId = String(body.planId ?? "");
    const phaseId = String(body.phaseId ?? "");
    const store = await updateStore((s) => {
      const plan = findWorkPlan(s, planId);
      const phase = plan?.phases.find((p) => p.id === phaseId);
      if (!plan || !phase) return;
      phase.archived = true;
      syncWorkPlanProgress(s, plan);
    });
    return NextResponse.json(enrich(store, planId, lite));
  }

  if (action === "addMilestone" || action === "addModule") {
    const planId = String(body.planId ?? "");
    const phaseId = String(body.phaseId ?? "");
    const title = String(body.title ?? "").trim();
    if (!title) return NextResponse.json({ error: "title" }, { status: 400 });
    const store = await updateStore((s) => {
      const plan = findWorkPlan(s, planId);
      const phase = plan?.phases.find((p) => p.id === phaseId);
      if (!plan || !phase) return;
      const modules = ensurePhaseModules(phase);
      modules.push({
        id: id(),
        title,
        done: false,
        order: modules.length + 1,
        deadlineStart: body.deadlineStart ? String(body.deadlineStart) : undefined,
        deadlineEnd: body.deadlineEnd ? String(body.deadlineEnd) : undefined,
      });
      syncWorkPlanProgress(s, plan);
    });
    return NextResponse.json(enrich(store, planId, lite));
  }

  if (action === "updateModule") {
    const planId = String(body.planId ?? "");
    const phaseId = String(body.phaseId ?? "");
    const moduleId = String(body.moduleId ?? body.milestoneId ?? "");
    const store = await updateStore((s) => {
      const plan = findWorkPlan(s, planId);
      const phase = plan?.phases.find((p) => p.id === phaseId);
      if (!plan || !phase) return;
      const modules = ensurePhaseModules(phase);
      const mod = modules.find((m) => m.id === moduleId);
      if (!mod) return;
      if (body.title != null) mod.title = String(body.title);
      if (body.deadlineStart !== undefined)
        mod.deadlineStart = String(body.deadlineStart || "") || undefined;
      if (body.deadlineEnd !== undefined)
        mod.deadlineEnd = String(body.deadlineEnd || "") || undefined;
      if (body.understanding !== undefined) {
        const u = Number(body.understanding);
        if (u === 0 || u === 1 || u === 2) mod.understanding = u;
        else if (body.understanding === null || body.understanding === "") {
          delete mod.understanding;
        }
      }
      syncWorkPlanProgress(s, plan);
    });
    return NextResponse.json(enrich(store, planId, lite));
  }

  if (action === "toggleMilestone" || action === "toggleModule") {
    const planId = String(body.planId ?? "");
    const phaseId = String(body.phaseId ?? "");
    const milestoneId = String(body.milestoneId ?? body.moduleId ?? "");
    const store = await updateStore((s) => {
      const plan = findWorkPlan(s, planId);
      const phase = plan?.phases.find((p) => p.id === phaseId);
      if (!plan || !phase) return;
      const modules = ensurePhaseModules(phase);
      const ms = modules.find((m) => m.id === milestoneId);
      if (!ms) return;
      ms.done = body.done != null ? Boolean(body.done) : !ms.done;
      syncWorkPlanProgress(s, plan);
    });
    return NextResponse.json(enrich(store, planId, lite));
  }

  if (action === "deleteMilestone" || action === "deleteModule") {
    const planId = String(body.planId ?? "");
    const phaseId = String(body.phaseId ?? "");
    const milestoneId = String(body.milestoneId ?? body.moduleId ?? "");
    const store = await updateStore((s) => {
      const plan = findWorkPlan(s, planId);
      const phase = plan?.phases.find((p) => p.id === phaseId);
      if (!plan || !phase) return;
      const modules = ensurePhaseModules(phase).filter((m) => m.id !== milestoneId);
      phase.modules = modules;
      phase.milestones = modules;
      syncWorkPlanProgress(s, plan);
    });
    return NextResponse.json(enrich(store, planId, lite));
  }

  if (action === "addTaskFromModule") {
    const planId = String(body.planId ?? "");
    const phaseId = String(body.phaseId ?? "");
    const moduleId = String(body.moduleId ?? "");
    const date = String(body.date ?? todayKey());
    const title = String(body.title ?? "").trim();
    const store = await updateStore((s) => {
      const plan = findWorkPlan(s, planId);
      const phase = plan?.phases.find((p) => p.id === phaseId);
      if (!plan || !phase) return;
      const mod = ensurePhaseModules(phase).find((m) => m.id === moduleId);
      if (!mod) return;
      const owner = ownerOfWorkPlan(s, plan);
      const weekStart = weekStartMonday(date);
      const week = ensureWeek(s, weekStart);
      week.workPlanId = plan.id;
      week.phaseId = phaseId;
      s.dayTasks.push({
        id: id(),
        date,
        title: title || mod.title,
        done: false,
        workPlanId: plan.id,
        stageId: phaseId,
        milestoneId: mod.id,
        goalId: owner.goal?.id,
        goalTitle: owner.goal?.title,
        projectId: owner.project?.id,
        weekId: week.id,
        lifeAreaId: owner.lifeAreaId,
        priority: "must",
        deadlineStart: mod.deadlineStart,
        deadlineEnd: mod.deadlineEnd,
      });
    });
    return NextResponse.json(enrich(store, planId, lite));
  }

  if (action === "generateWeekOutline") {
    const planId = String(body.planId ?? "");
    const phaseId = String(body.phaseId ?? "");
    const store = await getStore();
    const plan = findWorkPlan(store, planId);
    const phase = plan?.phases.find((p) => p.id === phaseId) ?? (plan ? currentWorkPhase(plan) : undefined);
    if (!plan || !phase) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({
      planId,
      phaseId: phase.id,
      outline: generateWeekOutline(plan, phase),
    });
  }

  if (action === "applyWeekOutline") {
    const planId = String(body.planId ?? "");
    const phaseId = String(body.phaseId ?? "");
    const items: { weekStart: string; suggestedOutcome: string; suggestedActions?: string[] }[] =
      Array.isArray(body.outline) ? body.outline : [];
    const store = await updateStore((s) => {
      const plan = findWorkPlan(s, planId);
      if (!plan) return;
      const owner = ownerOfWorkPlan(s, plan);
      for (const item of items) {
        const week = ensureWeek(s, item.weekStart);
        week.workPlanId = plan.id;
        week.phaseId = phaseId || undefined;
        const title = String(item.suggestedOutcome ?? "").trim();
        if (!title) continue;
        const exists = week.objectives.some(
          (o) => o.workPlanId === plan.id && o.phaseId === phaseId && o.title === title
        );
        if (exists) continue;
        const obj: WeeklyObjective = {
          id: id(),
          goalId: owner.goal?.id ?? "",
          phaseId: phaseId || undefined,
          workPlanId: plan.id,
          title,
          done: false,
        };
        week.objectives.push(obj);
      }
    });
    return NextResponse.json(enrich(store, planId, lite));
  }

  if (action === "breakWeekIntoDays") {
    const weekStart = String(body.weekStart ?? weekStartMonday(todayKey()));
    const actions: string[] = Array.isArray(body.actions)
      ? body.actions.map(String)
      : String(body.actions ?? "")
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean);
    const outcome = body.outcome ? String(body.outcome) : undefined;
    return NextResponse.json({
      weekStart,
      days: breakWeekIntoDays(weekStart, actions, outcome),
    });
  }

  if (action === "applyDayTasks") {
    const planId = String(body.planId ?? "");
    const phaseId = String(body.phaseId ?? "");
    const weekStart = String(body.weekStart ?? weekStartMonday(todayKey()));
    const days: { date: string; titles: string[] }[] = Array.isArray(body.days) ? body.days : [];
    const store = await updateStore((s) => {
      const plan = findWorkPlan(s, planId);
      if (!plan) return;
      const owner = ownerOfWorkPlan(s, plan);
      const week = ensureWeek(s, weekStart);
      week.workPlanId = plan.id;
      week.phaseId = phaseId || week.phaseId;
      for (const day of days) {
        for (const title of day.titles ?? []) {
          const t = String(title).trim();
          if (!t) continue;
          s.dayTasks.push({
            id: id(),
            date: day.date,
            title: t,
            done: false,
            workPlanId: plan.id,
            stageId: phaseId || undefined,
            goalId: owner.goal?.id,
            goalTitle: owner.goal?.title,
            projectId: owner.project?.id,
            weekId: week.id,
            lifeAreaId: owner.lifeAreaId,
            priority: "must",
          });
        }
      }
    });
    return NextResponse.json(enrich(store, planId, lite));
  }

  if (action === "ensureWeek") {
    const planId = String(body.planId ?? "");
    const phaseId = body.phaseId ? String(body.phaseId) : undefined;
    const weekStart = body.weekStart
      ? String(body.weekStart)
      : weekStartMonday(todayKey());
    const store = await updateStore((s) => {
      const plan = findWorkPlan(s, planId);
      if (!plan) return;
      const week = ensureWeek(s, weekStart);
      week.workPlanId = plan.id;
      if (phaseId) week.phaseId = phaseId;
    });
    return NextResponse.json(enrich(store, planId, lite));
  }

  // keep recompute available for tasks route
  if (action === "recompute") {
    const planId = String(body.planId ?? "");
    const store = await updateStore((s) => {
      const plan = findWorkPlan(s, planId);
      if (plan) syncWorkPlanProgress(s, plan);
      if (body.taskId) {
        const task = s.dayTasks.find((t) => t.id === body.taskId);
        if (task) recomputeFromTaskToggle(s, task);
      }
    });
    return NextResponse.json(enrich(store, planId, lite));
  }

  return NextResponse.json({ error: "unknown" }, { status: 400 });
}
