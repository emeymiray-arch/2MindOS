import type { LifeStore } from "./types";

export type StoreAudit = {
  goals: number;
  workPlans: number;
  dayTasks: number;
  habitLogs: number;
  habits: number;
  timeEntries: number;
  quests: number;
  projects: number;
  wishBlocks: number;
  wishItemsDone: number;
  wishItemsWithDoneAt: number;
  thoughtEntries: number;
  captures: number;
  calendarEvents: number;
  weeks: number;
  vitals: number;
  financeTransactions: number;
  nodes: number;
  passwords: number;
  plans: number;
  revision: number;
  version: number;
};

export function auditStore(store: LifeStore): StoreAudit {
  const wishItems = (store.wishBlocks ?? []).flatMap((b) => b.items ?? []);
  return {
    goals: store.goals?.length ?? 0,
    workPlans: store.workPlans?.length ?? 0,
    dayTasks: store.dayTasks?.length ?? 0,
    habitLogs: store.habitLogs?.length ?? 0,
    habits: store.habits?.length ?? 0,
    timeEntries: store.timeEntries?.length ?? 0,
    quests: store.quests?.length ?? 0,
    projects: store.projects?.length ?? 0,
    wishBlocks: store.wishBlocks?.length ?? 0,
    wishItemsDone: wishItems.filter((i) => i.done && !i.archived).length,
    wishItemsWithDoneAt: wishItems.filter((i) => i.done && i.doneAt).length,
    thoughtEntries:
      store.thoughtJournals?.reduce((n, j) => n + (j.entries?.filter((e) => !e.archived).length ?? 0), 0) ??
      0,
    captures: store.captures?.length ?? 0,
    calendarEvents: (store.calendarEvents ?? []).filter((e) => !e.archived).length,
    weeks: store.weeks?.length ?? 0,
    vitals: store.vitals?.length ?? 0,
    financeTransactions: (store.finance?.transactions ?? []).filter((t) => !t.archived).length,
    nodes: store.nodes?.length ?? 0,
    passwords: (store.passwords ?? []).filter((p) => !p.archived).length,
    plans: store.plans?.length ?? 0,
    revision: Number(store.revision) || 0,
    version: store.version ?? 0,
  };
}

/** Known gaps: data types without reliable timestamps or write paths. */
export const PERSISTENCE_GAPS = [
  {
    id: "project-module-tasks",
    label: "Задачи внутри проекта (modules.tasks)",
    issue: "Только просмотр — нет API для сохранения отметок",
  },
  {
    id: "wish-done-legacy",
    label: "Купленные вещи до doneAt",
    issue: "Старые done без даты не попадают в Архив",
  },
  {
    id: "task-completed-at",
    label: "Точное время закрытия задачи",
    issue: "Сохраняется только день (date), не момент галочки",
  },
] as const;
