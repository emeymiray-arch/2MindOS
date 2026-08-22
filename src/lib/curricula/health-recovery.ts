import { id } from "../id";
import type { PlanModule, PlanPhase, WorkPlan } from "../types";
import { createWorkPlan } from "../lifeos";

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
