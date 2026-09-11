/**
 * Plan vs Reality — expected progress by date vs actual,
 * week/month slices, deadline risk.
 * Works on existing WorkPlan / PlanPhase / PlanModule / DailyTaskItem.
 */
import {
  calcWorkPlanProgress,
  findWorkPlan,
  milestoneProgress,
  phaseModules,
  phasesOf,
  weekStartMonday,
} from "./lifeos";
import { calcGoalProgress } from "./tasks";
import type { DailyTaskItem, Goal, LifeStore, PlanModule, PlanPhase, WorkPlan } from "./types";

export type TrackStatus = "ahead" | "on_track" | "behind" | "no_plan";

export type PlanReality = {
  actual: number;
  expected: number | null;
  delta: number | null;
  status: TrackStatus;
  label: string;
  detail: string;
  deadlineRisk: boolean;
  daysLeft: number | null;
};

export type WeekPulse = {
  weekStart: string;
  weekEnd: string;
  planned: number;
  completed: number;
  remaining: number;
  percent: number;
};

export type MonthExpectedItem = {
  id: string;
  title: string;
  done: boolean;
  kind: "phase" | "module";
  phaseTitle?: string;
  deadlineEnd?: string;
};

function parseDay(iso: string): number {
  return new Date(iso.slice(0, 10) + "T12:00:00").getTime();
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function daysBetween(a: string, b: string) {
  return Math.round((parseDay(b) - parseDay(a)) / 86_400_000);
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso.slice(0, 10) + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Linear time expectation between start and deadline. */
function linearExpected(start: string, end: string, asOf: string): number {
  const total = daysBetween(start, end);
  if (total <= 0) return 100;
  const elapsed = daysBetween(start, asOf);
  return clamp(Math.round((elapsed / total) * 100), 0, 100);
}

/**
 * Expected % from plan items with dates.
 * Modules/phases past their end date should be done (contribute their weight).
 * In-window items contribute proportionally.
 */
export function expectedFromPlan(plan: WorkPlan, asOf: string): number | null {
  const phases = phasesOf(plan);
  if (!phases.length) {
    if (plan.deadline && plan.createdAt) {
      return linearExpected(plan.createdAt.slice(0, 10), plan.deadline.slice(0, 10), asOf);
    }
    return null;
  }

  let totalW = 0;
  let expectedW = 0;

  for (const ph of phases) {
    const w = Math.max(1, ph.durationWeeks ?? 1);
    totalW += w;
    const mods = phaseModules(ph);
    if (mods.length) {
      let modSum = 0;
      for (const m of mods) {
        modSum += expectedModule(m, asOf, ph);
      }
      expectedW += (modSum / mods.length) * w;
    } else {
      expectedW += expectedPhaseShell(ph, asOf) * w;
    }
  }

  if (!totalW) return null;
  return clamp(Math.round(expectedW / totalW), 0, 100);
}

function expectedModule(m: PlanModule, asOf: string, ph: PlanPhase): number {
  if (m.done) return 100;
  const start = m.deadlineStart ?? ph.deadlineStart;
  const end = m.deadlineEnd ?? ph.deadlineEnd;
  if (end && parseDay(asOf) >= parseDay(end)) return 100;
  if (start && end) return linearExpected(start, end, asOf);
  if (end) {
    // assume ~30d window before end if no start
    const startGuess = addDays(end, -30);
    return linearExpected(startGuess, end, asOf);
  }
  if (ph.deadlineStart && ph.deadlineEnd) {
    return linearExpected(ph.deadlineStart, ph.deadlineEnd, asOf);
  }
  return 0;
}

function expectedPhaseShell(ph: PlanPhase, asOf: string): number {
  if (ph.status === "done") return 100;
  if (ph.deadlineStart && ph.deadlineEnd) {
    return linearExpected(ph.deadlineStart, ph.deadlineEnd, asOf);
  }
  if (ph.deadlineEnd && parseDay(asOf) >= parseDay(ph.deadlineEnd)) return 100;
  return 0;
}

export function trackStatus(actual: number, expected: number | null): TrackStatus {
  if (expected == null) return "no_plan";
  const delta = actual - expected;
  if (delta >= 5) return "ahead";
  if (delta <= -5) return "behind";
  return "on_track";
}

export function statusLabel(status: TrackStatus): string {
  switch (status) {
    case "ahead":
      return "Опережаешь";
    case "behind":
      return "Отстаёшь";
    case "on_track":
      return "В графике";
    default:
      return "Нужен план";
  }
}

export function statusDetail(
  status: TrackStatus,
  actual: number,
  expected: number | null
): string {
  if (expected == null) {
    return "Добавь план с датами — тогда появится сравнение с реальностью.";
  }
  const gap = Math.abs(actual - expected);
  if (status === "ahead") return `Ты на ${gap}% впереди плана.`;
  if (status === "behind") return `Ты на ${gap}% позади плана.`;
  return `Факт ${actual}% · план ${expected}% — всё идёт по курсу.`;
}

export function planRealityForGoal(
  store: LifeStore,
  goal: Goal,
  asOf: string
): PlanReality {
  const plan = goal.workPlanId ? findWorkPlan(store, goal.workPlanId) : undefined;
  const actual = plan ? calcWorkPlanProgress(plan) : calcGoalProgress(goal, store);
  const expected = plan
    ? expectedFromPlan(plan, asOf)
    : goal.deadline
      ? linearExpected(goal.createdAt.slice(0, 10), goal.deadline.slice(0, 10), asOf)
      : null;
  const status = trackStatus(actual, expected);
  const deadline = goal.deadline ?? plan?.deadline;
  const daysLeft = deadline ? daysBetween(asOf, deadline.slice(0, 10)) : null;
  const deadlineRisk =
    status === "behind" && daysLeft != null && daysLeft <= 21 && actual < 70;

  return {
    actual,
    expected,
    delta: expected == null ? null : actual - expected,
    status,
    label: statusLabel(status),
    detail: statusDetail(status, actual, expected),
    deadlineRisk,
    daysLeft,
  };
}

export function weekPulse(store: LifeStore, asOf: string, goalId?: string): WeekPulse {
  const weekStart = weekStartMonday(asOf);
  const weekEnd = addDays(weekStart, 6);
  const tasks = (store.dayTasks ?? []).filter((t) => {
    if (t.archived) return false;
    if (t.date < weekStart || t.date > weekEnd) return false;
    if (goalId && t.goalId !== goalId) return false;
    return true;
  });
  const planned = tasks.length;
  const completed = tasks.filter((t) => t.done).length;
  const remaining = planned - completed;
  return {
    weekStart,
    weekEnd,
    planned,
    completed,
    remaining,
    percent: planned ? Math.round((completed / planned) * 100) : 0,
  };
}

/** What should happen this calendar month for a goal's plan. */
export function monthExpected(
  plan: WorkPlan | undefined,
  asOf: string
): MonthExpectedItem[] {
  if (!plan) return [];
  const month = asOf.slice(0, 7);
  const items: MonthExpectedItem[] = [];

  for (const ph of phasesOf(plan)) {
    const inMonth =
      (ph.deadlineStart && ph.deadlineStart.startsWith(month)) ||
      (ph.deadlineEnd && ph.deadlineEnd.startsWith(month)) ||
      overlapsMonth(ph.deadlineStart, ph.deadlineEnd, month);

    const mods = phaseModules(ph);
    if (mods.length) {
      for (const m of mods) {
        const mIn =
          (m.deadlineStart && m.deadlineStart.startsWith(month)) ||
          (m.deadlineEnd && m.deadlineEnd.startsWith(month)) ||
          overlapsMonth(m.deadlineStart ?? ph.deadlineStart, m.deadlineEnd ?? ph.deadlineEnd, month);
        if (mIn || (inMonth && !m.deadlineEnd && !m.deadlineStart)) {
          items.push({
            id: m.id,
            title: m.title,
            done: m.done,
            kind: "module",
            phaseTitle: ph.title,
            deadlineEnd: m.deadlineEnd ?? ph.deadlineEnd,
          });
        }
      }
    } else if (inMonth) {
      items.push({
        id: ph.id,
        title: ph.title,
        done: ph.status === "done" || milestoneProgress(ph) >= 100,
        kind: "phase",
        deadlineEnd: ph.deadlineEnd,
      });
    }
  }
  return items;
}

function overlapsMonth(start: string | undefined, end: string | undefined, month: string): boolean {
  if (!start && !end) return false;
  const mStart = month + "-01";
  const mEnd = addDays(mStart, 32).slice(0, 7) + "-01"; // next month 1st approx
  const s = start ?? end!;
  const e = end ?? start!;
  return s < mEnd && e >= mStart;
}

export type TaskProvenance = {
  why: string;
  goalId?: string;
  goalTitle?: string;
  planId?: string;
  planTitle?: string;
  phaseTitle?: string;
  moduleTitle?: string;
  deadline?: string;
  source: "system" | "user" | "habit" | "unknown";
};

export function taskProvenance(store: LifeStore, task: DailyTaskItem): TaskProvenance {
  const goal = task.goalId ? store.goals.find((g) => g.id === task.goalId) : undefined;
  const plan = task.workPlanId
    ? findWorkPlan(store, task.workPlanId)
    : goal?.workPlanId
      ? findWorkPlan(store, goal.workPlanId)
      : undefined;
  let phaseTitle: string | undefined;
  let moduleTitle: string | undefined;
  if (plan && task.milestoneId) {
    for (const ph of phasesOf(plan)) {
      const m = phaseModules(ph).find((x) => x.id === task.milestoneId);
      if (m) {
        phaseTitle = ph.title;
        moduleTitle = m.title;
        break;
      }
      if (ph.id === task.stageId) phaseTitle = ph.title;
    }
  } else if (plan && task.stageId) {
    phaseTitle = phasesOf(plan).find((p) => p.id === task.stageId)?.title;
  }

  const source: TaskProvenance["source"] = task.habitId
    ? "habit"
    : task.autoSource
      ? "system"
      : task.goalId || task.projectId
        ? "user"
        : "unknown";

  const parts = [
    goal?.title && `Цель: ${goal.title}`,
    plan?.title && `План: ${plan.title}`,
    phaseTitle && `Этап: ${phaseTitle}`,
    moduleTitle && `Блок: ${moduleTitle}`,
  ].filter(Boolean);

  return {
    why: parts.join(" · ") || "Личная задача",
    goalId: goal?.id,
    goalTitle: goal?.title,
    planId: plan?.id,
    planTitle: plan?.title,
    phaseTitle,
    moduleTitle,
    deadline: goal?.deadline ?? plan?.deadline,
    source,
  };
}

export function timelineForPlan(plan: WorkPlan): {
  month: string;
  label: string;
  items: { id: string; title: string; date?: string; done: boolean; current: boolean }[];
}[] {
  const asOf = new Date().toISOString().slice(0, 10);
  const buckets = new Map<
    string,
    { id: string; title: string; date?: string; done: boolean; current: boolean }[]
  >();

  for (const ph of phasesOf(plan)) {
    const key =
      (ph.deadlineStart ?? ph.deadlineEnd ?? plan.createdAt).slice(0, 7) || "без-даты";
    if (!buckets.has(key)) buckets.set(key, []);
    const mods = phaseModules(ph);
    if (mods.length) {
      for (const m of mods) {
        const date = m.deadlineEnd ?? m.deadlineStart ?? ph.deadlineEnd;
        const current =
          Boolean(date) &&
          !m.done &&
          parseDay(asOf) <= parseDay(date!) &&
          (!m.deadlineStart || parseDay(asOf) >= parseDay(m.deadlineStart));
        buckets.get(key)!.push({
          id: m.id,
          title: m.title,
          date,
          done: m.done,
          current,
        });
      }
    } else {
      buckets.get(key)!.push({
        id: ph.id,
        title: ph.title,
        date: ph.deadlineEnd ?? ph.deadlineStart,
        done: ph.status === "done",
        current: ph.status === "active",
      });
    }
  }

  const monthNames = [
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

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, items]) => {
      const [y, m] = month.split("-");
      const label =
        month === "без-даты"
          ? "Без даты"
          : `${monthNames[Number(m) - 1] ?? month} ${y}`;
      return { month, label, items };
    });
}

/** Deep analytics snapshot for the Analytics page. */
export function buildAnalytics(store: LifeStore, asOf: string) {
  const activeGoals = store.goals.filter((g) => g.active && !g.archived);
  const weeks: WeekPulse[] = [];
  for (let i = 0; i < 6; i++) {
    const d = addDays(asOf, -i * 7);
    weeks.push(weekPulse(store, d));
  }

  let modulesTotal = 0;
  let modulesDone = 0;
  let stagesTotal = 0;
  let stagesDone = 0;

  const goals = activeGoals.map((g) => {
    const plan = g.workPlanId ? findWorkPlan(store, g.workPlanId) : undefined;
    const reality = planRealityForGoal(store, g, asOf);
    const stages = plan ? phasesOf(plan) : [];
    stagesTotal += stages.length;
    for (const st of stages) {
      const mods = phaseModules(st);
      modulesTotal += mods.length;
      modulesDone += mods.filter((m) => m.done).length;
      if (st.status === "done" || (st.progress ?? 0) >= 100) stagesDone += 1;
    }
    const nextMod = plan
      ? stages
          .flatMap((st) => phaseModules(st).map((m) => ({ st, m })))
          .find((x) => !x.m.done)
      : undefined;
    return {
      id: g.id,
      title: g.title,
      area: store.spheres.find((s) => s.id === g.lifeAreaId)?.name,
      reality,
      week: weekPulse(store, asOf, g.id),
      hasPlan: Boolean(plan),
      stages: stages.map((st) => ({
        id: st.id,
        title: st.title,
        progress: st.progress ?? milestoneProgress(st),
        status: st.status,
        deadlineStart: st.deadlineStart,
        deadlineEnd: st.deadlineEnd,
        modulesDone: phaseModules(st).filter((m) => m.done).length,
        modulesTotal: phaseModules(st).length,
      })),
      nextStep: nextMod
        ? { title: nextMod.m.title, stageTitle: nextMod.st.title }
        : null,
    };
  });

  const dayTasks = store.dayTasks ?? [];
  const last30 = addDays(asOf, -30);
  const done30 = dayTasks.filter(
    (t) => !t.archived && t.done && t.date >= last30 && t.date <= asOf
  ).length;
  const created30 = dayTasks.filter(
    (t) => !t.archived && t.date >= last30 && t.date <= asOf
  ).length;
  const overdue = dayTasks.filter((t) => !t.archived && !t.done && t.date < asOf).length;

  const byStatus = {
    ahead: goals.filter((g) => g.reality.status === "ahead").length,
    on_track: goals.filter((g) => g.reality.status === "on_track").length,
    behind: goals.filter((g) => g.reality.status === "behind").length,
    no_plan: goals.filter((g) => g.reality.status === "no_plan").length,
  };

  const habitIds = new Set((store.habits ?? []).filter((h) => h.active).map((h) => h.id));
  const habitLogs = (store.habitLogs ?? []).filter(
    (l) => habitIds.has(l.habitId) && l.date >= last30 && l.value > 0
  );

  return {
    asOf,
    week: weeks[0],
    weeks,
    goals,
    byStatus,
    modules: { done: modulesDone, total: modulesTotal },
    stages: { done: stagesDone, total: stagesTotal },
    tasks: {
      done30,
      created30,
      completionRate: created30 ? Math.round((done30 / created30) * 100) : 0,
      overdue,
    },
    habits: {
      active: habitIds.size,
      logs30: habitLogs.length,
    },
  };
}

