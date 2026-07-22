import { id } from "./id";
import type { DailyTaskItem, Goal, LifeStore, StageDayLog, TaskCategory } from "./types";

function inRange(date: string, start?: string, end?: string): boolean {
  if (!start && !end) return false;
  const s = start ?? end!;
  const e = end ?? start!;
  return date >= s && date <= e;
}

export function calcGoalProgress(goal: Goal): number {
  const stages = (goal.stages ?? []).filter((s) => !s.archived);
  if (!stages.length) return goal.progress ?? 0;
  const done = stages.filter((s) => s.done).length;
  return Math.round((done / stages.length) * 100);
}

/** Pure: merge stored dayTasks with active goal stages for the date. */
export function tasksForDate(
  store: LifeStore,
  date: string,
  opts?: { archived?: boolean }
): DailyTaskItem[] {
  const showArchived = Boolean(opts?.archived);
  const dayTasks = store.dayTasks ?? [];
  const logs = store.stageDayLogs ?? [];
  const byKey = new Map<string, DailyTaskItem>();
  const archivedStageIds = new Set(
    dayTasks
      .filter((t) => t.date === date && t.archived && t.stageId)
      .map((t) => t.stageId as string)
  );

  for (const t of dayTasks) {
    if (t.date !== date) continue;
    if (showArchived ? !t.archived : t.archived) continue;
    const key = t.stageId ? `stage:${t.stageId}` : `id:${t.id}`;
    byKey.set(key, { ...t });
  }

  if (!showArchived) {
    for (const goal of store.goals.filter((g) => g.active && !g.archived)) {
      for (const stage of (goal.stages ?? []).filter((s) => !s.archived)) {
        if (!inRange(date, stage.deadlineStart, stage.deadlineEnd)) continue;
        if (archivedStageIds.has(stage.id)) continue;
        const key = `stage:${stage.id}`;
        const existing = byKey.get(key);
        const log = logs.find((l) => l.stageId === stage.id && l.date === date);
        const done = log ? log.done : stage.done;
        if (existing) {
          existing.title = stage.title;
          existing.goalId = goal.id;
          existing.goalTitle = goal.title;
          existing.deadlineStart = stage.deadlineStart;
          existing.deadlineEnd = stage.deadlineEnd;
          existing.done = done;
        } else {
          byKey.set(key, {
            id: `virt:${stage.id}:${date}`,
            date,
            title: stage.title,
            done,
            stageId: stage.id,
            goalId: goal.id,
            goalTitle: goal.title,
            deadlineStart: stage.deadlineStart,
            deadlineEnd: stage.deadlineEnd,
          });
        }
      }
    }
  }

  return Array.from(byKey.values()).sort(
    (a, b) => Number(a.done) - Number(b.done) || a.title.localeCompare(b.title, "ru")
  );
}

export function upsertStageDayLog(
  store: LifeStore,
  stageId: string,
  date: string,
  done: boolean,
  makeId: () => string
): StageDayLog {
  if (!store.stageDayLogs) store.stageDayLogs = [];
  const existing = store.stageDayLogs.find((l) => l.stageId === stageId && l.date === date);
  if (existing) {
    existing.done = done;
    return existing;
  }
  const row: StageDayLog = { id: makeId(), stageId, date, done };
  store.stageDayLogs.push(row);
  return row;
}

export function ensureDayTask(
  store: LifeStore,
  patch: Omit<DailyTaskItem, "id"> & { id?: string }
): DailyTaskItem {
  if (!store.dayTasks) store.dayTasks = [];
  if (patch.stageId) {
    const existing = store.dayTasks.find(
      (t) => t.date === patch.date && t.stageId === patch.stageId
    );
    if (existing) {
      Object.assign(existing, patch, { id: existing.id });
      return existing;
    }
  }
  if (patch.id && !patch.id.startsWith("virt:")) {
    const existing = store.dayTasks.find((t) => t.id === patch.id);
    if (existing) {
      Object.assign(existing, patch);
      return existing;
    }
  }
  const row: DailyTaskItem = {
    id: patch.id && !patch.id.startsWith("virt:") ? patch.id : id(),
    date: patch.date,
    title: patch.title,
    done: patch.done,
    archived: patch.archived,
    categoryId: patch.categoryId,
    stageId: patch.stageId,
    goalId: patch.goalId,
    goalTitle: patch.goalTitle,
    deadlineStart: patch.deadlineStart,
    deadlineEnd: patch.deadlineEnd,
  };
  store.dayTasks.push(row);
  return row;
}

export function goalAnalytics(goal: Goal, _logs: StageDayLog[]) {
  const stages = (goal.stages ?? []).filter((s) => !s.archived);
  const total = stages.length;
  const done = stages.filter((s) => s.done).length;
  const today = new Date().toISOString().slice(0, 10);
  const overdue = stages.filter((s) => {
    if (s.done || !s.deadlineEnd) return false;
    return s.deadlineEnd < today;
  }).length;

  return {
    total,
    done,
    open: total - done,
    overdue,
    progress: total ? Math.round((done / total) * 100) : 0,
  };
}

export function activeCategories(store: LifeStore): TaskCategory[] {
  return (store.taskCategories ?? [])
    .filter((c) => !c.archived)
    .slice()
    .sort((a, b) => a.order - b.order);
}

export interface CategoryAnalyticsRow {
  categoryId: string | null;
  name: string;
  total: number;
  done: number;
  open: number;
  progress: number;
}

/** Analytics for stored tasks in a month (YYYY-MM). */
export function categoryAnalytics(store: LifeStore, month: string): CategoryAnalyticsRow[] {
  const cats = activeCategories(store);
  const nameById = new Map(cats.map((c) => [c.id, c.name]));
  const buckets = new Map<string | null, { total: number; done: number }>();

  for (const t of store.dayTasks ?? []) {
    if (t.archived) continue;
    if (!t.date.startsWith(month)) continue;
    const key = t.categoryId ?? null;
    const b = buckets.get(key) ?? { total: 0, done: 0 };
    b.total += 1;
    if (t.done) b.done += 1;
    buckets.set(key, b);
  }

  const rows: CategoryAnalyticsRow[] = [];

  for (const c of cats) {
    const b = buckets.get(c.id) ?? { total: 0, done: 0 };
    rows.push({
      categoryId: c.id,
      name: c.name,
      total: b.total,
      done: b.done,
      open: b.total - b.done,
      progress: b.total ? Math.round((b.done / b.total) * 100) : 0,
    });
  }

  const uncategorized = buckets.get(null);
  if (uncategorized && uncategorized.total > 0) {
    rows.push({
      categoryId: null,
      name: "Без категории",
      total: uncategorized.total,
      done: uncategorized.done,
      open: uncategorized.total - uncategorized.done,
      progress: uncategorized.total
        ? Math.round((uncategorized.done / uncategorized.total) * 100)
        : 0,
    });
  }

  return rows.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "ru"));
}
