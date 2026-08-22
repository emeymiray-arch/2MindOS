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

function month(
  title: string,
  order: number,
  modules: PlanModule[],
  range: { start: string; end: string }
): PlanPhase {
  return {
    id: id(),
    title,
    order,
    status: order === 1 ? "active" : "planned",
    durationWeeks: 4,
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

/** Health recovery — one goal, plan split by month (6 months). */
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
    month(
      "Месяц 1 — Диагностика и дефициты",
      1,
      [
        topic("Анализы", 1, m1),
        topic("Консультация терапевта", 2, m1),
        topic("Эндокринолог", 3, m1),
        topic("Выявление дефицитов", 4, m1),
        topic("Составление схемы восполнения", 5, m1),
        topic("Начало восполнения дефицитов", 6, m1),
      ],
      m1
    ),
    month(
      "Месяц 2 — Волосы",
      2,
      [
        topic("Трихолог", 1, m2),
        topic("Диагностика причин", 2, m2),
        topic("Необходимые дополнительные анализы", 3, m2),
        topic("Лечение", 4, m2),
        topic("Уход", 5, m2),
        topic("Начало полноценного курса восстановления волос", 6, m2),
      ],
      m2
    ),
    month(
      "Месяц 3 — Зубы",
      3,
      [
        topic("Стоматолог", 1, m3),
        topic("Диагностика", 2, m3),
        topic("Лечение", 3, m3),
        topic("Профессиональная чистка", 4, m3),
        topic("Ортодонт", 5, m3),
        topic("Подготовка к брекетам", 6, m3),
        topic("Брекеты", 7, m3),
      ],
      m3
    ),
    month(
      "Месяц 4 — Психическое здоровье",
      4,
      [
        topic("Психиатр", 1, m4),
        topic("Диагностика", 2, m4),
        topic("План лечения", 3, m4),
        topic("Психотерапия — если понадобится", 4, m4),
        topic("Начало назначенного лечения", 5, m4),
      ],
      m4
    ),
    month(
      "Месяц 5 — Закрепление",
      5,
      [
        topic("Продолжение восполнения дефицитов", 1, m5),
        topic("Продолжение лечения волос", 2, m5),
        topic("Продолжение стоматологического / ортодонтического лечения", 3, m5),
        topic("Контроль назначений врачей", 4, m5),
      ],
      m5
    ),
    month(
      "Месяц 6 — Контроль",
      6,
      [
        topic("Повторные анализы по показаниям", 1, m6),
        topic("Контроль дефицитов", 2, m6),
        topic("Контроль волос", 3, m6),
        topic("Контроль зубов", 4, m6),
        topic("Контроль психического состояния", 5, m6),
        topic("Финальная оценка результатов", 6, m6),
      ],
      m6
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
