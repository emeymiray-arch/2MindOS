import { id, todayKey } from "./id";
import { taskChain } from "./lifeos";
import type { ActiveTimer, DailyTaskItem, LifeStore, TimeEntry } from "./types";

export function elapsedMinutesSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

export function getActiveTimer(store: LifeStore): ActiveTimer | null {
  return store.activeTimer ?? null;
}

export function startTimer(store: LifeStore, task: DailyTaskItem, date: string): ActiveTimer {
  if (store.activeTimer) {
    stopTimer(store, store.activeTimer.date);
  }
  const chain = taskChain(store, task);
  const timer: ActiveTimer = {
    taskId: task.id,
    taskTitle: task.title,
    goalId: task.goalId ?? chain.goal?.id,
    goalTitle: task.goalTitle ?? chain.goal?.title,
    workPlanId: task.workPlanId ?? chain.workPlan?.id,
    lifeAreaId: task.lifeAreaId ?? chain.area?.id,
    startedAt: new Date().toISOString(),
    date,
  };
  store.activeTimer = timer;
  return timer;
}

export function stopTimer(store: LifeStore, date?: string): TimeEntry | null {
  const active = store.activeTimer;
  if (!active) return null;

  const endedAt = new Date().toISOString();
  const durationMinutes = Math.max(
    1,
    Math.round((new Date(endedAt).getTime() - new Date(active.startedAt).getTime()) / 60000)
  );
  const entryDate = date ?? active.date ?? todayKey();

  const entry: TimeEntry = {
    id: id(),
    taskId: active.taskId,
    taskTitle: active.taskTitle,
    goalId: active.goalId,
    goalTitle: active.goalTitle,
    workPlanId: active.workPlanId,
    lifeAreaId: active.lifeAreaId,
    startedAt: active.startedAt,
    endedAt,
    durationMinutes,
    date: entryDate,
    source: "timer",
  };

  if (!store.timeEntries) store.timeEntries = [];
  store.timeEntries.push(entry);
  store.activeTimer = undefined;

  const task = store.dayTasks.find((x) => x.id === active.taskId);
  if (task) {
    task.actualMinutes = (task.actualMinutes ?? 0) + durationMinutes;
  }

  if (store.playerProfile) {
    store.playerProfile.todayFocusMinutes =
      (store.playerProfile.todayFocusMinutes ?? 0) + durationMinutes;
  }

  return entry;
}

export function sumMinutesForGoal(
  store: LifeStore,
  goalId: string,
  from?: string,
  to?: string
): number {
  return (store.timeEntries ?? [])
    .filter((e) => e.goalId === goalId)
    .filter((e) => !from || e.date >= from)
    .filter((e) => !to || e.date <= to)
    .reduce((sum, e) => sum + e.durationMinutes, 0);
}

export function sumMinutesForDate(store: LifeStore, date: string): number {
  let total = (store.timeEntries ?? [])
    .filter((e) => e.date === date)
    .reduce((sum, e) => sum + e.durationMinutes, 0);
  const active = store.activeTimer;
  if (active?.date === date) {
    total += elapsedMinutesSince(active.startedAt);
  }
  return total;
}

export function timeByGoal(store: LifeStore, from: string, to: string) {
  const map = new Map<string, { goalId: string; goalTitle: string; minutes: number }>();
  for (const e of store.timeEntries ?? []) {
    if (e.date < from || e.date > to) continue;
    if (!e.goalId) continue;
    const cur = map.get(e.goalId) ?? {
      goalId: e.goalId,
      goalTitle: e.goalTitle ?? "Без цели",
      minutes: 0,
    };
    cur.minutes += e.durationMinutes;
    map.set(e.goalId, cur);
  }
  return [...map.values()].sort((a, b) => b.minutes - a.minutes);
}

export function taskMinutesToday(store: LifeStore, taskId: string, date: string): number {
  const logged = (store.timeEntries ?? [])
    .filter((e) => e.taskId === taskId && e.date === date)
    .reduce((sum, e) => sum + e.durationMinutes, 0);
  const active = store.activeTimer;
  if (active?.taskId === taskId && active.date === date) {
    return logged + elapsedMinutesSince(active.startedAt);
  }
  return logged;
}

export function formatMinutes(m: number): string {
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest > 0 ? `${h} ч ${rest} мин` : `${h} ч`;
}

export function activeTimerPayload(store: LifeStore) {
  const t = getActiveTimer(store);
  if (!t) return null;
  return {
    ...t,
    elapsedMinutes: elapsedMinutesSince(t.startedAt),
  };
}
