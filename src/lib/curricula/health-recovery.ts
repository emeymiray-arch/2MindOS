import { id, now } from "../id";
import type { Goal, GoalStage, LifeStore, PlanBucket, PlanModule, PlanPhase, WorkPlan } from "../types";
import { createWorkPlan, ensureActivePlan } from "../lifeos";

function topic(
  title: string,
  order: number,
  range?: { start: string; end: string }
): PlanModule {
  return {
    id: id(),
    title,
    done: false,
    order,
    deadlineStart: range?.start,
    deadlineEnd: range?.end,
  };
}

function phase(
  title: string,
  order: number,
  modules: PlanModule[],
  range: { start: string; end: string },
  durationWeeks = 8
): PlanPhase {
  return {
    id: id(),
    title,
    order,
    status: order === 1 ? "active" : "planned",
    durationWeeks,
    deadlineStart: range.start,
    deadlineEnd: range.end,
    objectives: [],
    modules,
    progress: 0,
  };
}

export const HEALTH_RECOVERY_META = {
  label: "Общее восстановление здоровья",
  window: "22 августа 2026 → 21 февраля 2027 · 6 месяцев",
  start: "2026-08-22",
  end: "2027-02-21",
} as const;

/** Health recovery — one goal, 3 phases × 2 months each. */
export function buildHealthRecoveryPlan(owner: {
  ownerType: "goal" | "project";
  ownerId: string;
}): WorkPlan {
  const m1 = { start: "2026-08-22", end: "2026-09-21" };
  const m2 = { start: "2026-09-22", end: "2026-10-21" };
  const m3 = { start: "2026-10-22", end: "2026-11-21" };
  const m4 = { start: "2026-11-22", end: "2026-12-21" };
  const m5 = { start: "2026-12-22", end: "2027-01-21" };
  const m6 = { start: "2027-01-22", end: "2027-02-21" };

  const phase1 = { start: "2026-08-22", end: "2026-10-21" };
  const phase2 = { start: "2026-10-22", end: "2026-12-21" };
  const phase3 = { start: "2026-12-22", end: "2027-02-21" };

  const phases: PlanPhase[] = [
    phase(
      "Фаза 1 · Месяцы 1–2",
      1,
      [
        topic("М1 · Анализы", 1, m1),
        topic("М1 · Консультация терапевта", 2, m1),
        topic("М1 · Эндокринолог", 3, m1),
        topic("М1 · Выявление дефицитов", 4, m1),
        topic("М1 · Составление схемы восполнения", 5, m1),
        topic("М1 · Начало восполнения дефицитов", 6, m1),
        topic("М2 · Трихолог", 7, m2),
        topic("М2 · Диагностика причин", 8, m2),
        topic("М2 · Необходимые дополнительные анализы", 9, m2),
        topic("М2 · Лечение", 10, m2),
        topic("М2 · Уход", 11, m2),
        topic("М2 · Начало полноценного курса восстановления волос", 12, m2),
      ],
      phase1
    ),
    phase(
      "Фаза 2 · Месяцы 3–4",
      2,
      [
        topic("М3 · Стоматолог", 1, m3),
        topic("М3 · Диагностика", 2, m3),
        topic("М3 · Лечение", 3, m3),
        topic("М3 · Профессиональная чистка", 4, m3),
        topic("М3 · Ортодонт", 5, m3),
        topic("М3 · Подготовка к брекетам", 6, m3),
        topic("М3 · Брекеты", 7, m3),
        topic("М4 · Психиатр", 8, m4),
        topic("М4 · Диагностика", 9, m4),
        topic("М4 · План лечения", 10, m4),
        topic("М4 · Психотерапия — если понадобится", 11, m4),
        topic("М4 · Начало назначенного лечения", 12, m4),
      ],
      phase2
    ),
    phase(
      "Фаза 3 · Месяцы 5–6",
      3,
      [
        topic("М5 · Продолжение восполнения дефицитов", 1, m5),
        topic("М5 · Продолжение лечения волос", 2, m5),
        topic("М5 · Продолжение стоматологического / ортодонтического лечения", 3, m5),
        topic("М5 · Контроль назначений врачей", 4, m5),
        topic("М6 · Повторные анализы по показаниям", 5, m6),
        topic("М6 · Контроль дефицитов", 6, m6),
        topic("М6 · Контроль волос", 7, m6),
        topic("М6 · Контроль зубов", 8, m6),
        topic("М6 · Контроль психического состояния", 9, m6),
        topic("М6 · Финальная оценка результатов", 10, m6),
      ],
      phase3
    ),
  ];

  return createWorkPlan({
    ownerType: owner.ownerType,
    ownerId: owner.ownerId,
    title: HEALTH_RECOVERY_META.label,
    deadline: HEALTH_RECOVERY_META.end,
    phases,
  });
}

export const HEALTH_PHASE_BUCKETS: {
  index: 1 | 2 | 3;
  bucket: PlanBucket;
  goalTitle: string;
  phaseTitle: string;
}[] = [
  { index: 1, bucket: "foundation", goalTitle: "Общее восстановление · М1–2", phaseTitle: "Месяцы 1–2" },
  { index: 2, bucket: "development", goalTitle: "Общее восстановление · М3–4", phaseTitle: "Месяцы 3–4" },
  { index: 3, bucket: "later", goalTitle: "Общее восстановление · М5–6", phaseTitle: "Месяцы 5–6" },
];

function mergeModuleProgress(source: PlanModule[], template: PlanModule[]): PlanModule[] {
  const byTitle = new Map(source.map((m) => [m.title, m]));
  return template.map((m) => {
    const hit = byTitle.get(m.title);
    if (!hit) return m;
    return {
      ...m,
      done: hit.done,
      understanding: hit.understanding,
    };
  });
}

/** One goal = one phase = plan scoped to its months only. */
export function buildHealthRecoveryPhasePlan(
  phaseIndex: 1 | 2 | 3,
  owner: { ownerType: "goal" | "project"; ownerId: string },
  existingModules?: PlanModule[]
): WorkPlan {
  const meta = HEALTH_PHASE_BUCKETS[phaseIndex - 1];
  const full = buildHealthRecoveryPlan(owner);
  const src = full.phases[phaseIndex - 1];
  const modules = existingModules?.length
    ? mergeModuleProgress(existingModules, src.modules)
    : src.modules;
  const phase: PlanPhase = {
    ...src,
    title: meta.phaseTitle,
    status: phaseIndex === 1 ? "active" : "planned",
    modules,
    milestones: modules,
  };
  return createWorkPlan({
    ownerType: owner.ownerType,
    ownerId: owner.ownerId,
    title: meta.goalTitle,
    deadline: src.deadlineEnd,
    phases: [phase],
  });
}

function singleStage(title: string, range: { start: string; end: string }): GoalStage {
  return {
    id: id(),
    title,
    done: false,
    order: 1,
    status: "active",
    deadlineStart: range.start,
    deadlineEnd: range.end,
    progress: 0,
  };
}

/** Split combined health goal into 3 goals — one per plan bucket / 2-month window. */
export function splitHealthRecoveryGoals(store: LifeStore): boolean {
  if (store.goals.some((g) => g.title === "Общее восстановление · М3–4")) return false;

  const main = store.goals.find(
    (g) =>
      g.active &&
      !g.archived &&
      (/^Общее восстановление здоровья$/i.test(g.title) ||
        g.title === "Общее восстановление · М1–2")
  );
  if (!main) return false;

  const wp = store.workPlans?.find((p) => p.id === main.workPlanId);
  const sortedPhases = [...(wp?.phases ?? [])].sort((a, b) => a.order - b.order);
  const healthArea =
    store.spheres.find((s) => s.slug === "health") ??
    store.spheres.find((s) => /здоров/i.test(s.name));

  const plan = ensureActivePlan(store);
  const t = now();

  // Phase 1 — update existing goal
  main.title = HEALTH_PHASE_BUCKETS[0].goalTitle;
  main.bucket = "foundation";
  main.stages = [singleStage(HEALTH_PHASE_BUCKETS[0].phaseTitle, { start: "2026-08-22", end: "2026-10-21" })];

  if (wp && sortedPhases[0]) {
    const modules = mergeModuleProgress(
      sortedPhases[0].modules ?? sortedPhases[0].milestones ?? [],
      sortedPhases[0].modules ?? []
    );
    wp.title = HEALTH_PHASE_BUCKETS[0].goalTitle;
    wp.phases = [{ ...sortedPhases[0], title: HEALTH_PHASE_BUCKETS[0].phaseTitle, modules, milestones: modules }];
    wp.deadline = "2026-10-21";
    wp.updatedAt = t;
  } else {
    const created = buildHealthRecoveryPhasePlan(1, { ownerType: "goal", ownerId: main.id });
    store.workPlans.push(created);
    main.workPlanId = created.id;
  }

  // Phases 2 & 3 — new goals
  for (const meta of HEALTH_PHASE_BUCKETS.slice(1)) {
    const srcPhase = sortedPhases[meta.index - 1];
    const nodeId = id();
    const goalId = id();
    store.nodes.unshift({
      id: nodeId,
      kind: "goal",
      title: meta.goalTitle,
      metadata: {},
      salience: 0.85,
      createdAt: t,
      updatedAt: t,
      sphereId: healthArea?.id,
    });

    const range =
      meta.index === 2
        ? { start: "2026-10-22", end: "2026-12-21" }
        : { start: "2026-12-22", end: "2027-02-21" };

    const goal: Goal = {
      id: goalId,
      nodeId,
      title: meta.goalTitle,
      stages: [singleStage(meta.phaseTitle, range)],
      progress: 0,
      active: true,
      archived: false,
      createdAt: t,
      lifeAreaId: healthArea?.id,
      planId: plan.id,
      priority: "critical",
      status: "active",
      bucket: meta.bucket,
      deadline: range.end,
    };

    const phasePlan = buildHealthRecoveryPhasePlan(
      meta.index,
      { ownerType: "goal", ownerId: goalId },
      srcPhase?.modules ?? srcPhase?.milestones
    );
    store.workPlans.push(phasePlan);
    goal.workPlanId = phasePlan.id;
    store.goals.push(goal);
  }

  return true;
}
