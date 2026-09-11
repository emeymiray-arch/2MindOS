import { findWorkPlan, weekStartMonday } from "./lifeos";
import {
  defaultTaskMinutes,
  formatTaskTitle,
  goalFocusScore,
  isGenericPlanTitle,
  pickGoalTopic,
  shouldSkipLegacyStage,
} from "./daily-focus";
import { ensureDayTask } from "./tasks";
import {
  currentHorizonStage,
  effectiveHorizonStage,
  unlockNextPlanStep,
} from "./plan-calendar";
import type { DailyTaskItem, Goal, LifeStore, TaskPriority, WishItem } from "./types";
import { todayKey } from "./id";
import { displayCurrency } from "./format";

export type ComposeResult = {
  added: number;
  updated: number;
  sources: string[];
};

/**
 * Today =
 *  - habits
 *  - exactly ONE current step from EACH active goal in the *current* 2-month этап
 *  - capacity-capped by settings.dailyCapacity (habits first, then goals by score)
 *  - personal tasks stay user-created
 *  - next purchase is a card (wishlist), not a task flood
 */

function hasSimilarTask(
  store: LifeStore,
  date: string,
  title: string,
  goalId?: string,
  excludeId?: string
) {
  const n = title.trim().toLowerCase();
  return (store.dayTasks ?? []).some(
    (t) =>
      t.id !== excludeId &&
      t.date === date &&
      !t.archived &&
      t.title.trim().toLowerCase() === n &&
      (goalId ? t.goalId === goalId : true)
  );
}

function priorityForGoal(store: LifeStore, goalId: string): TaskPriority {
  const g = store.goals.find((x) => x.id === goalId);
  if (!g) return "should";
  if (g.priority === "critical") return "must";
  if (g.priority === "high" || effectiveHorizonStage(g) === currentHorizonStage(store)) {
    return "should";
  }
  return "optional";
}

type Draft = Omit<DailyTaskItem, "id" | "done"> & { done?: boolean; score?: number };

function upsertDraft(
  store: LifeStore,
  date: string,
  draft: Draft,
  result: ComposeResult
) {
  const existing = draft.autoSource
    ? store.dayTasks?.find(
        (t) => t.date === date && t.autoSource === draft.autoSource && !t.archived
      )
    : undefined;

  if (existing) {
    let changed = false;
    if (existing.title !== draft.title) {
      existing.title = draft.title;
      changed = true;
    }
    if (draft.estimatedMinutes && existing.estimatedMinutes !== draft.estimatedMinutes) {
      existing.estimatedMinutes = draft.estimatedMinutes;
      changed = true;
    }
    if (changed) result.updated += 1;
    return;
  }

  if (hasSimilarTask(store, date, draft.title, draft.goalId)) return;

  ensureDayTask(store, {
    ...draft,
    done: draft.done ?? false,
  });
  result.added += 1;
  if (draft.autoSource) result.sources.push(draft.autoSource);
}

function goalInComposeScope(g: Goal, store: LifeStore, date: string) {
  return effectiveHorizonStage(g) === currentHorizonStage(store, date);
}

/** One concrete step per active goal. */
function collectGoalDrafts(store: LifeStore, date: string): Draft[] {
  const drafts: Draft[] = [];
  for (const g of store.goals.filter((x) => x.active && !x.archived)) {
    if (!goalInComposeScope(g, store, date)) continue;

    const pick = pickGoalTopic(store, g, date);
    if (pick) {
      drafts.push({
        date,
        title: pick.taskTitle,
        autoSource: `goal:${g.id}:topic:${pick.module.id}`,
        goalId: g.id,
        goalTitle: g.title,
        lifeAreaId: g.lifeAreaId,
        workPlanId: pick.workPlanId,
        stageId: pick.phase.id,
        milestoneId: pick.module.id,
        priority: priorityForGoal(store, g.id),
        deadlineStart: pick.module.deadlineStart,
        deadlineEnd: pick.module.deadlineEnd,
        estimatedMinutes: pick.estimatedMinutes,
        score: goalFocusScore(g, store),
      });
      continue;
    }

    if (shouldSkipLegacyStage(g)) continue;

    for (const stage of (g.stages ?? []).filter((s) => !s.archived && !s.done)) {
      const start = stage.deadlineStart;
      const end = stage.deadlineEnd;
      const inRange = start && end ? date >= start && date <= end : !stage.done;
      if (!inRange) continue;
      const title = formatTaskTitle(stage.title, g.title);
      if (isGenericPlanTitle(title)) break;
      drafts.push({
        date,
        title,
        autoSource: `goal:${g.id}:stage:${stage.id}`,
        goalId: g.id,
        goalTitle: g.title,
        lifeAreaId: g.lifeAreaId,
        stageId: stage.id,
        priority: priorityForGoal(store, g.id),
        deadlineStart: stage.deadlineStart,
        deadlineEnd: stage.deadlineEnd,
        estimatedMinutes: defaultTaskMinutes(store),
        score: goalFocusScore(g, store),
      });
      break;
    }
  }
  return drafts;
}

function collectHabitDrafts(store: LifeStore, date: string): Draft[] {
  const weekStart = weekStartMonday(date);
  const day = new Date(date + "T12:00:00").getDay();
  const drafts: Draft[] = [];

  for (const h of store.habits.filter((x) => x.active && !x.archived)) {
    const log = store.habitLogs.find((l) => l.habitId === h.id && l.date === date);
    if (log && log.value >= h.targetPerDay) continue;

    if (h.frequency === "weekly") {
      const weekLogs = store.habitLogs.filter(
        (l) => l.habitId === h.id && l.date >= weekStart && l.date <= date && l.value > 0
      );
      if (weekLogs.length > 0) continue;
      if (date !== weekStart && day !== 1) continue;
    }

    drafts.push({
      date,
      title: h.title,
      autoSource: `habit:${h.id}`,
      habitId: h.id,
      goalId: h.goalId,
      lifeAreaId: h.lifeAreaId,
      priority: "should",
      estimatedMinutes: 15,
      score: 5,
    });
  }
  return drafts;
}

function applyDrafts(store: LifeStore, date: string, drafts: Draft[], result: ComposeResult) {
  const cap = Math.max(1, store.settings.dailyCapacity ?? 6);
  const habits = drafts.filter((d) => d.habitId);
  const goals = drafts
    .filter((d) => !d.habitId)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  // Always leave at least one slot for a goal step when goals exist.
  const habitSlots = goals.length > 0 ? Math.min(habits.length, Math.max(0, cap - 1)) : habits.length;
  const selectedHabits = habits.slice(0, habitSlots);
  const selectedGoals = goals.slice(0, Math.max(0, cap - selectedHabits.length));
  const keep = new Set(
    [...selectedHabits, ...selectedGoals].map((d) => d.autoSource).filter(Boolean) as string[]
  );
  const candidate = new Set(goals.map((d) => d.autoSource).filter(Boolean) as string[]);

  for (const t of store.dayTasks ?? []) {
    if (t.date !== date || t.archived || t.done || !t.autoSource || !t.goalId) continue;
    if (!candidate.has(t.autoSource)) continue;
    if (!keep.has(t.autoSource)) t.archived = true;
  }

  for (const draft of [...selectedHabits, ...selectedGoals]) {
    upsertDraft(store, date, draft, result);
  }
}

/** Keep only the current step per goal; archive older auto topics + out-of-scope stages. */
function resyncGoalTopics(store: LifeStore, date: string) {
  const curStage = currentHorizonStage(store, date);
  for (const t of store.dayTasks ?? []) {
    if (t.date !== date || t.archived || t.done) continue;
    if (t.autoSource?.startsWith("project:")) {
      t.archived = true;
      continue;
    }
    if (!t.autoSource?.includes(":topic:") && !t.autoSource?.includes(":stage:")) continue;
    if (!t.goalId) {
      if (t.autoSource?.startsWith("project:")) t.archived = true;
      continue;
    }
    const goal = store.goals.find((g) => g.id === t.goalId);
    if (!goal?.active || goal.archived) {
      t.archived = true;
      continue;
    }
    if (effectiveHorizonStage(goal) !== curStage) {
      t.archived = true;
      continue;
    }
    const pick = pickGoalTopic(store, goal, date);
    if (!pick) {
      if (t.autoSource.includes(":topic:")) t.archived = true;
      continue;
    }
    if (t.milestoneId && t.milestoneId !== pick.module.id) t.archived = true;
    if (t.autoSource.includes(":stage:") && goal.workPlanId) t.archived = true;
  }
}

function cleanupNoise(store: LifeStore, date: string) {
  resyncGoalTopics(store, date);
  for (const t of store.dayTasks ?? []) {
    if (t.date !== date || t.archived || t.done) continue;
    if (t.autoSource?.startsWith("habit:")) continue;
    if (t.autoSource?.includes(":topic:")) continue;
    if (t.autoSource?.includes(":stage:")) continue;
    if (!t.autoSource) continue;
    if (
      t.autoSource.includes(":module:") ||
      t.autoSource.startsWith("week:") ||
      t.autoSource.includes(":task:") ||
      t.autoSource.startsWith("project:")
    ) {
      t.archived = true;
    }
  }
}

export type NextPurchase = {
  blockId: string;
  itemId: string;
  title: string;
  hashtag: string;
  description?: string;
  cushion: number;
  currency: string;
  targetAmount?: number;
  savedToward?: number;
  progress?: number;
};

export function pickNextPurchase(store: LifeStore): NextPurchase | null {
  const material = (store.wishBlocks ?? []).filter(
    (b) =>
      !b.archived &&
      (b.bucket === "material" || b.bucket === "shopping" || b.bucket === "wishlist")
  );
  const savedByItem = new Map<string, number>();
  for (const t of store.finance?.transactions ?? []) {
    if (t.archived || t.type !== "savings" || !t.wishItemId) continue;
    savedByItem.set(t.wishItemId, (savedByItem.get(t.wishItemId) ?? 0) + t.amount);
  }
  let best: { block: (typeof material)[0]; item: WishItem; saved: number; score: number } | null =
    null;
  for (const b of material) {
    for (const item of (b.items ?? []).filter((i) => !i.done && !i.archived)) {
      const target = item.targetAmount ?? 0;
      const saved = savedByItem.get(item.id) ?? item.savedToward ?? 0;
      const score = target > 0 ? saved / target + 10 : 1;
      if (!best || score > best.score) best = { block: b, item, saved, score };
    }
  }
  if (!best) return null;
  const { block: b, item, saved } = best;
  const target = item.targetAmount;
  return {
    blockId: b.id,
    itemId: item.id,
    title: item.title,
    hashtag: b.hashtag,
    description: item.description,
    cushion: (() => {
      const f = store.finance;
      if (!f) return 0;
      if (f.cushionManual) return f.cushion ?? 0;
      return (f.transactions ?? [])
        .filter((t) => !t.archived && t.type === "savings")
        .reduce((a, t) => a + t.amount, 0);
    })(),
    currency: displayCurrency(store.finance?.currency),
    targetAmount: target,
    savedToward: saved,
    progress: target && target > 0 ? Math.min(1, saved / target) : undefined,
  };
}

/** Compose habits + 1 step per goal in the *current* 2-month этап (capacity-aware). */
export function composeToday(store: LifeStore, date: string): ComposeResult {
  const result: ComposeResult = { added: 0, updated: 0, sources: [] };
  if (!store.dayTasks) store.dayTasks = [];

  const beforeArchived = (store.dayTasks ?? []).filter((t) => t.archived).length;
  const inScope = (g: Goal) => goalInComposeScope(g, store, date);

  for (const g of store.goals.filter((x) => x.active && !x.archived && x.workPlanId)) {
    if (!inScope(g)) continue;
    const wp = findWorkPlan(store, g.workPlanId!);
    if (wp && wp.ownerType !== "project") unlockNextPlanStep(store, wp.id, date);
  }

  cleanupNoise(store, date);

  const afterArchived = (store.dayTasks ?? []).filter((t) => t.archived).length;
  if (afterArchived > beforeArchived) {
    result.updated += afterArchived - beforeArchived;
  }

  const drafts = [
    ...collectGoalDrafts(store, date),
    ...collectHabitDrafts(store, date),
  ];
  applyDrafts(store, date, drafts, result);

  return result;
}

export async function ensureTodayComposed(
  getStoreFn: () => Promise<LifeStore>,
  updateStoreFn: (
    mutator: (store: LifeStore) => void | Promise<void>
  ) => Promise<LifeStore>,
  date: string
): Promise<{ store: LifeStore; composed: ComposeResult | null }> {
  const current = await getStoreFn();
  // Dry-run on a clone — avoid cloud write (pull+CAS) when compose is a no-op.
  const probe = JSON.parse(JSON.stringify(current)) as LifeStore;
  const preview = composeToday(probe, date);
  if (preview.added === 0 && preview.updated === 0) {
    return { store: current, composed: null };
  }

  let applied: ComposeResult = { added: 0, updated: 0, sources: [] };
  const updated = await updateStoreFn((s) => {
    applied = composeToday(s, date);
  });
  if (applied.added === 0 && applied.updated === 0) {
    return { store: updated, composed: null };
  }
  return { store: updated, composed: applied };
}

export function shouldAutoCompose(date: string) {
  return date === todayKey();
}

/** Soft hint: current horizon stage for scoring (exported for UI). */
export function todayFocusStage(store: LifeStore) {
  return currentHorizonStage(store);
}
