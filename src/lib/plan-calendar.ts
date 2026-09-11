/**
 * Calendar backbone for 2Mind OS v2:
 *   Фаза  = 6 months (3 этапа)
 *   Этап  = 2 months (PlanPhase, durationWeeks ≈ 8)
 *   Шаг   = PlanModule inside этап
 *
 * Completing a step unlocks the next incomplete step as today's task.
 */
import { id, todayKey } from "./id";
import {
  activePlan,
  ensurePhaseModules,
  findWorkPlan,
  ownerOfWorkPlan,
  phasesOf,
  syncWorkPlanProgress,
} from "./lifeos";
import { ensureDayTask } from "./tasks";
import type { Goal, LifeStore, PlanBucket, PlanModule, PlanPhase, WorkPlan } from "./types";

export const STAGE_WEEKS = 8; // ~2 months
export const STAGES_PER_PHASE = 3; // 6 months
export const PHASE_WEEKS = STAGE_WEEKS * STAGES_PER_PHASE;

export function addDays(iso: string, days: number): string {
  const d = new Date(iso.slice(0, 10) + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function addMonths(iso: string, months: number): string {
  const d = new Date(iso.slice(0, 10) + "T12:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** Which 6-month фаза (1-based) a stage order belongs to. */
export function phaseNumberForStageOrder(order: number): number {
  return Math.floor((Math.max(1, order) - 1) / STAGES_PER_PHASE) + 1;
}

/** Index of этап inside its фаза (0..2). */
export function stageIndexInPhase(order: number): number {
  return (Math.max(1, order) - 1) % STAGES_PER_PHASE;
}

export function phaseLabel(phaseNum: number): string {
  return `Фаза ${phaseNum}`;
}

export function stageWindow(
  planStart: string,
  stageOrder: number
): { start: string; end: string } {
  const offsetMonths = (stageOrder - 1) * 2;
  const start = addMonths(planStart, offsetMonths);
  const end = addDays(addMonths(start, 2), -1);
  return { start, end };
}

/** Apply 2-month calendar to a stage by its order. */
export function scheduleStage(
  phase: PlanPhase,
  planStart: string,
  order: number
): void {
  const { start, end } = stageWindow(planStart, order);
  phase.order = order;
  phase.durationWeeks = STAGE_WEEKS;
  if (!phase.deadlineStart) phase.deadlineStart = start;
  if (!phase.deadlineEnd) phase.deadlineEnd = end;
  const pNum = phaseNumberForStageOrder(order);
  const sIdx = stageIndexInPhase(order) + 1;
  // Keep user title if custom; otherwise stamp structure
  if (!phase.title?.trim() || /^этап\s*\d+/i.test(phase.title) || /^фаза\s*\d+/i.test(phase.title)) {
    phase.title = `${phaseLabel(pNum)} · Этап ${sIdx}`;
  }
}

export function planStartDate(plan: WorkPlan, store?: LifeStore): string {
  if (plan.ownerType === "goal" && store) {
    const g = store.goals.find((x) => x.id === plan.ownerId);
    if (g) {
      const slot = effectiveHorizonStage(g);
      const horizon = horizonAnchor(store);
      return stageWindow(horizon, slot).start;
    }
  }
  const first = phasesOf(plan).sort((a, b) => a.order - b.order)[0];
  if (first?.deadlineStart) return first.deadlineStart;
  return plan.createdAt.slice(0, 10);
}

/** Life-horizon anchor (active SixMonthPlan start, else today). */
export function horizonAnchor(store: LifeStore): string {
  return activePlan(store)?.startDate?.slice(0, 10) || todayKey();
}

/** Map legacy bucket → этап if horizonStage missing. */
export function effectiveHorizonStage(goal: Goal): number {
  if (goal.horizonStage != null && goal.horizonStage >= 1) {
    return Math.floor(goal.horizonStage);
  }
  if (goal.bucket === "foundation") return 1;
  if (goal.bucket === "later") return 3;
  return 2;
}

/** Map absolute horizon stage → legacy 3-bucket. Stages in the current
 * 6-month фаза stay foundation/development; only future фазы → later. */
export function bucketForHorizonStage(stage: number, currentStage = 1): PlanBucket {
  const s = Math.max(1, Math.floor(stage));
  const cur = Math.max(1, Math.floor(currentStage));
  const stagePhase = Math.ceil(s / STAGES_PER_PHASE);
  const curPhase = Math.ceil(cur / STAGES_PER_PHASE);
  if (stagePhase > curPhase) return "later";
  if (stagePhase < curPhase) return "foundation";
  const idx = ((s - 1) % STAGES_PER_PHASE) + 1;
  if (idx === 1) return "foundation";
  if (idx === 2) return "development";
  return "development";
}

export function goalsInDerivedBucket(
  store: LifeStore,
  bucket: PlanBucket,
  asOf = todayKey()
): Goal[] {
  const plan = activePlan(store);
  const cur = currentHorizonStage(store, asOf);
  return (store.goals ?? []).filter((g) => {
    if (g.archived || !g.active) return false;
    if (plan && g.planId && g.planId !== plan.id) return false;
    return bucketForHorizonStage(effectiveHorizonStage(g), cur) === bucket;
  });
}

/** «Этап 1» */
export function horizonStageLabel(order: number): string {
  return `Этап ${Math.max(1, order)}`;
}

export function horizonStageShort(order: number): string {
  return horizonStageLabel(order);
}

/** Which 2-month этап of the life horizon is current by calendar. */
export function currentHorizonStage(store: LifeStore, asOf = todayKey()): number {
  const start = horizonAnchor(store);
  const months =
    (new Date(asOf.slice(0, 10) + "T12:00:00").getFullYear() -
      new Date(start + "T12:00:00").getFullYear()) *
      12 +
    (new Date(asOf.slice(0, 10) + "T12:00:00").getMonth() -
      new Date(start + "T12:00:00").getMonth());
  return Math.max(1, Math.floor(Math.max(0, months) / 2) + 1);
}

/** Current 6-month фаза (1-based). */
export function currentDiaryPhase(store: LifeStore, asOf = todayKey()): number {
  return phaseNumberForStageOrder(currentHorizonStage(store, asOf));
}

export type DiaryStageTab = {
  order: number;
  indexInPhase: number; // 1..3
  label: string;
  start: string;
  end: string;
  current: boolean;
};

/** Three 2-month diaries inside a 6-month фаза. */
export function diaryStagesForPhase(
  store: LifeStore,
  phaseNum: number,
  asOf = todayKey()
): DiaryStageTab[] {
  const anchor = horizonAnchor(store);
  const cur = currentHorizonStage(store, asOf);
  const base = (Math.max(1, phaseNum) - 1) * STAGES_PER_PHASE;
  return [1, 2, 3].map((idx) => {
    const order = base + idx;
    const { start, end } = stageWindow(anchor, order);
    return {
      order,
      indexInPhase: idx,
      label: horizonStageLabel(order),
      start,
      end,
      current: order === cur,
    };
  });
}

export function goalsInDiaryStage(goals: Goal[], stageOrder: number): Goal[] {
  return goals.filter((g) => effectiveHorizonStage(g) === stageOrder);
}

export type HorizonStageGroup = {
  order: number;
  label: string;
  short: string;
  start: string;
  end: string;
  current: boolean;
  goals: Goal[];
};

/** Group goals into 2-month horizon stages for the Goals page. */
export function groupGoalsByHorizonStage(
  store: LifeStore,
  goals: Goal[],
  asOf = todayKey()
): HorizonStageGroup[] {
  const anchor = horizonAnchor(store);
  const current = currentHorizonStage(store, asOf);
  const byOrder = new Map<number, Goal[]>();
  let maxOrder = Math.max(3, current);

  for (const g of goals) {
    const order = effectiveHorizonStage(g);
    maxOrder = Math.max(maxOrder, order);
    if (!byOrder.has(order)) byOrder.set(order, []);
    byOrder.get(order)!.push(g);
  }

  const groups: HorizonStageGroup[] = [];
  for (let order = 1; order <= maxOrder; order++) {
    const { start, end } = stageWindow(anchor, order);
    groups.push({
      order,
      label: horizonStageLabel(order),
      short: horizonStageShort(order),
      start,
      end,
      current: order === current,
      goals: byOrder.get(order) ?? [],
    });
  }
  return groups;
}

/** Reschedule all stages on a 2-month grid from plan start. */
export function rescheduleAllStages(plan: WorkPlan, store?: LifeStore): void {
  const start = planStartDate(plan, store);
  const sorted = phasesOf(plan).sort((a, b) => a.order - b.order);
  sorted.forEach((ph, i) => {
    const order = i + 1;
    ph.order = order;
    const { start: s, end } = stageWindow(start, order);
    ph.durationWeeks = STAGE_WEEKS;
    ph.deadlineStart = s;
    ph.deadlineEnd = end;
  });
}

export type PhaseGroup = {
  phaseNum: number;
  label: string;
  start?: string;
  end?: string;
  stages: PlanPhase[];
  progress: number;
};

export function groupStagesIntoPhases(plan: WorkPlan): PhaseGroup[] {
  const sorted = phasesOf(plan).sort((a, b) => a.order - b.order);
  const map = new Map<number, PlanPhase[]>();
  for (const st of sorted) {
    const n = phaseNumberForStageOrder(st.order);
    if (!map.has(n)) map.set(n, []);
    map.get(n)!.push(st);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([phaseNum, stages]) => {
      const starts = stages.map((s) => s.deadlineStart).filter(Boolean) as string[];
      const ends = stages.map((s) => s.deadlineEnd).filter(Boolean) as string[];
      let score = 0;
      let weight = 0;
      for (const st of stages) {
        const mods = ensurePhaseModules(st);
        if (mods.length) {
          weight += mods.length;
          score += mods.filter((m) => m.done).length;
        } else {
          weight += 1;
          score += st.status === "done" || (st.progress ?? 0) >= 100 ? 1 : 0;
        }
      }
      return {
        phaseNum,
        label: phaseLabel(phaseNum),
        start: starts.sort()[0],
        end: ends.sort().slice(-1)[0],
        stages,
        progress: weight ? Math.round((score / weight) * 100) : 0,
      };
    });
}

/** First incomplete step across the plan (sequential). */
export function nextOpenStep(
  plan: WorkPlan
): { stage: PlanPhase; module: PlanModule } | null {
  const stages = phasesOf(plan).sort((a, b) => a.order - b.order);
  for (const stage of stages) {
    if (stage.archived) continue;
    const title = stage.title.trim().toLowerCase();
    if (title === "недели" || title === "weeks") continue;
    const mods = ensurePhaseModules(stage).sort((a, b) => a.order - b.order);
    if (!mods.length) continue;
    const open = mods.find((m) => !m.done);
    if (open) return { stage, module: open };
  }
  return null;
}

function topicAutoSource(
  plan: WorkPlan,
  owner: ReturnType<typeof ownerOfWorkPlan>,
  moduleId: string
): string {
  if (owner.goal) return `goal:${owner.goal.id}:topic:${moduleId}`;
  if (owner.project) return `project:${owner.project.id}:topic:${moduleId}`;
  return `${plan.ownerType}:${plan.ownerId}:topic:${moduleId}`;
}

function cleanStepTitle(raw: string, fallback: string): string {
  const t = raw
    .replace(/^м\d+\s*·\s*/i, "")
    .replace(/^неделя\s+\d+\s*·\s*/i, "")
    .trim();
  return t || fallback;
}

/** Put the current/next plan step onto today's task list. */
export function unlockNextPlanStep(
  store: LifeStore,
  planId: string,
  date = todayKey()
): boolean {
  const plan = findWorkPlan(store, planId);
  if (!plan || plan.status === "archived") return false;
  // Projects stay in the data model but do not auto-land on Главная.
  if (plan.ownerType === "project") return false;

  // If today's open-looking task is already done for the "next" module, mark module done and continue.
  let guard = 0;
  while (guard++ < 40) {
    const next = nextOpenStep(plan);
    if (!next) return false;

    const owner = ownerOfWorkPlan(store, plan);
    const source = topicAutoSource(plan, owner, next.module.id);

    const existing = (store.dayTasks ?? []).find(
      (t) =>
        t.date === date &&
        !t.archived &&
        (t.milestoneId === next.module.id || t.autoSource === source)
    );

    if (existing && !existing.done) {
      // Already the active today step
      for (const ph of phasesOf(plan)) {
        if (ph.id === next.stage.id) ph.status = "active";
        else if (ph.status === "active" && ph.id !== next.stage.id) ph.status = "planned";
      }
      syncWorkPlanProgress(store, plan);
      return false;
    }

    if (existing && existing.done) {
      // Sync module + look for the real next step
      next.module.done = true;
      syncWorkPlanProgress(store, plan);
      existing.archived = true;
      continue;
    }

    // Archive other auto topics for same owner today so only current step shows
    const prefix = owner.goal
      ? `goal:${owner.goal.id}:topic:`
      : owner.project
        ? `project:${owner.project.id}:topic:`
        : null;
    if (prefix) {
      for (const t of store.dayTasks ?? []) {
        if (
          t.date === date &&
          !t.archived &&
          !t.done &&
          t.autoSource?.startsWith(prefix) &&
          t.milestoneId !== next.module.id
        ) {
          t.archived = true;
        }
      }
    }

    ensureDayTask(store, {
      date,
      title: cleanStepTitle(next.module.title, owner.title),
      done: false,
      autoSource: source,
      goalId: owner.goal?.id,
      goalTitle: owner.goal?.title,
      projectId: owner.project?.id,
      workPlanId: plan.id,
      stageId: next.stage.id,
      milestoneId: next.module.id,
      lifeAreaId: owner.lifeAreaId,
      priority: "must",
      deadlineStart: next.module.deadlineStart ?? next.stage.deadlineStart,
      deadlineEnd: next.module.deadlineEnd ?? next.stage.deadlineEnd,
    });

    for (const ph of phasesOf(plan)) {
      if (ph.id === next.stage.id) ph.status = "active";
      else if (ph.status === "active" && ph.id !== next.stage.id) ph.status = "planned";
    }
    syncWorkPlanProgress(store, plan);
    return true;
  }
  return false;
}

/** Scaffold first 6-month фаза = 3 × 2-month этапа. */
export function scaffoldFirstPhase(
  plan: WorkPlan,
  store: LifeStore,
  titles?: string[]
): void {
  if (phasesOf(plan).length > 0) return;
  const start = planStartDate(plan, store);
  const defaults = titles?.length
    ? titles.slice(0, STAGES_PER_PHASE)
    : ["Фундамент", "Развитие", "Закрепление"];
  while (defaults.length < STAGES_PER_PHASE) {
    defaults.push(`Этап ${defaults.length + 1}`);
  }
  for (let i = 0; i < STAGES_PER_PHASE; i++) {
    const order = i + 1;
    const { start: s, end } = stageWindow(start, order);
    const pNum = phaseNumberForStageOrder(order);
    const sIdx = stageIndexInPhase(order) + 1;
    const phaseId = id();
    const firstModule =
      i === 0
        ? [
            {
              id: id(),
              title: "Первый шаг",
              done: false,
              order: 1,
              deadlineStart: s,
              deadlineEnd: end,
            },
          ]
        : [];
    plan.phases.push({
      id: phaseId,
      title: `${phaseLabel(pNum)} · ${defaults[i] || `Этап ${sIdx}`}`,
      order,
      durationWeeks: STAGE_WEEKS,
      deadlineStart: s,
      deadlineEnd: end,
      status: i === 0 ? "active" : "planned",
      objectives: [],
      modules: firstModule,
      milestones: firstModule,
      progress: 0,
    });
  }
}

/** If every stage has zero modules, seed a workable first step. */
export function ensurePlanHasOpenModule(plan: WorkPlan, store: LifeStore): boolean {
  let stages = phasesOf(plan);
  if (!stages.length) {
    scaffoldFirstPhase(plan, store);
    return true;
  }
  const anyModule = stages.some(
    (ph) => (ph.modules?.length ?? 0) > 0 || (ph.milestones?.length ?? 0) > 0
  );
  if (anyModule) return false;
  const first = [...stages].sort((a, b) => a.order - b.order)[0];
  const mod = {
    id: id(),
    title: "Первый шаг",
    done: false,
    order: 1,
    deadlineStart: first.deadlineStart,
    deadlineEnd: first.deadlineEnd,
  };
  first.modules = [mod];
  first.milestones = [mod];
  first.status = "active";
  void store;
  return true;
}

/** Ensure plan uses 2-month stages; scaffold first 6-month фаза if empty. */
export function normalizePlanCalendar(plan: WorkPlan, store: LifeStore): void {
  const stages = phasesOf(plan);
  if (!stages.length) {
    scaffoldFirstPhase(plan, store);
    return;
  }
  const needsDates = stages.some((s) => !s.deadlineStart || !s.deadlineEnd || !s.durationWeeks);
  if (needsDates) {
    rescheduleAllStages(plan, store);
  } else {
    for (const s of stages) {
      if (!s.durationWeeks) s.durationWeeks = STAGE_WEEKS;
    }
  }
  ensurePlanHasOpenModule(plan, store);
}

