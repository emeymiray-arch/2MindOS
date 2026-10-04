import { id, todayKey } from "./id";
import type {
  LifeStore,
  PeriodFocus,
  PeriodFocusLevel,
  Sphere,
} from "./types";

/** Catalog directions — merge into vault; never wipe user custom ones. */
export const DIRECTION_CATALOG: Omit<Sphere, "id">[] = [
  {
    slug: "health",
    name: "Здоровье",
    description: "Физическое состояние, анализы, восстановление",
    priority: "critical",
    layerBias: "both",
    order: 1,
  },
  {
    slug: "body",
    name: "Тело",
    description: "Сила, подвижность, осанка, энергия",
    priority: "high",
    layerBias: "outer",
    order: 2,
  },
  {
    slug: "appearance",
    name: "Внешний образ",
    description: "Одежда, волосы, макияж, стиль",
    priority: "medium",
    layerBias: "outer",
    order: 3,
  },
  {
    slug: "speech",
    name: "Речь и коммуникация",
    description: "Голос, речь, жесты, социальные навыки",
    priority: "high",
    layerBias: "outer",
    order: 4,
  },
  {
    slug: "core",
    name: "Внутренний стержень",
    description: "Принципы, границы, дисциплина, зрелость",
    priority: "critical",
    layerBias: "inner",
    order: 5,
  },
  {
    slug: "education",
    name: "Образование и интеллект",
    description: "Учёба, навыки, мышление, знания",
    priority: "high",
    layerBias: "inner",
    order: 6,
  },
  {
    slug: "work",
    name: "Работа и развитие",
    description: "Профессия, карьера, деловые проекты",
    priority: "critical",
    layerBias: "both",
    order: 7,
  },
  {
    slug: "money",
    name: "Деньги",
    description: "Доход, подушка, траты, финансовая ясность",
    priority: "high",
    layerBias: "both",
    order: 8,
  },
  {
    slug: "relations",
    name: "Отношения",
    description: "Социальная среда, близкие, сообщество",
    priority: "medium",
    layerBias: "both",
    order: 9,
  },
  {
    slug: "personal_projects",
    name: "Личные проекты",
    description: "Свои инициативы вне основной работы",
    priority: "medium",
    layerBias: "both",
    order: 10,
  },
  {
    slug: "environment",
    name: "Среда и организация",
    description: "Дом, порядок, системы, быт",
    priority: "medium",
    layerBias: "both",
    order: 11,
  },
];

const SLUG_ALIASES: Record<string, string> = {
  career: "work",
  business: "work",
  personal: "personal_projects",
  culture: "education",
  religion: "core",
  style: "appearance",
  body_style: "body",
};

export function monthKeyFromDate(date = todayKey()): string {
  return date.slice(0, 7);
}

export function activeDirections(store: LifeStore): Sphere[] {
  return (store.spheres ?? [])
    .filter((s) => !s.archived)
    .sort((a, b) => a.order - b.order);
}

export function ensureDirectionCatalog(store: LifeStore): void {
  if (!store.spheres) store.spheres = [];

  // Rename known legacy slugs in place (keep ids so goal.lifeAreaId stays valid).
  for (const s of store.spheres) {
    const alias = SLUG_ALIASES[s.slug];
    if (!alias) continue;
    const conflict = store.spheres.find((x) => x.id !== s.id && x.slug === alias && !x.archived);
    if (conflict) {
      // Merge: retarget goals/habits to conflict, archive this.
      for (const g of store.goals ?? []) {
        if (g.lifeAreaId === s.id) g.lifeAreaId = conflict.id;
      }
      for (const h of store.habits ?? []) {
        if (h.lifeAreaId === s.id) h.lifeAreaId = conflict.id;
      }
      s.archived = true;
      continue;
    }
    const catalog = DIRECTION_CATALOG.find((c) => c.slug === alias);
    s.slug = alias;
    if (catalog) {
      s.name = catalog.name;
      s.description = catalog.description ?? s.description;
      s.layerBias = catalog.layerBias ?? s.layerBias;
      s.order = catalog.order;
      s.priority = catalog.priority ?? s.priority;
    }
  }

  for (const cat of DIRECTION_CATALOG) {
    const existing = store.spheres.find((s) => !s.archived && s.slug === cat.slug);
    if (existing) {
      // Keep id; refresh catalog labels/order (user can rename via UI later).
      existing.name = cat.name;
      existing.description = cat.description ?? existing.description;
      existing.layerBias = cat.layerBias ?? existing.layerBias;
      existing.order = cat.order;
      existing.priority = cat.priority ?? existing.priority;
      continue;
    }
    store.spheres.push({ ...cat, id: id() });
  }
}

export function findPeriodFocus(store: LifeStore, monthKey: string): PeriodFocus | undefined {
  return (store.periodFocus ?? []).find((p) => p.monthKey === monthKey);
}

export function ensurePeriodFocus(store: LifeStore, monthKey?: string): PeriodFocus {
  if (!store.periodFocus) store.periodFocus = [];
  const key = monthKey ?? monthKeyFromDate();
  let row = findPeriodFocus(store, key);
  if (!row) {
    row = {
      id: id(),
      monthKey: key,
      levels: {},
      updatedAt: new Date().toISOString(),
    };
    store.periodFocus.push(row);
  }

  const dirs = activeDirections(store);
  const activeGoals = (store.goals ?? []).filter((g) => g.active && !g.archived);
  for (const d of dirs) {
    if (row.levels[d.id]) continue;
    const linked = activeGoals.filter((g) => g.lifeAreaId === d.id);
    if (linked.some((g) => g.priority === "critical")) row.levels[d.id] = "main";
    else if (linked.some((g) => g.priority === "high") || linked.length > 0) {
      row.levels[d.id] = "support";
    } else if (d.priority === "critical") row.levels[d.id] = "support";
    else row.levels[d.id] = "background";
  }

  // Ensure at least one main.
  if (!Object.values(row.levels).includes("main") && dirs[0]) {
    row.levels[dirs[0].id] = "main";
  }

  return row;
}

export function focusLevelForDirection(
  store: LifeStore,
  directionId: string | undefined,
  monthKey?: string
): PeriodFocusLevel {
  if (!directionId) return "background";
  const focus = ensurePeriodFocus(store, monthKey);
  return focus.levels[directionId] ?? "background";
}

export function focusLevelForGoal(
  store: LifeStore,
  goalId: string,
  monthKey?: string
): PeriodFocusLevel {
  const g = store.goals.find((x) => x.id === goalId);
  return focusLevelForDirection(store, g?.lifeAreaId, monthKey);
}

/** Compose quota weight: main goals get more slots than support; background = 0 auto. */
export function composeQuotaForLevel(level: PeriodFocusLevel): number {
  if (level === "main") return 3;
  if (level === "support") return 1;
  return 0;
}

export function setFocusLevel(
  store: LifeStore,
  directionId: string,
  level: PeriodFocusLevel,
  monthKey?: string
): PeriodFocus {
  const row = ensurePeriodFocus(store, monthKey);
  row.levels[directionId] = level;
  row.updatedAt = new Date().toISOString();
  return row;
}

export function mergeDirections(
  store: LifeStore,
  keepId: string,
  absorbId: string
): boolean {
  if (keepId === absorbId) return false;
  const keep = store.spheres.find((s) => s.id === keepId);
  const absorb = store.spheres.find((s) => s.id === absorbId);
  if (!keep || !absorb) return false;
  for (const g of store.goals ?? []) {
    if (g.lifeAreaId === absorbId) g.lifeAreaId = keepId;
  }
  for (const h of store.habits ?? []) {
    if (h.lifeAreaId === absorbId) h.lifeAreaId = keepId;
  }
  for (const p of store.principles ?? []) {
    if (p.lifeAreaId === absorbId) p.lifeAreaId = keepId;
  }
  for (const o of store.outcomes ?? []) {
    if (o.lifeAreaId === absorbId) o.lifeAreaId = keepId;
  }
  for (const c of store.captures ?? []) {
    if (c.directionId === absorbId) c.directionId = keepId;
  }
  for (const pf of store.periodFocus ?? []) {
    if (pf.levels[absorbId]) {
      if (!pf.levels[keepId]) pf.levels[keepId] = pf.levels[absorbId];
      delete pf.levels[absorbId];
    }
  }
  absorb.archived = true;
  return true;
}

export type AttentionSignal = {
  kind: "behind" | "neglected" | "overload";
  text: string;
  href?: string;
};

export function buildAttentionSignals(
  store: LifeStore,
  opts: {
    behindGoalTitles: string[];
    todayTaskCount: number;
    capacity: number;
    neglectedMainNames: string[];
  }
): AttentionSignal[] {
  const out: AttentionSignal[] = [];
  for (const title of opts.behindGoalTitles.slice(0, 2)) {
    out.push({
      kind: "behind",
      text: `Отстаёт: ${title}`,
      href: "/goals",
    });
  }
  for (const name of opts.neglectedMainNames.slice(0, 1)) {
    out.push({
      kind: "neglected",
      text: `Main «${name}» без действий сегодня`,
      href: "/directions",
    });
  }
  if (opts.todayTaskCount > opts.capacity + 2) {
    out.push({
      kind: "overload",
      text: `Перегруз: ${opts.todayTaskCount} задач при ёмкости ${opts.capacity}`,
      href: "/settings",
    });
  }
  return out.slice(0, 3);
}
