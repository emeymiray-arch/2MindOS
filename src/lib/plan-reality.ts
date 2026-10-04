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
import { resolveGoalSide } from "./layers";
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
    const startDay = (g.createdAt ?? asOf).slice(0, 10);
    const elapsed = daysBetween(startDay, asOf);
    const deadline = (g.deadline ?? plan?.deadline)?.slice(0, 10) ?? null;
    let eta: string | null = null;
    if (reality.actual >= 100) eta = asOf;
    else if (reality.actual > 0 && elapsed >= 7) {
      const perDay = reality.actual / elapsed;
      eta = addDays(asOf, Math.ceil((100 - reality.actual) / perDay));
    }
    return {
      id: g.id,
      title: g.title,
      lifeAreaId: g.lifeAreaId,
      area: store.spheres.find((s) => s.id === g.lifeAreaId)?.name,
      forecast: {
        eta,
        deadline,
        lateDays: eta && deadline ? daysBetween(deadline, eta) : null,
      },
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

  const activeHabits = (store.habits ?? []).filter((h) => h.active);
  const habitIds = new Set(activeHabits.map((h) => h.id));
  const habitLogs = (store.habitLogs ?? []).filter(
    (l) => habitIds.has(l.habitId) && l.date >= last30 && l.value > 0
  );

  const days14: {
    date: string;
    planned: number;
    completed: number;
    percent: number;
    goalsPercent: number;
    habitsPercent: number;
  }[] = [];
  const pctOf = (items: DailyTaskItem[]) =>
    items.length ? Math.round((items.filter((t) => t.done).length / items.length) * 100) : 0;
  for (let i = 13; i >= 0; i--) {
    const date = addDays(asOf, -i);
    const day = dayTasks.filter((t) => !t.archived && t.date === date);
    const planned = day.length;
    const completed = day.filter((t) => t.done).length;
    days14.push({
      date,
      planned,
      completed,
      percent: planned ? Math.round((completed / planned) * 100) : 0,
      goalsPercent: pctOf(day.filter((t) => t.goalId && !t.habitId)),
      habitsPercent: pctOf(day.filter((t) => t.habitId)),
    });
  }

  const fromGoals = dayTasks.filter(
    (t) => !t.archived && t.date >= last30 && t.date <= asOf && Boolean(t.goalId)
  );
  const personal = dayTasks.filter(
    (t) =>
      !t.archived &&
      t.date >= last30 &&
      t.date <= asOf &&
      !t.goalId &&
      !t.habitId
  );
  const habitTasks = dayTasks.filter(
    (t) => !t.archived && t.date >= last30 && t.date <= asOf && Boolean(t.habitId)
  );

  const overdueItems = dayTasks
    .filter((t) => !t.archived && !t.done && t.date < asOf)
    .map((t) => {
      const age = Math.max(
        0,
        Math.round(
          (new Date(asOf + "T12:00:00").getTime() - new Date(t.date + "T12:00:00").getTime()) /
            86400000
        )
      );
      return { id: t.id, title: t.title, date: t.date, ageDays: age, goalId: t.goalId };
    })
    .sort((a, b) => b.ageDays - a.ageDays)
    .slice(0, 12);

  const habitStats = activeHabits.map((h) => {
    const logs = habitLogs.filter((l) => l.habitId === h.id);
    const daysHit = new Set(logs.map((l) => l.date)).size;
    return {
      id: h.id,
      title: h.title,
      logs30: logs.length,
      daysHit,
      rate: Math.round((daysHit / 30) * 100),
    };
  }).sort((a, b) => b.rate - a.rate);

  const topGoals = [...goals]
    .map((g) => ({
      id: g.id,
      title: g.title,
      area: g.area,
      status: g.reality.status,
      progress: g.reality.actual,
      weekPercent: g.week?.percent ?? 0,
      hasPlan: g.hasPlan,
      nextStep: g.nextStep?.title ?? null,
      side: resolveGoalSide(
        { layer: activeGoals.find((x) => x.id === g.id)?.layer, lifeAreaId: g.lifeAreaId },
        store.spheres ?? []
      ),
    }))
    .sort((a, b) => b.progress - a.progress);

  const needPlan = goals.filter((g) => !g.hasPlan || g.reality.status === "no_plan");
  const deadlineRisk = goals.filter((g) => g.reality.deadlineRisk);

  const fin = store.finance;
  const pendingInbox = (store.captures ?? []).filter((c) => c.status === "pending").length;
  const principles = (store.principles ?? []).filter((p) => !p.archived).length;
  const outcomes30 = (store.outcomes ?? []).filter(
    (o) => !o.archived && (o.createdAt ?? "").slice(0, 10) >= last30
  ).length;
  const reviews = (store.reviews ?? []).length;

  const weekdayLabels = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
  const byWeekdayRaw = Array.from({ length: 7 }, (_, day) => ({
    day,
    label: weekdayLabels[day],
    planned: 0,
    completed: 0,
  }));
  const last30Tasks = dayTasks.filter(
    (t) => !t.archived && t.date >= last30 && t.date <= asOf
  );
  for (const t of last30Tasks) {
    const day = new Date(t.date + "T12:00:00").getDay();
    byWeekdayRaw[day].planned += 1;
    if (t.done) byWeekdayRaw[day].completed += 1;
  }
  const byWeekday = byWeekdayRaw.map((w) => ({
    ...w,
    percent: w.planned ? Math.round((w.completed / w.planned) * 100) : 0,
  }));

  const goalById = new Map(activeGoals.map((g) => [g.id, g]));
  const areaBuckets = new Map<
    string,
    { id: string; name: string; goals: number; tasks: number; done: number }
  >();
  for (const s of store.spheres ?? []) {
    areaBuckets.set(s.id, { id: s.id, name: s.name, goals: 0, tasks: 0, done: 0 });
  }
  areaBuckets.set("_none", { id: "_none", name: "Без сферы", goals: 0, tasks: 0, done: 0 });
  for (const g of activeGoals) {
    const key = g.lifeAreaId && areaBuckets.has(g.lifeAreaId) ? g.lifeAreaId : "_none";
    areaBuckets.get(key)!.goals += 1;
  }
  for (const t of fromGoals) {
    const g = t.goalId ? goalById.get(t.goalId) : undefined;
    const key = g?.lifeAreaId && areaBuckets.has(g.lifeAreaId) ? g.lifeAreaId : "_none";
    const bucket = areaBuckets.get(key)!;
    bucket.tasks += 1;
    if (t.done) bucket.done += 1;
  }
  const byArea = [...areaBuckets.values()]
    .filter((a) => a.goals > 0 || a.tasks > 0)
    .map((a) => ({
      ...a,
      percent: a.tasks ? Math.round((a.done / a.tasks) * 100) : 0,
    }))
    .sort((a, b) => b.tasks - a.tasks || b.goals - a.goals);

  const focusLevels =
    (store.periodFocus ?? []).find((p) => p.monthKey === asOf.slice(0, 7))?.levels ?? {};
  const doneByArea = new Map<string, number>();
  let doneWithArea = 0;
  for (const t of last30Tasks) {
    if (!t.done) continue;
    const areaId = t.lifeAreaId ?? (t.goalId ? goalById.get(t.goalId)?.lifeAreaId : undefined);
    if (!areaId) continue;
    doneByArea.set(areaId, (doneByArea.get(areaId) ?? 0) + 1);
    doneWithArea += 1;
  }
  const focusRank = { main: 0, support: 1, background: 2 } as const;
  const focusVsReality = (store.spheres ?? [])
    .filter((s) => !s.archived)
    .map((s) => {
      const done = doneByArea.get(s.id) ?? 0;
      return {
        id: s.id,
        name: s.name,
        focus: focusLevels[s.id] ?? "background",
        done,
        share: doneWithArea ? Math.round((done / doneWithArea) * 100) : 0,
      };
    })
    .filter((x) => x.focus !== "background" || x.done > 0)
    .sort((a, b) => focusRank[a.focus] - focusRank[b.focus] || b.done - a.done);

  let activeStreak = 0;
  for (let i = 0; i < 60; i++) {
    const date = addDays(asOf, -i);
    const day = dayTasks.filter((t) => !t.archived && t.date === date);
    const hit = day.some((t) => t.done);
    if (!hit) {
      if (i === 0) continue;
      break;
    }
    activeStreak += 1;
  }

  let bestStreak = 0;
  let run = 0;
  for (let i = 59; i >= 0; i--) {
    const date = addDays(asOf, -i);
    const hit = dayTasks.some((t) => !t.archived && t.date === date && t.done);
    if (hit) {
      run += 1;
      if (run > bestStreak) bestStreak = run;
    } else run = 0;
  }

  const daysWithPlan = days14.filter((d) => d.planned > 0).length;
  const daysFullyDone = days14.filter((d) => d.planned > 0 && d.percent >= 100).length;
  const totalPlanned14 = days14.reduce((s, d) => s + d.planned, 0);
  const totalDone14 = days14.reduce((s, d) => s + d.completed, 0);
  const avgTasksDay = daysWithPlan ? Math.round((totalPlanned14 / daysWithPlan) * 10) / 10 : 0;

  const wishItems = (store.wishBlocks ?? []).flatMap((b) =>
    (b.archived ? [] : b.items ?? []).map((it) => ({ ...it, blockArchived: b.archived }))
  );
  const wishlistOpen = wishItems.filter((w) => !w.archived && !w.done).length;
  const wishlistDone = wishItems.filter((w) => !w.archived && w.done).length;
  const directions = (store.spheres ?? []).filter((s) => !s.archived).length;
  const archivedGoals = store.goals.filter((g) => g.archived).length;

  const stageDetail = goals
    .flatMap((g) =>
      (g.stages ?? []).map((st) => ({
        goalId: g.id,
        goalTitle: g.title,
        stageId: st.id,
        title: st.title,
        progress: st.progress,
        status: st.status,
        modulesDone: st.modulesDone,
        modulesTotal: st.modulesTotal,
        deadlineEnd: st.deadlineEnd,
      }))
    )
    .filter((s) => s.status !== "done" && (s.modulesTotal > 0 || s.progress < 100))
    .sort((a, b) => a.progress - b.progress)
    .slice(0, 10);

  return {
    asOf,
    week: weeks[0],
    weeks,
    days14,
    goals,
    topGoals,
    byStatus,
    byWeekday,
    byArea,
    focusVsReality,
    forecast: goals
      .filter((g) => g.reality.actual < 100)
      .map((g) => ({
        id: g.id,
        title: g.title,
        progress: g.reality.actual,
        ...g.forecast,
      }))
      .sort((a, b) => (b.lateDays ?? -9999) - (a.lateDays ?? -9999)),
    modules: { done: modulesDone, total: modulesTotal },
    stages: { done: stagesDone, total: stagesTotal },
    stageDetail,
    velocity: {
      activeStreak,
      bestStreak60: bestStreak,
      daysWithPlan14: daysWithPlan,
      daysFullyDone14: daysFullyDone,
      avgTasksDay14: avgTasksDay,
      planned14: totalPlanned14,
      done14: totalDone14,
      percent14: totalPlanned14 ? Math.round((totalDone14 / totalPlanned14) * 100) : 0,
    },
    tasks: {
      done30,
      created30,
      completionRate: created30 ? Math.round((done30 / created30) * 100) : 0,
      overdue,
      bySource: {
        goals: { total: fromGoals.length, done: fromGoals.filter((t) => t.done).length },
        personal: { total: personal.length, done: personal.filter((t) => t.done).length },
        habits: { total: habitTasks.length, done: habitTasks.filter((t) => t.done).length },
      },
      overdueItems,
    },
    habits: {
      active: habitIds.size,
      logs30: habitLogs.length,
      list: habitStats,
    },
    alerts: {
      needPlan: needPlan.map((g) => ({ id: g.id, title: g.title })),
      deadlineRisk: deadlineRisk.map((g) => ({
        id: g.id,
        title: g.title,
        daysLeft: g.reality.daysLeft,
      })),
    },
    system: {
      pendingInbox,
      principles,
      outcomes30,
      reviews,
      wishlistOpen,
      wishlistDone,
      directions,
      archivedGoals,
    },
    finance: fin
      ? {
          income: fin.incomeMonth ?? 0,
          expenses: fin.expensesMonth ?? 0,
          salary: fin.salary ?? 0,
          cushion: fin.cushion ?? 0,
          currency: fin.currency ?? "RUB",
        }
      : null,
  };
}

