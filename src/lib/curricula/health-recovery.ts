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

function stage(
  title: string,
  order: number,
  modules: PlanModule[],
  range: { start: string; end: string; weeks?: number }
): PlanPhase {
  return {
    id: id(),
    title,
    order,
    status: order === 1 ? "active" : "planned",
    durationWeeks: range.weeks,
    deadlineStart: range.start,
    deadlineEnd: range.end,
    objectives: [],
    modules,
    progress: 0,
  };
}

export const HEALTH_RECOVERY_META = {
  label: "Общее восстановление здоровья",
  window: "22 августа 2026 → 21 февраля 2027 · 6 месяцев · 3 фазы",
  start: "2026-08-22",
  end: "2027-02-21",
} as const;

/** Health recovery — 3 phases × 2 months. */
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

  const phases: PlanPhase[] = [
    stage(
      "Фаза 1 · Месяцы 1–2 · Диагностика и волосы",
      1,
      [
        topic("М1 · Анализы", 1, m1),
        topic("М1 · Консультация терапевта", 2, m1),
        topic("М1 · Эндокринолог", 3, m1),
        topic("М1 · Выявление дефицитов", 4, m1),
        topic("М1 · Составление схемы восполнения", 5, m1),
        topic("М1 · Начало восполнения дефицитов", 6, m1),
        topic("М2 · Трихолог", 7, m2),
        topic("М2 · Диагностика причин (волосы)", 8, m2),
        topic("М2 · Необходимые дополнительные анализы", 9, m2),
        topic("М2 · Лечение волос", 10, m2),
        topic("М2 · Уход", 11, m2),
        topic("М2 · Начало курса восстановления волос", 12, m2),
      ],
      { start: m1.start, end: m2.end, weeks: 8 }
    ),
    stage(
      "Фаза 2 · Месяцы 3–4 · Зубы и психика",
      2,
      [
        topic("М3 · Стоматолог", 1, m3),
        topic("М3 · Диагностика (зубы)", 2, m3),
        topic("М3 · Лечение", 3, m3),
        topic("М3 · Профессиональная чистка", 4, m3),
        topic("М3 · Ортодонт", 5, m3),
        topic("М3 · Подготовка к брекетам", 6, m3),
        topic("М3 · Брекеты", 7, m3),
        topic("М4 · Психиатр", 8, m4),
        topic("М4 · Диагностика (психика)", 9, m4),
        topic("М4 · План лечения", 10, m4),
        topic("М4 · Психотерапия — если понадобится", 11, m4),
        topic("М4 · Начало назначенного лечения", 12, m4),
      ],
      { start: m3.start, end: m4.end, weeks: 8 }
    ),
    stage(
      "Фаза 3 · Месяцы 5–6 · Закрепление и контроль",
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
      { start: m5.start, end: m6.end, weeks: 8 }
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
