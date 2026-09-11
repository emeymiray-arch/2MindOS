import type { LifeStore } from "./types";
import { ensurePlayerProfile } from "./gamification";

export type ActionFeedback = {
  xp?: number;
  leveledUp?: boolean;
  level?: number;
  message?: string;
};

export function playerSnapshot(store: LifeStore) {
  const p = ensurePlayerProfile(store);
  return { level: p.level, todayXp: p.todayXp ?? 0 };
}

export function feedbackAfterAction(
  before: ReturnType<typeof playerSnapshot>,
  after: ReturnType<typeof playerSnapshot>,
  xp?: number
): ActionFeedback | null {
  if (!xp && before.level === after.level && before.todayXp === after.todayXp) return null;
  const leveledUp = after.level > before.level;
  return {
    xp,
    leveledUp,
    level: after.level,
    message: leveledUp ? `Уровень ${after.level}!` : xp ? `+${xp} XP` : undefined,
  };
}
