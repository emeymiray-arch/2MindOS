import type { LifeStore } from "./types";

/** How much real user content a snapshot holds. Seed/demo must not beat this. */
export function storeWeight(store: LifeStore | null | undefined): number {
  if (!store) return 0;
  const journalEntries =
    store.thoughtJournals?.reduce((n, j) => n + (j.entries?.length ?? 0), 0) ?? 0;
  return (
    (store.goals?.length ?? 0) * 10 +
    (store.workPlans?.length ?? 0) * 10 +
    (store.plans?.length ?? 0) * 3 +
    (store.projects?.length ?? 0) * 4 +
    (store.nodes?.length ?? 0) +
    (store.dayTasks?.length ?? 0) +
    (store.wishBlocks?.length ?? 0) * 2 +
    (store.passwords?.length ?? 0) * 2 +
    (store.weeks?.length ?? 0) +
    (store.taskCategories?.length ?? 0) +
    (store.habits?.length ?? 0) +
    (store.habitLogs?.length ?? 0) +
    (store.captures?.length ?? 0) +
    journalEntries
  );
}

export function isSparseStore(store: LifeStore | null | undefined): boolean {
  return storeWeight(store) < 8;
}

/**
 * Empty/demo snapshots must never replace a fuller copy.
 * Small edits (delete one goal) are allowed; wiping most of the brain is not.
 */
export function isDestructiveOverwrite(
  next: LifeStore | null | undefined,
  prev: LifeStore | null | undefined
): boolean {
  const nw = storeWeight(next);
  const pw = storeWeight(prev);
  if (pw < 8) return false;
  if (nw >= pw) return false;
  if (isSparseStore(next) && pw > nw * 2) return true;
  if (pw >= 20 && nw < pw * 0.35) return true;
  return false;
}

export function pickRicher(
  a: LifeStore | null | undefined,
  b: LifeStore | null | undefined
): LifeStore | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return storeWeight(b) > storeWeight(a) ? b : a;
}
