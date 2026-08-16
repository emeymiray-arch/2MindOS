import { id } from "./id";
import type {
  DailyTaskItem,
  Goal,
  GoalStage,
  LifeStore,
  PriorityLevel,
  SixMonthPlan,
  Sphere,
  TaskPriority,
  WeeklyPlan,
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
  phase?: GoalStage;
  goal?: Goal;
  plan?: SixMonthPlan;
  area?: Sphere;
}

export function taskChain(store: LifeStore, task: DailyTaskItem): TaskChain {
  const goal = task.goalId ? store.goals.find((g) => g.id === task.goalId) : undefined;
  const phase =
    task.stageId && goal
      ? goal.stages.find((s) => s.id === task.stageId)
      : goal
        ? currentPhase(goal)
        : undefined;
  const week = task.weekId
    ? store.weeks?.find((w) => w.id === task.weekId)
    : undefined;
  const plan = goal?.planId
    ? store.plans?.find((p) => p.id === goal.planId)
    : activePlan(store);
  const areaId = task.lifeAreaId ?? goal?.lifeAreaId;
  const area = areaId ? store.spheres.find((s) => s.id === areaId) : undefined;
  return { task, week, phase, goal, plan, area };
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
