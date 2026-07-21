import type { LifeStore, WishBlock, ThoughtJournal, AppSettings } from "./types";
import { calcGoalProgress } from "./tasks";
import { id } from "./id";
import { normalizeHashtag } from "./format";
import { emptyRoadmap } from "./roadmap";
import { randomBytes } from "crypto";

const CURRENT_VERSION = 5;

function freshToken() {
  return `mos_${randomBytes(18).toString("hex")}`;
}

function defaultSettings(partial?: Partial<AppSettings>): AppSettings {
  const existing = partial?.shortcutsToken;
  const token =
    existing && existing !== "mindos-local-token" ? existing : freshToken();
  return {
    yearProgressNote: "Год строительства системы",
    mit: "Фокус дня",
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
    ...partial,
    shortcutsToken: token,
  };
}

export function migrateStore(raw: LifeStore): LifeStore {
  const store = raw;

  if (!store.stageDayLogs) store.stageDayLogs = [];
  if (!store.dayTasks) store.dayTasks = [];
  if (!store.calendarEvents) store.calendarEvents = [];
  if (!store.passwords) store.passwords = [];
  if (!store.thoughtJournals) store.thoughtJournals = [];
  if (!store.wishBlocks) store.wishBlocks = [];

  store.settings = defaultSettings(store.settings as Partial<AppSettings>);

  // Rotate weak default token once (v4)
  if (
    store.version < 4 &&
    (store.settings.shortcutsToken === "mindos-local-token" || !store.settings.shortcutsToken)
  ) {
    store.settings.shortcutsToken = freshToken();
  }

  store.goals = (store.goals ?? []).map((g) => {
    const stages = (g.stages ?? []).map((s, i) => ({ ...s, order: s.order ?? i + 1 }));
    return {
      ...g,
      stages,
      progress: calcGoalProgress({ ...g, stages }),
      archived: Boolean(g.archived),
    };
  });

  // Migrate flat wishes → wishBlocks by hashtag/title
  if ((!store.wishBlocks || store.wishBlocks.length === 0) && store.wishes?.length) {
    const map = new Map<string, WishBlock>();
    for (const w of store.wishes) {
      const tag = normalizeHashtag(w.title.split(" ")[0] || "общее");
      let block = map.get(tag);
      if (!block) {
        block = {
          id: id(),
          hashtag: tag,
          bucket: "material",
          nodeId: w.nodeId || id(),
          items: [],
          createdAt: w.createdAt ?? new Date().toISOString(),
        };
        map.set(tag, block);
      }
      block.items.push({
        id: w.id,
        title: w.title,
        description: w.description,
        photoDataUrl: w.photoDataUrl,
        done: Boolean(w.done),
        archived: false,
      });
    }
    store.wishBlocks = Array.from(map.values());
  }

  if (store.thoughtJournals.length === 0) {
    const t = new Date().toISOString();
    const date = t.slice(0, 10);
    store.thoughtJournals = [
      {
        id: id(),
        title: "Мысли из книг",
        createdAt: t,
        entries: [
          { id: id(), word: "Система", body: "Цели задают направление, системы — прогресс.", date },
        ],
      },
      { id: id(), title: "Мои мысли", createdAt: t, entries: [] },
      { id: id(), title: "Мои цитаты", createdAt: t, entries: [] },
      { id: id(), title: "Мой дневник", createdAt: t, entries: [] },
    ] as ThoughtJournal[];
  }

  store.projects = (store.projects ?? []).map((p) => ({
    ...p,
    diary: p.diary ?? [],
  }));

  if (!store.finance) {
    store.finance = {
      incomeMonth: 0,
      expensesMonth: 0,
      mandatoryMonth: 0,
      cushion: 0,
      debts: 0,
      currency: "RUB",
      subscriptions: [],
      goals: [],
      transactions: [],
    };
  }
  if (!store.finance.transactions) store.finance.transactions = [];
  if (store.finance.mandatoryMonth == null) store.finance.mandatoryMonth = 0;

  if (!store.roadmap) store.roadmap = emptyRoadmap();
  store.roadmap.stages = (store.roadmap.stages ?? []).map((s, i) => ({
    ...s,
    subtitle: s.subtitle ?? "",
    order: s.order ?? i + 1,
    archived: Boolean(s.archived),
    months: (s.months ?? []).map((m) => ({
      ...m,
      goals: m.goals ?? [],
      days: (m.days ?? []).map((d) => ({
        ...d,
        tasks: d.tasks ?? [],
      })),
      archived: Boolean(m.archived),
    })),
  }));

  store.version = CURRENT_VERSION;
  return store;
}

export { defaultSettings, CURRENT_VERSION };
