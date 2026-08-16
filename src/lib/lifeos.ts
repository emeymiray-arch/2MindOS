import { id, todayKey } from "./id";
import type {
  DailyTaskItem,
  Goal,
  GoalStage,
  LifeStore,
  Milestone,
  PlanPhase,
  PriorityLevel,
  Project,
  SixMonthPlan,
  Sphere,
  TaskPriority,
  WeeklyPlan,
  WorkPlan,
  WorkPlanOwner,
} from "./types";

export const DEFAULT_LIFE_AREAS: Omit<Sphere, "id">[] = [
  {
    slug: "health",
    name: "Health",
    emoji: "🧬",
    description: "Анализы, питание, позвоночник, осанка, зубы, зрение, волосы",
    priority: "critical",
    order: 1,
  },
  {
    slug: "career",
    name: "Career / Business",
    emoji: "💻",
    description: "Engineering / AI + Fast Food Business",
    priority: "critical",
    order: 2,
  },
  {
    slug: "religion",
    name: "Religion",
    emoji: "🕌",
    description: "Таджвид и религиозное развитие",
    priority: "high",
    order: 3,
  },
  {
    slug: "personal",
    name: "Personal Development",
    emoji: "🧠",
    description: "Поведение, речь, английский, чтение",
    priority: "high",
    order: 4,
  },
  {
    slug: "culture",
    name: "Culture & Creativity",
    emoji: "🎨",
    description: "История, литература, искусство, шитьё",
    priority: "medium",
    order: 5,
  },
  {
    slug: "body",
    name: "Body & Style",
    emoji: "✨",
    description: "Зал, гардероб, уход",
    priority: "medium",
    order: 6,
  },
];

export function seedLifeAreas(): Sphere[] {
  return DEFAULT_LIFE_AREAS.map((a) => ({ ...a, id: id() }));
}

export function ensureLifeAreas(store: LifeStore): void {
  if (!store.spheres) store.spheres = [];
  if (store.spheres.length > 0) return;
  store.spheres = seedLifeAreas();
}

export function addMonths(isoDate: string, months: number): string {
  const d = new Date(isoDate + "T12:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function weekStartMonday(isoDate: string): string {
  const d = new Date(isoDate + "T12:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function createDefaultPlan(nowIso = new Date().toISOString()): SixMonthPlan {
  const start = nowIso.slice(0, 10);
  const end = addMonths(start, 6);
  const startLabel = new Date(start + "T12:00:00").toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const endLabel = new Date(end + "T12:00:00").toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  return {
    id: id(),
    title: `${startLabel} — ${endLabel}`,
    startDate: start,
    endDate: end,
    status: "active",
    createdAt: nowIso,
  };
}

export function activePlan(store: LifeStore): SixMonthPlan | undefined {
  return (store.plans ?? []).find((p) => p.status === "active");
}

export function ensureActivePlan(store: LifeStore): SixMonthPlan {
  if (!store.plans) store.plans = [];
  let plan = activePlan(store);
  if (!plan) {
    plan = createDefaultPlan();
    store.plans.push(plan);
  }
  return plan;
}

export function ensureWeeks(store: LifeStore): void {
  if (!store.weeks) store.weeks = [];
}

export function findWeek(store: LifeStore, weekStart: string): WeeklyPlan | undefined {
  return (store.weeks ?? []).find((w) => w.weekStart === weekStart);
}

export function ensureWeek(store: LifeStore, weekStart: string): WeeklyPlan {
  ensureWeeks(store);
  let week = findWeek(store, weekStart);
  if (!week) {
    const plan = activePlan(store);
    week = {
      id: id(),
      weekStart,
      planId: plan?.id,
      objectives: [],
      createdAt: new Date().toISOString(),
    };
    store.weeks.push(week);
  }
  return week;
}

export function currentPhase(goal: Goal): GoalStage | undefined {
  const stages = (goal.stages ?? []).filter((s) => !s.archived);
  const active = stages.find((s) => s.status === "active" || (!s.done && s.status !== "done"));
  if (active) return active;
  return stages.find((s) => !s.done) ?? stages[stages.length - 1];
}

export function phaseProgress(stage: GoalStage): number {
  if (stage.progress != null) return stage.progress;
  return stage.done || stage.status === "done" ? 100 : 0;
}

const PRIORITY_RANK: Record<PriorityLevel, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export function inheritTaskPriority(
  store: LifeStore,
  task: Pick<DailyTaskItem, "priority" | "goalId" | "lifeAreaId">
): TaskPriority {
  if (task.priority) return task.priority;
  const goal = task.goalId ? store.goals.find((g) => g.id === task.goalId) : undefined;
  const areaId = task.lifeAreaId ?? goal?.lifeAreaId;
  const area = areaId ? store.spheres.find((s) => s.id === areaId) : undefined;
  const rank = Math.max(
    PRIORITY_RANK[goal?.priority ?? "medium"],
    PRIORITY_RANK[area?.priority ?? "medium"]
  );
  if (rank >= 4) return "must";
  if (rank >= 3) return "should";
  return "optional";
}

export function dailyLoad(
  tasks: DailyTaskItem[],
  store: LifeStore,
  capacity = 6
): { percent: number; must: number; should: number; optional: number; weight: number } {
  const open = tasks.filter((t) => !t.done && !t.archived);
  let weight = 0;
  let must = 0;
  let should = 0;
  let optional = 0;
  for (const t of open) {
    const p = inheritTaskPriority(store, t);
    if (p === "must") {
      weight += 1;
      must += 1;
    } else if (p === "should") {
      weight += 0.6;
      should += 1;
    } else {
      weight += 0.3;
      optional += 1;
    }
  }
  const cap = Math.max(1, capacity);
  return {
    percent: Math.round((weight / cap) * 100),
    must,
    should,
    optional,
    weight: Math.round(weight * 10) / 10,
  };
}

export interface TaskChain {
  task: DailyTaskItem;
  week?: WeeklyPlan;
  phase?: GoalStage | PlanPhase;
  workPhase?: PlanPhase;
  goal?: Goal;
  project?: Project;
  workPlan?: WorkPlan;
  plan?: SixMonthPlan;
  area?: Sphere;
  milestone?: Milestone;
}

export function taskChain(store: LifeStore, task: DailyTaskItem): TaskChain {
  const workPlan = task.workPlanId
    ? findWorkPlan(store, task.workPlanId)
    : undefined;
  const goal = task.goalId
    ? store.goals.find((g) => g.id === task.goalId)
    : workPlan?.ownerType === "goal"
      ? store.goals.find((g) => g.id === workPlan.ownerId)
      : undefined;
  const project = task.projectId
    ? store.projects.find((p) => p.id === task.projectId)
    : workPlan?.ownerType === "project"
      ? store.projects.find((p) => p.id === workPlan.ownerId)
      : undefined;
  const resolvedPlan =
    workPlan ??
    (goal?.workPlanId ? findWorkPlan(store, goal.workPlanId) : undefined) ??
    (project?.workPlanId ? findWorkPlan(store, project.workPlanId) : undefined);

  const workPhase =
    task.stageId && resolvedPlan
      ? resolvedPlan.phases.find((p) => p.id === task.stageId)
      : resolvedPlan
        ? currentWorkPhase(resolvedPlan)
        : undefined;

  const legacyPhase =
    task.stageId && goal
      ? goal.stages.find((s) => s.id === task.stageId)
      : goal
        ? currentPhase(goal)
        : undefined;

  const week = task.weekId
    ? store.weeks?.find((w) => w.id === task.weekId)
    : undefined;
  const horizon = goal?.planId
    ? store.plans?.find((p) => p.id === goal.planId)
    : activePlan(store);
  const areaId = task.lifeAreaId ?? goal?.lifeAreaId ?? project?.lifeAreaId;
  const area = areaId ? store.spheres.find((s) => s.id === areaId) : undefined;
  const milestone =
    task.milestoneId && workPhase
      ? workPhase.milestones.find((m) => m.id === task.milestoneId)
      : undefined;

  return {
    task,
    week,
    phase: workPhase ?? legacyPhase,
    workPhase,
    goal,
    project,
    workPlan: resolvedPlan,
    plan: horizon,
    area,
    milestone,
  };
}

export function goalsInBucket(store: LifeStore, bucket: "foundation" | "development" | "later") {
  const plan = activePlan(store);
  return (store.goals ?? []).filter(
    (g) =>
      !g.archived &&
      g.active &&
      (g.bucket ?? "development") === bucket &&
      (!plan || !g.planId || g.planId === plan.id)
  );
}

export function mapLegacyWishBucket(
  b: string
): "shopping" | "wishlist" | "ideas" | "someday" | "skill" | "plans" | "material" {
  if (b === "material") return "shopping";
  if (b === "plans") return "wishlist";
  if (b === "skill") return "ideas";
  return b as "shopping" | "wishlist" | "ideas" | "someday" | "skill" | "plans" | "material";
}

/* ─── WorkPlan (execution plan for Goal / Project) ─── */

export function findWorkPlan(store: LifeStore, workPlanId?: string): WorkPlan | undefined {
  if (!workPlanId) return undefined;
  return (store.workPlans ?? []).find((p) => p.id === workPlanId);
}

export function workPlanForOwner(
  store: LifeStore,
  ownerType: WorkPlanOwner,
  ownerId: string
): WorkPlan | undefined {
  return (store.workPlans ?? []).find(
    (p) => p.ownerType === ownerType && p.ownerId === ownerId && p.status !== "archived"
  );
}

export function phasesOf(plan: WorkPlan): PlanPhase[] {
  return (plan.phases ?? []).filter((p) => !p.archived).sort((a, b) => a.order - b.order);
}

export function currentWorkPhase(plan: WorkPlan): PlanPhase | undefined {
  const phases = phasesOf(plan);
  const active = phases.find((p) => p.status === "active");
  if (active) return active;
  return phases.find((p) => p.status !== "done") ?? phases[phases.length - 1];
}

export function milestoneProgress(phase: PlanPhase): number {
  const ms = phase.milestones ?? [];
  if (ms.length === 0) {
    if (phase.progress != null) return phase.progress;
    return phase.status === "done" ? 100 : 0;
  }
  const done = ms.filter((m) => m.done).length;
  return Math.round((done / ms.length) * 100);
}

export function calcWorkPlanProgress(plan: WorkPlan): number {
  const phases = phasesOf(plan);
  if (!phases.length) return 0;
  let totalWeight = 0;
  let weighted = 0;
  for (const ph of phases) {
    const w = Math.max(1, ph.durationWeeks ?? 1);
    totalWeight += w;
    weighted += milestoneProgress(ph) * w;
  }
  return Math.round(weighted / totalWeight);
}

export function syncPhaseProgress(phase: PlanPhase): void {
  phase.progress = milestoneProgress(phase);
  if (phase.progress >= 100) phase.status = "done";
  else if (phase.status === "done") phase.status = "active";
}

export function syncWorkPlanProgress(store: LifeStore, plan: WorkPlan): number {
  for (const ph of phasesOf(plan)) syncPhaseProgress(ph);
  const pct = calcWorkPlanProgress(plan);
  plan.updatedAt = new Date().toISOString();
  if (plan.ownerType === "goal") {
    const g = store.goals.find((x) => x.id === plan.ownerId);
    if (g) {
      g.progress = pct;
      g.workPlanId = plan.id;
      // Keep legacy stages in sync for old UI surfaces
      syncGoalStagesFromPlan(g, plan);
    }
  } else {
    const proj = store.projects.find((x) => x.id === plan.ownerId);
    if (proj) proj.workPlanId = plan.id;
  }
  return pct;
}

export function syncGoalStagesFromPlan(goal: Goal, plan: WorkPlan): void {
  const phases = phasesOf(plan);
  goal.stages = phases.map((ph, i) => ({
    id: ph.id,
    title: ph.title,
    done: ph.status === "done" || milestoneProgress(ph) >= 100,
    deadlineStart: ph.deadlineStart,
    deadlineEnd: ph.deadlineEnd,
    order: ph.order ?? i + 1,
    archived: ph.archived,
    status: ph.status,
    progress: milestoneProgress(ph),
  }));
}

export function stagesToPhases(stages: GoalStage[]): PlanPhase[] {
  return (stages ?? [])
    .filter((s) => !s.archived)
    .map((s, i) => ({
      id: s.id,
      title: s.title,
      order: s.order ?? i + 1,
      deadlineStart: s.deadlineStart,
      deadlineEnd: s.deadlineEnd,
      status: s.status ?? (s.done ? ("done" as const) : i === 0 ? ("active" as const) : ("planned" as const)),
      objectives: [] as string[],
      milestones: s.done
        ? [{ id: id(), title: `Complete: ${s.title}`, done: true, order: 1 }]
        : ([] as Milestone[]),
      progress: s.progress ?? (s.done ? 100 : 0),
    }));
}

export function createWorkPlan(input: {
  ownerType: WorkPlanOwner;
  ownerId: string;
  title: string;
  desiredResult?: string;
  why?: string;
  startingPoint?: string;
  strategy?: string;
  deadline?: string;
  phases?: PlanPhase[];
}): WorkPlan {
  const t = new Date().toISOString();
  return {
    id: id(),
    ownerType: input.ownerType,
    ownerId: input.ownerId,
    title: input.title,
    desiredResult: input.desiredResult,
    why: input.why,
    startingPoint: input.startingPoint,
    strategy: input.strategy,
    deadline: input.deadline,
    status: "active",
    phases: input.phases ?? [],
    createdAt: t,
    updatedAt: t,
  };
}

export function ownerOfWorkPlan(
  store: LifeStore,
  plan: WorkPlan
): { goal?: Goal; project?: Project; title: string; lifeAreaId?: string } {
  if (plan.ownerType === "goal") {
    const goal = store.goals.find((g) => g.id === plan.ownerId);
    return { goal, title: goal?.title ?? plan.title, lifeAreaId: goal?.lifeAreaId };
  }
  const project = store.projects.find((p) => p.id === plan.ownerId);
  return {
    project,
    title: project?.name ?? plan.title,
    lifeAreaId: project?.lifeAreaId,
  };
}

export function findPhaseInStore(store: LifeStore, phaseId?: string): PlanPhase | undefined {
  if (!phaseId) return undefined;
  for (const wp of store.workPlans ?? []) {
    const ph = wp.phases.find((p) => p.id === phaseId);
    if (ph) return ph;
  }
  return undefined;
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Preview: split phase into weekly windows from today / phase start. */
export function generateWeekOutline(plan: WorkPlan, phase: PlanPhase): {
  weekStart: string;
  weekEnd: string;
  label: string;
  suggestedOutcome: string;
  suggestedActions: string[];
}[] {
  const weeks = Math.max(1, phase.durationWeeks ?? 2);
  const start = phase.deadlineStart ?? todayKey();
  const actions =
    phase.objectives.length > 0
      ? phase.objectives
      : phase.milestones.map((m) => m.title).filter(Boolean);
  const out: {
    weekStart: string;
    weekEnd: string;
    label: string;
    suggestedOutcome: string;
    suggestedActions: string[];
  }[] = [];
  for (let i = 0; i < weeks; i++) {
    const weekStart = weekStartMonday(addDays(start, i * 7));
    const weekEnd = addDays(weekStart, 6);
    out.push({
      weekStart,
      weekEnd,
      label: `Week ${i + 1}`,
      suggestedOutcome:
        actions[i] ??
        `${phase.title} — week ${i + 1}`,
      suggestedActions: actions.length
        ? [actions[i % actions.length]].filter(Boolean)
        : [`Work on ${phase.title}`],
    });
  }
  return out;
}

const DOW = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Preview: break weekly outcome/actions across Mon–Sun. */
export function breakWeekIntoDays(
  weekStart: string,
  actions: string[],
  outcome?: string
): { date: string; dayLabel: string; titles: string[] }[] {
  const items = actions.length
    ? actions
    : outcome
      ? [outcome]
      : ["Focus work"];
  const days: { date: string; dayLabel: string; titles: string[] }[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(weekStart, i);
    const titles: string[] = [];
    if (i < 6 && items[i]) titles.push(items[i]);
    else if (i === 6) titles.push(outcome ? `Review: ${outcome}` : "Weekly review");
    else if (items.length) titles.push(items[i % items.length]);
    days.push({ date, dayLabel: DOW[i], titles });
  }
  // Distribute leftover actions onto early days
  if (items.length > 6) {
    for (let i = 6; i < items.length; i++) {
      days[i % 6].titles.push(items[i]);
    }
  }
  return days;
}

export function recomputeFromTaskToggle(store: LifeStore, task: DailyTaskItem): void {
  if (task.objectiveId && task.weekId) {
    const week = store.weeks?.find((w) => w.id === task.weekId);
    const obj = week?.objectives.find((o) => o.id === task.objectiveId);
    if (obj && week) {
      const related = (store.dayTasks ?? []).filter(
        (t) => t.objectiveId === obj.id && !t.archived
      );
      if (related.length) {
        obj.done = related.every((t) => t.done);
      }
    }
  }
  if (task.milestoneId && task.workPlanId) {
    const plan = findWorkPlan(store, task.workPlanId);
    const phase = plan?.phases.find((p) =>
      (p.milestones ?? []).some((m) => m.id === task.milestoneId)
    );
    const ms = phase?.milestones.find((m) => m.id === task.milestoneId);
    if (ms && plan) {
      const related = (store.dayTasks ?? []).filter(
        (t) => t.milestoneId === ms.id && !t.archived
      );
      if (related.length) ms.done = related.every((t) => t.done);
      else ms.done = Boolean(task.done);
      syncWorkPlanProgress(store, plan);
    }
  } else if (task.workPlanId) {
    const plan = findWorkPlan(store, task.workPlanId);
    if (plan) syncWorkPlanProgress(store, plan);
  } else if (task.stageId && task.goalId) {
    const goal = store.goals.find((g) => g.id === task.goalId);
    const plan = goal?.workPlanId ? findWorkPlan(store, goal.workPlanId) : undefined;
    if (plan) {
      const phase = plan.phases.find((p) => p.id === task.stageId);
      if (phase && task.done) {
        // soft signal only
      }
      syncWorkPlanProgress(store, plan);
    }
  }
}
