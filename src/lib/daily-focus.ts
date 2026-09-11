import { findWorkPlan } from "./lifeos";
import {
  currentHorizonStage,
  effectiveHorizonStage,
  nextOpenStep,
  phaseNumberForStageOrder,
  stageIndexInPhase,
} from "./plan-calendar";
import type { Goal, LifeStore, PlanPhase, Project, WorkPlan } from "./types";

const GENERIC_TITLE =
  /^(месяцы?|недели|фаза|этап|шаги|неделя)\b|^м\d+\s*[-–]\s*\d+$/i;

/** Phase containers that are not learnable topics (e.g. week index). */
const META_PHASE_TITLES = new Set(["недели", "weeks"]);

export function isGenericPlanTitle(title: string): boolean {
  const t = title.trim();
  if (!t) return true;
  if (GENERIC_TITLE.test(t)) return true;
  if (/^фаза\s+\d+\s*·\s*этап\s*\d+$/i.test(t)) return true;
  if (/^этап\s+\d+\.?$/i.test(t)) return true;
  return false;
}

/** Strip month/week prefixes — «М1 · Анализы» → «Анализы». */
export function cleanTopicTitle(title: string): string {
  return title
    .replace(/^м\d+\s*·\s*/i, "")
    .replace(/^неделя\s+\d+\s*·\s*/i, "")
    .trim();
}

export function formatTaskTitle(topic: string, goalTitle?: string): string {
  const clean = cleanTopicTitle(topic);
  if (!clean || isGenericPlanTitle(clean)) return goalTitle?.trim() || clean || topic;
  return clean;
}

export function defaultTaskMinutes(store: LifeStore): number {
  const daily = store.settings.dailyCapacityMinutes ?? 270;
  const cap = Math.max(1, store.settings.dailyCapacity ?? 6);
  return Math.max(15, Math.round(daily / cap));
}

function isMetaPhase(phase: PlanPhase): boolean {
  return META_PHASE_TITLES.has(phase.title.trim().toLowerCase());
}

export type DailyTopicPick = {
  topicTitle: string;
  taskTitle: string;
  phase: PlanPhase;
  module: {
    id: string;
    title: string;
    order: number;
    deadlineStart?: string;
    deadlineEnd?: string;
    done?: boolean;
  };
  phaseLabel: string;
  estimatedMinutes: number;
};

/**
 * Strict sequential pick: first incomplete step in first incomplete этап.
 * Completing step N unlocks step N+1 into Today.
 */
export function pickDailyTopic(
  wp: WorkPlan,
  store: LifeStore,
  _date: string,
  ownerTitle?: string
): DailyTopicPick | null {
  const phases = [...(wp.phases ?? [])]
    .filter((p) => !isMetaPhase(p))
    .sort((a, b) => a.order - b.order);
  if (!phases.length) return null;

  const next = nextOpenStep(wp);
  if (!next) return null;

  const raw = next.module.title;
  const taskTitle = formatTaskTitle(raw, ownerTitle);
  if (isGenericPlanTitle(taskTitle) && !ownerTitle) return null;

  const pNum = phaseNumberForStageOrder(next.stage.order);
  const sIdx = stageIndexInPhase(next.stage.order) + 1;
  const phaseLabel = isGenericPlanTitle(next.stage.title)
    ? `Фаза ${pNum} · Этап ${sIdx}`
    : next.stage.title;

  return {
    topicTitle: cleanTopicTitle(raw) || taskTitle,
    taskTitle: isGenericPlanTitle(taskTitle)
      ? formatTaskTitle(raw, ownerTitle)
      : taskTitle,
    phase: next.stage,
    module: next.module,
    phaseLabel,
    estimatedMinutes: defaultTaskMinutes(store),
  };
}

export function goalFocusScore(goal: Goal, store?: LifeStore): number {
  let s = 0;
  if (goal.bucket === "foundation" || effectiveHorizonStage(goal) === 1) s += 100;
  if (goal.priority === "critical") s += 50;
  if (goal.priority === "high") s += 30;
  if (goal.active) s += 10;
  if (store) {
    const cur = currentHorizonStage(store);
    const slot = effectiveHorizonStage(goal);
    if (slot === cur) s += 80;
    else if (slot < cur) s += 35; // overdue stage — still pull
    else s -= 25; // future stage — quieter
  }
  return s;
}

export function projectFocusScore(project: Project): number {
  let s = 20;
  if (project.priority === "critical") s += 40;
  return s;
}

export function pickGoalTopic(
  store: LifeStore,
  goal: Goal,
  date: string
): (DailyTopicPick & { workPlanId: string }) | null {
  if (!goal.workPlanId) return null;
  const wp = findWorkPlan(store, goal.workPlanId);
  if (!wp || wp.status === "archived") return null;
  const pick = pickDailyTopic(wp, store, date, goal.title);
  if (!pick) return null;
  return { ...pick, workPlanId: wp.id };
}

export function shouldSkipLegacyStage(goal: Goal): boolean {
  return Boolean(goal.workPlanId);
}
