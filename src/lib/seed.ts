import { id, now } from "./id";
import type { LifeStore } from "./types";
import { createDefaultPlan, seedLifeAreas } from "./lifeos";
import { CURRENT_VERSION } from "./migrate";

/**
 * Clean slate for a customer (or first local boot).
 * No personal curricula / ventures — only catalog directions + empty finance.
 * Version is current so migrate() does not inject owner curricula.
 */
export function createEmptyStore(): LifeStore {
  const t = now();
  const spheres = seedLifeAreas();
  const plan = createDefaultPlan(t);

  return {
    version: CURRENT_VERSION,
    spheres,
    periodFocus: [],
    principles: [],
    outcomes: [],
    reviews: [],
    nodes: [],
    edges: [],
    captures: [],
    goals: [],
    plans: [plan],
    workPlans: [],
    weeks: [],
    stageDayLogs: [],
    dayTasks: [],
    taskCategories: [],
    habits: [],
    habitLogs: [],
    vitals: [],
    projects: [],
    books: [],
    reviewCards: [],
    skills: [],
    wishBlocks: [],
    thoughtJournals: [
      { id: id(), title: "Мысли из книг", entries: [], createdAt: t },
      { id: id(), title: "Мои мысли", entries: [], createdAt: t },
      { id: id(), title: "Мои цитаты", entries: [], createdAt: t },
      { id: id(), title: "Мой дневник", entries: [], createdAt: t },
    ],
    finance: {
      incomeMonth: 0,
      expensesMonth: 0,
      mandatoryMonth: 0,
      salary: 0,
      cushion: 0,
      cushionManual: false,
      debts: 0,
      currency: "₽",
      subscriptions: [],
      goals: [],
      transactions: [],
      categories: [
        { id: id(), name: "Доход", kind: "income", color: "#34d399", archived: false },
        { id: id(), name: "Расход", kind: "expense", color: "#fb923c", archived: false },
        { id: id(), name: "Обязательное", kind: "mandatory", color: "#a855f7", archived: false },
        { id: id(), name: "В подушку", kind: "savings", color: "#38bdf8", archived: false },
      ],
    },
    calendarEvents: [],
    passwords: [],
    oracleMessages: [],
    roadmap: { stages: [] },
    timeEntries: [],
    quests: [],
    playerProfile: {
      totalXp: 0,
      level: 1,
      streakDays: 0,
      todayXp: 0,
      todayFocusMinutes: 0,
    },
    settings: {
      shortcutsToken: "mindos-local-token",
      yearProgressNote: "",
      visionNote: "",
      mit: "",
      theme: "dark",
      language: "ru",
      startOfWeek: 1,
      notifications: true,
      sound: false,
      reduceMotion: false,
      compactMode: false,
      showArchived: false,
      name: "",
      email: "",
      dailyCapacity: 6,
      dailyCapacityMinutes: 270,
      accentColor: "green",
      onboardingDone: false,
    },
  };
}
