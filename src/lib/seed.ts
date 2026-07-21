import { id, now } from "./id";
import type { LifeStore } from "./types";

/** Clean slate — first run and Settings → Reset. */
export function createEmptyStore(): LifeStore {
  const t = now();
  return {
    version: 5,
    spheres: [],
    nodes: [],
    edges: [],
    captures: [],
    goals: [],
    stageDayLogs: [],
    dayTasks: [],
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
      cushion: 0,
      debts: 0,
      currency: "RUB",
      subscriptions: [],
      goals: [],
      transactions: [],
    },
    calendarEvents: [],
    passwords: [],
    oracleMessages: [],
    roadmap: { stages: [] },
    settings: {
      shortcutsToken: "mindos-local-token",
      yearProgressNote: "",
      mit: "",
      theme: "light",
      language: "ru",
      startOfWeek: 1,
      notifications: true,
      sound: false,
      reduceMotion: false,
      compactMode: false,
      showArchived: false,
      name: "",
      email: "",
    },
  };
}
