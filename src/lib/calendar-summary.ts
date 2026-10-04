/**
 * Year → month → day calendar snapshots with inner/outer sides.
 */
import { calcWorkPlanProgress, findWorkPlan } from "./lifeos";
import { resolveGoalSide } from "./layers";
import type { Side } from "./layers";
import { calcGoalProgress, tasksForDate } from "./tasks";
import type { DailyTaskItem, Goal, LifeStore } from "./types";

function addDays(iso: string, n: number): string {
  const d = new Date(iso.slice(0, 10) + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function goalProgress(store: LifeStore, g: Goal) {
  const plan = g.workPlanId ? findWorkPlan(store, g.workPlanId) : undefined;
  return plan ? calcWorkPlanProgress(plan) : calcGoalProgress(g, store);
}

function isAchieved(store: LifeStore, g: Goal) {
  if (g.status === "done") return true;
  return goalProgress(store, g) >= 100;
}

function achievedInRange(store: LifeStore, from: string, to: string) {
  return store.goals.filter((g) => {
    if (!isAchieved(store, g)) return false;
    const stamp = (g.deadline || g.createdAt || "").slice(0, 10);
    if (!stamp) return false;
    return stamp >= from && stamp <= to;
  });
}

function taskPulse(tasks: DailyTaskItem[]) {
  const planned = tasks.filter((t) => !t.archived).length;
  const completed = tasks.filter((t) => !t.archived && t.done).length;
  return {
    planned,
    completed,
    percent: planned ? Math.round((completed / planned) * 100) : 0,
  };
}

function sideOfTask(
  store: LifeStore,
  t: DailyTaskItem
): Side | null {
  if (t.goalId) {
    const g = store.goals.find((x) => x.id === t.goalId);
    if (g) return resolveGoalSide(g, store.spheres ?? []);
  }
  if (t.lifeAreaId) {
    const s = (store.spheres ?? []).find((x) => x.id === t.lifeAreaId);
    if (s?.layerBias === "inner" || s?.layerBias === "outer") return s.layerBias;
  }
  if (t.habitId) return "inner";
  return null;
}

function sidePulse(store: LifeStore, tasks: DailyTaskItem[]) {
  const buckets: Record<Side | "unset", DailyTaskItem[]> = {
    inner: [],
    outer: [],
    unset: [],
  };
  for (const t of tasks.filter((x) => !x.archived)) {
    const side = sideOfTask(store, t);
    buckets[side ?? "unset"].push(t);
  }
  const pack = (list: DailyTaskItem[]) => {
    const planned = list.length;
    const completed = list.filter((t) => t.done).length;
    return {
      planned,
      completed,
      percent: planned ? Math.round((completed / planned) * 100) : 0,
    };
  };
  return {
    inner: pack(buckets.inner),
    outer: pack(buckets.outer),
    unset: pack(buckets.unset),
  };
}

function goalCard(store: LifeStore, g: Goal) {
  const progress = goalProgress(store, g);
  return {
    id: g.id,
    title: g.title,
    progress,
    status: g.status ?? (g.active ? "active" : "paused"),
    side: resolveGoalSide(g, store.spheres ?? []),
    area: store.spheres.find((s) => s.id === g.lifeAreaId)?.name,
    deadline: g.deadline?.slice(0, 10) ?? null,
  };
}

export function buildYearCalendar(store: LifeStore, year: number) {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const months = [];
  for (let m = 1; m <= 12; m++) {
    const key = monthKey(year, m);
    const start = `${key}-01`;
    const end = `${key}-${String(daysInMonth(year, m)).padStart(2, "0")}`;
    const tasks = (store.dayTasks ?? []).filter(
      (t) => !t.archived && t.date >= start && t.date <= end
    );
    const pulse = taskPulse(tasks);
    const achieved = achievedInRange(store, start, end).length;
    months.push({
      month: m,
      key,
      ...pulse,
      achieved,
      sides: sidePulse(store, tasks),
    });
  }

  const yearTasks = (store.dayTasks ?? []).filter(
    (t) => !t.archived && t.date >= from && t.date <= to
  );
  const achieved = achievedInRange(store, from, to).map((g) => goalCard(store, g));
  const active = store.goals
    .filter((g) => g.active && !g.archived && !isAchieved(store, g))
    .map((g) => goalCard(store, g));

  const principles = (store.principles ?? []).filter((p) => !p.archived);
  const habitHits = (store.habitLogs ?? []).filter(
    (l) => l.date >= from && l.date <= to && l.value > 0
  ).length;

  return {
    year,
    from,
    to,
    months,
    summary: {
      ...taskPulse(yearTasks),
      sides: sidePulse(store, yearTasks),
      achieved,
      active,
      principles: {
        inner: principles.filter((p) => p.layer === "inner").length,
        outer: principles.filter((p) => p.layer === "outer").length,
      },
      habitHits,
      outcomes: (store.outcomes ?? []).filter(
        (o) => !o.archived && (o.createdAt ?? "").slice(0, 4) === String(year)
      ).length,
    },
  };
}

export function buildMonthCalendar(store: LifeStore, year: number, month: number) {
  const key = monthKey(year, month);
  const start = `${key}-01`;
  const last = daysInMonth(year, month);
  const end = `${key}-${String(last).padStart(2, "0")}`;
  const days = [];
  for (let d = 1; d <= last; d++) {
    const date = `${key}-${String(d).padStart(2, "0")}`;
    const tasks = tasksForDate(store, date).filter((t) => !t.archived);
    const pulse = taskPulse(tasks);
    days.push({
      date,
      day: d,
      weekday: new Date(date + "T12:00:00").getDay(),
      ...pulse,
      sides: sidePulse(store, tasks),
      hasOverdue: false,
    });
  }

  const monthTasks = (store.dayTasks ?? []).filter(
    (t) => !t.archived && t.date >= start && t.date <= end
  );
  const achieved = achievedInRange(store, start, end).map((g) => goalCard(store, g));
  const focusGoals = store.goals
    .filter((g) => g.active && !g.archived)
    .map((g) => goalCard(store, g))
    .filter((g) => g.progress < 100)
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 8);

  const reviews = (store.reviews ?? []).filter(
    (r) => r.cadence === "month" && r.periodKey === key
  );

  return {
    year,
    month,
    key,
    from: start,
    to: end,
    days,
    summary: {
      ...taskPulse(monthTasks),
      sides: sidePulse(store, monthTasks),
      achieved,
      focusGoals,
      habitHits: (store.habitLogs ?? []).filter(
        (l) => l.date >= start && l.date <= end && l.value > 0
      ).length,
      outcomes: (store.outcomes ?? []).filter(
        (o) => !o.archived && ((o.monthKey === key) || (o.createdAt ?? "").slice(0, 7) === key)
      ).length,
      review: reviews[0]
        ? {
            worked: reviews[0].worked,
            failed: reviews[0].failed,
            nextChange: reviews[0].nextChange,
          }
        : null,
    },
  };
}

export function buildDayCalendar(store: LifeStore, date: string) {
  const tasks = tasksForDate(store, date).filter((t) => !t.archived);
  const habits = tasks.filter((t) => t.habitId);
  const fromGoals = tasks.filter((t) => t.goalId && !t.habitId);
  const personal = tasks.filter((t) => !t.goalId && !t.habitId);

  const mapTask = (t: DailyTaskItem) => ({
    id: t.id,
    title: t.title,
    done: t.done,
    goalId: t.goalId,
    goalTitle: t.goalId
      ? store.goals.find((g) => g.id === t.goalId)?.title
      : undefined,
    habitId: t.habitId,
    side: sideOfTask(store, t),
    priority: t.priority,
  });

  const relatedGoals = [
    ...new Set(fromGoals.map((t) => t.goalId).filter(Boolean) as string[]),
  ]
    .map((id) => store.goals.find((g) => g.id === id))
    .filter(Boolean)
    .map((g) => goalCard(store, g!));

  const review = (store.reviews ?? []).find(
    (r) => r.cadence === "day" && r.periodKey === date
  );

  return {
    date,
    weekday: new Date(date + "T12:00:00").getDay(),
    prev: addDays(date, -1),
    next: addDays(date, 1),
    summary: {
      ...taskPulse(tasks),
      sides: sidePulse(store, tasks),
    },
    tasks: {
      habits: habits.map(mapTask),
      fromGoals: fromGoals.map(mapTask),
      personal: personal.map(mapTask),
    },
    goals: relatedGoals,
    principles: (store.principles ?? [])
      .filter((p) => !p.archived)
      .slice(0, 6)
      .map((p) => ({ id: p.id, title: p.title, layer: p.layer })),
    review: review
      ? {
          happened: review.happened,
          worked: review.worked,
          failed: review.failed,
          learned: review.learned,
          nextChange: review.nextChange,
        }
      : null,
  };
}
