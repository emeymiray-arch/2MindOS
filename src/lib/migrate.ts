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
import { ensureDirectionCatalog, ensurePeriodFocus } from "./directions";
import { splitHealthRecoveryGoals } from "./curricula/health-recovery";
import { ensureDigitalSecurityGoal } from "./curricula/digital-security";
import { ensureDigitalErasureGoal } from "./curricula/digital-erasure";
import {
  bucketForHorizonStage,
  currentHorizonStage,
  effectiveHorizonStage,
  ensurePlanHasOpenModule,
  normalizePlanCalendar,
} from "./plan-calendar";
import { randomBytes } from "crypto";

const CURRENT_VERSION = 20;

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
    onboardingDone: false,
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
  if (!store.periodFocus) store.periodFocus = [];
  if (!store.principles) store.principles = [];
  if (!store.outcomes) store.outcomes = [];
  if (!store.reviews) store.reviews = [];
  if (!store.captures) store.captures = [];

  store.settings = defaultSettings(store.settings as Partial<AppSettings>);
  if (store.settings.dailyCapacity == null) store.settings.dailyCapacity = 6;
  if (store.settings.visionNote == null) store.settings.visionNote = "";

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
      salary: 0,
      cushion: 0,
      debts: 0,
      currency: "₽",
      subscriptions: [],
      goals: [],
      transactions: [],
    };
  }
  if (!store.finance.transactions) store.finance.transactions = [];
  if (store.finance.mandatoryMonth == null) store.finance.mandatoryMonth = 0;
  if (store.finance.salary == null || !Number.isFinite(store.finance.salary)) {
    store.finance.salary = 0;
  }
  if (store.finance.cushionManual == null) store.finance.cushionManual = false;
  if (
    !store.finance.currency ||
    store.finance.currency === "RUB" ||
    store.finance.currency === "rub"
  ) {
    store.finance.currency = "₽";
  }

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

  // v10: time tracking + quest gamification
  if (!store.timeEntries) store.timeEntries = [];
  if (!store.quests) store.quests = [];
  if (!store.playerProfile) {
    store.playerProfile = {
      totalXp: 0,
      level: 1,
      streakDays: 0,
      todayXp: 0,
      todayFocusMinutes: 0,
    };
  }
  if (store.settings.dailyCapacityMinutes == null) {
    store.settings.dailyCapacityMinutes = (store.settings.dailyCapacity ?? 6) * 45;
  }

  // v11: backfill wish purchase dates for archive timeline
  if ((store.version ?? 0) < 11) {
    for (const block of store.wishBlocks ?? []) {
      for (const item of block.items ?? []) {
        if (item.done && !item.doneAt) {
          item.doneAt = block.createdAt;
        }
      }
    }
  }

  // v12: health recovery → 3 goals (foundation / development / later), plan per 2 months
  if ((store.version ?? 0) < 12) {
    splitHealthRecoveryGoals(store);
  }

  // v13: digital security & OSINT curriculum (foundation, 16 stages)
  if ((store.version ?? 0) < 13) {
    ensureDigitalSecurityGoal(store);
  }

  // v14: salary field + currency symbol + buckets vs horizon stages
  if ((store.version ?? 0) < 14) {
    if (store.finance) {
      if (store.finance.salary == null) store.finance.salary = 0;
      if (
        !store.finance.currency ||
        store.finance.currency === "RUB" ||
        store.finance.currency === "rub"
      ) {
        store.finance.currency = "₽";
      }
    }
    const cur = currentHorizonStage(store);
    for (const g of store.goals ?? []) {
      if (g.horizonStage != null || g.bucket) {
        g.bucket = bucketForHorizonStage(effectiveHorizonStage(g), cur);
      }
    }
  }

  // v15: wishlist prices + derived placement + cushion mode
  if ((store.version ?? 0) < 15) {
    if (store.finance) {
      if (store.finance.cushionManual == null) store.finance.cushionManual = false;
      if (!store.finance.cushionManual) {
        store.finance.cushion = (store.finance.transactions ?? [])
          .filter((t) => !t.archived && t.type === "savings")
          .reduce((a, t) => a + t.amount, 0);
      }
    }
    const savedByItem = new Map<string, number>();
    for (const t of store.finance?.transactions ?? []) {
      if (t.archived || t.type !== "savings" || !t.wishItemId) continue;
      savedByItem.set(t.wishItemId, (savedByItem.get(t.wishItemId) ?? 0) + t.amount);
    }
    for (const b of store.wishBlocks ?? []) {
      for (const item of b.items ?? []) {
        if (item.savedToward == null) item.savedToward = savedByItem.get(item.id) ?? 0;
      }
    }
    const cur = currentHorizonStage(store);
    for (const g of store.goals ?? []) {
      g.bucket = bucketForHorizonStage(effectiveHorizonStage(g), cur);
    }
    for (const t of store.dayTasks ?? []) {
      if (t.autoSource?.startsWith("project:") && !t.done) t.archived = true;
    }
  }

  // v16: empty plans get first module; curricula get horizonStage
  if ((store.version ?? 0) < 16) {
    for (const wp of store.workPlans ?? []) {
      if (wp.status === "archived") continue;
      normalizePlanCalendar(wp, store);
      ensurePlanHasOpenModule(wp, store);
    }
    const cur = currentHorizonStage(store);
    for (const g of store.goals ?? []) {
      if (g.horizonStage == null) {
        g.horizonStage = effectiveHorizonStage(g);
      }
      g.bucket = bucketForHorizonStage(effectiveHorizonStage(g), cur);
    }
  }

  // v17: checklist «Удаление себя из интернета» (10 этапов / 4 фазы)
  if ((store.version ?? 0) < 17) {
    ensureDigitalErasureGoal(store);
  }

  // v18: local-first — dedupe erasure goals; keep the richer plan
  if ((store.version ?? 0) < 18) {
    const erasure = (store.goals ?? []).filter(
      (g) => !g.archived && /удал.*интернет/i.test(g.title)
    );
    if (erasure.length > 1) {
      const scored = erasure.map((g) => {
        const wp = store.workPlans?.find((p) => p.id === g.workPlanId);
        const modules =
          wp?.phases?.reduce((n, ph) => n + (ph.modules?.length ?? 0), 0) ?? 0;
        return { g, modules, stages: wp?.phases?.length ?? 0 };
      });
      scored.sort((a, b) => b.modules - a.modules || b.stages - a.stages);
      const keep = scored[0]?.g;
      for (const row of scored.slice(1)) {
        row.g.archived = true;
        row.g.active = false;
        row.g.status = "archived";
        if (row.g.workPlanId) {
          const wp = store.workPlans?.find((p) => p.id === row.g.workPlanId);
          if (wp) wp.status = "archived";
        }
      }
      if (keep) {
        keep.title = "Удаление себя из интернета";
        keep.active = true;
        keep.archived = false;
        keep.status = "active";
      }
    }
  }

  // v19: life-system — directions catalog + period focus
  if ((store.version ?? 0) < 19) {
    ensureDirectionCatalog(store);
    ensurePeriodFocus(store);
  }

  // v20: Dark Glass HUD default theme
  if ((store.version ?? 0) < 20) {
    store.settings.theme = "dark";
  }

  store.version = CURRENT_VERSION;
  return store;
}

export { defaultSettings, CURRENT_VERSION };
