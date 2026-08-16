import type { LifeStore, WishBlock, ThoughtJournal, AppSettings, WishBucket } from "./types";
import { calcGoalProgress } from "./tasks";
import { id } from "./id";
import { normalizeHashtag } from "./format";
import { emptyRoadmap } from "./roadmap";
import {
  createDefaultPlan,
  ensureLifeAreas,
  mapLegacyWishBucket,
} from "./lifeos";
import { randomBytes } from "crypto";

const CURRENT_VERSION = 9;

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
    dailyCapacity: 6,
    ...partial,
    shortcutsToken: token,
  };
}

export function migrateStore(raw: LifeStore): LifeStore {
  const store = raw;

  if (!store.stageDayLogs) store.stageDayLogs = [];
  if (!store.dayTasks) store.dayTasks = [];
  if (!store.taskCategories) store.taskCategories = [];
  if (!store.calendarEvents) store.calendarEvents = [];
  if (!store.passwords) store.passwords = [];
  if (!store.thoughtJournals) store.thoughtJournals = [];
  if (!store.wishBlocks) store.wishBlocks = [];
  if (!store.plans) store.plans = [];
  if (!store.weeks) store.weeks = [];
  if (!store.workPlans) store.workPlans = [];
  if (!store.spheres) store.spheres = [];
  if (!store.habits) store.habits = [];
  if (!store.habitLogs) store.habitLogs = [];

  store.settings = defaultSettings(store.settings as Partial<AppSettings>);
  if (store.settings.dailyCapacity == null) store.settings.dailyCapacity = 6;

  if (
    store.version < 4 &&
    (store.settings.shortcutsToken === "mindos-local-token" || !store.settings.shortcutsToken)
  ) {
    store.settings.shortcutsToken = freshToken();
  }

  ensureLifeAreas(store);

  if (store.plans.length === 0) {
    store.plans.push(createDefaultPlan());
  }
  const activePlanId = store.plans.find((p) => p.status === "active")?.id;

  store.goals = (store.goals ?? []).map((g) => {
    const stages = (g.stages ?? []).map((s, i) => ({
      ...s,
      order: s.order ?? i + 1,
      status: s.status ?? (s.done ? ("done" as const) : i === 0 ? ("active" as const) : ("planned" as const)),
      progress: s.progress ?? (s.done ? 100 : 0),
    }));
    return {
      ...g,
      stages,
      progress: calcGoalProgress({ ...g, stages }),
      archived: Boolean(g.archived),
      planId: g.planId ?? activePlanId,
      bucket: g.bucket ?? "development",
      priority: g.priority ?? "medium",
      status: g.status ?? (g.archived ? "archived" : g.active ? "active" : "paused"),
      description: g.description ?? g.notes,
    };
  });

  // Migrate roadmap day tasks → dayTasks (once, when upgrading to v7)
  if (store.version < 7 && store.roadmap?.stages?.length) {
    for (const stage of store.roadmap.stages) {
      for (const month of stage.months ?? []) {
        for (const day of month.days ?? []) {
          for (const t of day.tasks ?? []) {
            const exists = store.dayTasks.some(
              (d) => d.date === day.date && d.title === t.title && !d.stageId
            );
            if (exists) continue;
            store.dayTasks.push({
              id: id(),
              date: day.date,
              title: t.title,
              done: t.done,
              priority: "should",
            });
          }
        }
        for (const mg of month.goals ?? []) {
          if (store.goals.some((g) => g.title === mg.title)) continue;
          const nodeId = id();
          const t = new Date().toISOString();
          store.nodes.push({
            id: nodeId,
            kind: "goal",
            title: mg.title,
            metadata: { fromRoadmap: true },
            salience: 0.5,
            createdAt: t,
            updatedAt: t,
          });
          store.goals.push({
            id: id(),
            nodeId,
            title: mg.title,
            stages: [],
            progress: mg.done ? 100 : 0,
            active: !mg.done,
            archived: false,
            createdAt: t,
            planId: activePlanId,
            bucket: "development",
            priority: "medium",
            status: mg.done ? "done" : "active",
          });
        }
      }
    }
  }

  if ((!store.wishBlocks || store.wishBlocks.length === 0) && store.wishes?.length) {
    const map = new Map<string, WishBlock>();
    for (const w of store.wishes) {
      const tag = normalizeHashtag(w.title.split(" ")[0] || "общее");
      let block = map.get(tag);
      if (!block) {
        block = {
          id: id(),
          hashtag: tag,
          bucket: "wishlist",
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

  store.wishBlocks = (store.wishBlocks ?? []).map((b) => ({
    ...b,
    bucket: mapLegacyWishBucket(b.bucket) as WishBucket,
  }));

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

  // Seed career projects if empty
  if (store.projects.length === 0) {
    const career = store.spheres.find((s) => s.slug === "career");
    const t = new Date().toISOString();
    for (const spec of [
      {
        name: "Engineering → AI → Business",
        tagline: "Learning → Skill → Project → Product → Business",
        modules: ["Engineering Foundation", "Web Engineering", "AI Development", "Product Building", "First Business"],
      },
      {
        name: "European Fast Food — Chechnya",
        tagline: "Research → Concept → Launch",
        modules: ["Research", "Market", "Concept", "Competitors", "Menu", "Unit Economics", "Branding", "Location", "MVP", "Launch"],
      },
    ]) {
      const nodeId = id();
      store.nodes.push({
        id: nodeId,
        kind: "project",
        title: spec.name,
        metadata: {},
        salience: 0.9,
        createdAt: t,
        updatedAt: t,
        sphereId: career?.id,
      });
      store.projects.push({
        id: id(),
        nodeId,
        name: spec.name,
        tagline: spec.tagline,
        status: "active",
        lifeAreaId: career?.id,
        kpi: [],
        modules: {
          docs: spec.modules,
          tasks: spec.modules.map((title) => ({ id: id(), title, done: false })),
          ideas: [],
          financeNotes: [],
          team: [],
          marketing: [],
          sales: [],
          files: [],
          changelog: [{ at: t, text: "Created as Career venture" }],
        },
        diary: [],
      });
    }
  }

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

  store.taskCategories = (store.taskCategories ?? []).map((c, i) => ({
    ...c,
    order: c.order ?? i + 1,
    archived: Boolean(c.archived),
  }));

  store.dayTasks = (store.dayTasks ?? []).map((t) => ({
    ...t,
    priority: t.priority ?? "should",
  }));

  // v8/v9: ensure workPlans array + modules from milestones
  if (!store.workPlans) store.workPlans = [];
  for (const wp of store.workPlans) {
    if (!wp.phases) wp.phases = [];
    for (const ph of wp.phases) {
      if (!ph.objectives) ph.objectives = [];
      if (!ph.modules) ph.modules = [];
      if (ph.modules.length === 0 && ph.milestones?.length) {
        ph.modules = ph.milestones.map((m) => ({ ...m }));
      }
      if (!ph.milestones) ph.milestones = ph.modules;
      else if (ph.modules.length && !ph.milestones.length) ph.milestones = ph.modules;
    }
    if (wp.ownerType === "goal") {
      const g = store.goals.find((x) => x.id === wp.ownerId);
      if (g && !g.workPlanId) g.workPlanId = wp.id;
    } else if (wp.ownerType === "project") {
      const p = store.projects.find((x) => x.id === wp.ownerId);
      if (p && !p.workPlanId) p.workPlanId = wp.id;
    }
  }

  // Strip emoji from sphere display names is UI-only; keep stored data.
  store.version = CURRENT_VERSION;
  return store;
}

export { defaultSettings, CURRENT_VERSION };
