import { id, todayKey } from "./id";
import { weekStartMonday } from "./lifeos";
import { sumMinutesForDate } from "./time";
import { tasksForDate } from "./tasks";
import type { DailyTaskItem, LifeStore, Quest } from "./types";

function shiftDate(iso: string, delta: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function xpToNextLevel(level: number): number {
  return 100 + Math.max(0, level - 1) * 50;
}

export function ensurePlayerProfile(store: LifeStore) {
  if (!store.playerProfile) {
    store.playerProfile = {
      totalXp: 0,
      level: 1,
      streakDays: 0,
      todayXp: 0,
      todayFocusMinutes: 0,
    };
  }
  return store.playerProfile;
}

export function grantXp(store: LifeStore, amount: number, date: string) {
  const p = ensurePlayerProfile(store);
  if (p.lastActiveDate && p.lastActiveDate !== date) {
    p.todayXp = 0;
  }
  p.totalXp += amount;
  p.todayXp = (p.todayXp ?? 0) + amount;
  while (p.totalXp >= xpToNextLevel(p.level)) {
    p.totalXp -= xpToNextLevel(p.level);
    p.level += 1;
  }
  p.lastActiveDate = date;
}

export function updateStreak(store: LifeStore, date: string) {
  const p = ensurePlayerProfile(store);
  if (p.lastActiveDate === date) return;
  const yesterday = shiftDate(date, -1);
  if (p.lastActiveDate === yesterday) {
    p.streakDays += 1;
  } else {
    p.streakDays = 1;
  }
  if (p.lastActiveDate !== date) {
    p.todayXp = 0;
  }
  p.lastActiveDate = date;
}

const WEEKLY_QUEST_TEMPLATES: Omit<Quest, "id" | "progress" | "done" | "createdAt" | "weekStart">[] = [
  {
    title: "300 минут фокуса за неделю",
    kind: "weekly",
    targetCount: 300,
    xpReward: 50,
  },
  {
    title: "20 задач за неделю",
    kind: "weekly",
    targetCount: 20,
    xpReward: 40,
  },
];

const DAILY_QUEST_TEMPLATES: Omit<Quest, "id" | "progress" | "done" | "createdAt">[] = [
  {
    title: "Закрыть 3 обязательных квеста",
    kind: "daily",
    targetCount: 3,
    xpReward: 30,
  },
  {
    title: "45 минут фокуса",
    kind: "daily",
    targetCount: 45,
    xpReward: 25,
  },
  {
    title: "Завершить 5 квестов за день",
    kind: "daily",
    targetCount: 5,
    xpReward: 20,
  },
];

export function ensureDailyQuests(store: LifeStore, date: string): Quest[] {
  if (!store.quests) store.quests = [];
  store.quests = store.quests.filter((q) => !(q.kind === "daily" && q.date && q.date !== date));

  for (const tpl of DAILY_QUEST_TEMPLATES) {
    const exists = store.quests.some((q) => q.kind === "daily" && q.date === date && q.title === tpl.title);
    if (!exists) {
      store.quests.push({
        ...tpl,
        id: id(),
        progress: 0,
        done: false,
        date,
        createdAt: new Date().toISOString(),
      });
    }
  }
  return store.quests.filter((q) => q.kind === "daily" && q.date === date);
}

export function ensureWeeklyQuests(store: LifeStore, weekStart: string): Quest[] {
  if (!store.quests) store.quests = [];
  for (const tpl of WEEKLY_QUEST_TEMPLATES) {
    const exists = store.quests.some(
      (q) => q.kind === "weekly" && q.weekStart === weekStart && q.title === tpl.title
    );
    if (!exists) {
      store.quests.push({
        ...tpl,
        id: id(),
        progress: 0,
        done: false,
        weekStart,
        createdAt: new Date().toISOString(),
      });
    }
  }
  return store.quests.filter((q) => q.kind === "weekly" && q.weekStart === weekStart);
}

export function refreshQuestProgress(store: LifeStore, date: string) {
  ensureDailyQuests(store, date);
  const weekStart = weekStartMonday(date);
  ensureWeeklyQuests(store, weekStart);
  const tasks = tasksForDate(store, date);
  const doneMust = tasks.filter((t) => t.done && t.priority === "must").length;
  const doneAll = tasks.filter((t) => t.done).length;
  const focusMin = sumMinutesForDate(store, date);
  const weekFrom = shiftDate(date, -6);
  let weekFocus = 0;
  let weekDone = 0;
  for (let i = 0; i < 7; i++) {
    const d = shiftDate(weekFrom, i);
    if (d > date) break;
    weekFocus += sumMinutesForDate(store, d);
    weekDone += tasksForDate(store, d).filter((t) => t.done).length;
  }

  for (const q of store.quests ?? []) {
    if (q.kind === "weekly" && q.weekStart === weekStart && !q.done) {
      if (q.title.includes("фокуса")) q.progress = weekFocus;
      else if (q.title.includes("задач")) q.progress = weekDone;
      if (q.progress >= q.targetCount) {
        q.progress = q.targetCount;
        q.done = true;
        grantXp(store, q.xpReward, date);
      }
      continue;
    }
    if (q.kind !== "daily" || q.date !== date || q.done) continue;
    if (q.title.includes("обязательных")) q.progress = doneMust;
    else if (q.title.includes("фокуса")) q.progress = focusMin;
    else if (q.title.includes("5 квестов")) q.progress = doneAll;

    if (q.progress >= q.targetCount) {
      q.progress = q.targetCount;
      q.done = true;
      grantXp(store, q.xpReward, date);
    }
  }
}

export function onTaskComplete(store: LifeStore, task: DailyTaskItem, date: string) {
  updateStreak(store, date);
  const xp =
    task.priority === "must" ? 15 : task.priority === "should" ? 10 : 5;
  grantXp(store, xp, date);
  refreshQuestProgress(store, date);
}

export function onTimeLogged(store: LifeStore, date: string) {
  updateStreak(store, date);
  refreshQuestProgress(store, date);
}

export function getQuestPayload(store: LifeStore, date: string) {
  refreshQuestProgress(store, date);
  const p = ensurePlayerProfile(store);
  const weekStart = weekStartMonday(date);
  return {
    player: {
      level: p.level,
      xpInLevel: p.totalXp,
      xpToNext: xpToNextLevel(p.level),
      streakDays: p.streakDays,
      todayXp: p.todayXp ?? 0,
      todayFocusMinutes: sumMinutesForDate(store, date),
    },
    dailyQuests: (store.quests ?? []).filter((q) => q.kind === "daily" && q.date === date),
    weeklyQuests: (store.quests ?? []).filter(
      (q) => q.kind === "weekly" && q.weekStart === weekStart
    ),
  };
}

export function focusLoadPercent(store: LifeStore, date: string): number {
  const minutes = sumMinutesForDate(store, date);
  const cap = store.settings.dailyCapacityMinutes ?? (store.settings.dailyCapacity ?? 6) * 45;
  return cap > 0 ? Math.round((minutes / cap) * 100) : 0;
}

function questStateFingerprint(store: LifeStore, date: string): string {
  const daily = (store.quests ?? []).filter((q) => q.kind === "daily" && q.date === date);
  return JSON.stringify({ daily, player: store.playerProfile });
}

/** Persist daily quest + XP side effects when they changed (must not run on read-only GET without save). */
export async function syncQuestStateIfChanged(
  getStoreFn: () => Promise<LifeStore>,
  updateStoreFn: (mutator: (store: LifeStore) => void) => Promise<LifeStore>,
  date: string
): Promise<LifeStore> {
  const store = await getStoreFn();
  const before = questStateFingerprint(store, date);
  const probe = JSON.parse(JSON.stringify(store)) as LifeStore;
  refreshQuestProgress(probe, date);
  if (questStateFingerprint(probe, date) === before) return store;
  return updateStoreFn((s) => refreshQuestProgress(s, date));
}
