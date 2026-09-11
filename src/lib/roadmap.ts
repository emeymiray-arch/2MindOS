import type {
  RoadmapData,
  RoadmapDay,
  RoadmapMonth,
  RoadmapStage,
  RoadmapTask,
} from "./types";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function monthTitle(year: number, month: number): string {
  return `${MONTH_NAMES[Math.max(0, Math.min(11, month - 1))]} ${year}`;
}

export function dayLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  return `${MONTH_NAMES[m - 1]} ${d}`;
}

export function emptyRoadmap(): RoadmapData {
  return { stages: [] };
}

export function activeStages(roadmap: RoadmapData | undefined): RoadmapStage[] {
  return (roadmap?.stages ?? [])
    .filter((s) => !s.archived)
    .slice()
    .sort((a, b) => a.order - b.order);
}

export function activeMonths(stage: RoadmapStage): RoadmapMonth[] {
  return (stage.months ?? []).filter((m) => !m.archived);
}

export function monthProgress(month: RoadmapMonth): number {
  const goals = month.goals ?? [];
  const tasks = (month.days ?? []).flatMap((d) => d.tasks ?? []);
  const total = goals.length + tasks.length;
  if (total === 0) return 0;
  const done = goals.filter((g) => g.done).length + tasks.filter((t) => t.done).length;
  return Math.round((done / total) * 100);
}

export function monthGoalsDone(month: RoadmapMonth): number {
  return (month.goals ?? []).filter((g) => g.done).length;
}

export function isMonthComplete(month: RoadmapMonth): boolean {
  const goals = month.goals ?? [];
  if (goals.length === 0) {
    const tasks = (month.days ?? []).flatMap((d) => d.tasks ?? []);
    return tasks.length > 0 && tasks.every((t) => t.done);
  }
  return goals.every((g) => g.done);
}

export function dayProgress(day: RoadmapDay): number {
  const tasks = day.tasks ?? [];
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter((t) => t.done).length / tasks.length) * 100);
}

export interface RoadmapStats {
  overallProgress: number;
  completedGoals: number;
  completedMonths: number;
  totalMonths: number;
  currentStageTitle: string;
}

export function computeRoadmapStats(roadmap: RoadmapData | undefined): RoadmapStats {
  const stages = activeStages(roadmap);
  const months = stages.flatMap((s) => activeMonths(s));
  const goals = months.flatMap((m) => m.goals ?? []);
  const tasks = months.flatMap((m) => (m.days ?? []).flatMap((d) => d.tasks ?? []));
  const totalItems = goals.length + tasks.length;
  const doneItems =
    goals.filter((g) => g.done).length + tasks.filter((t) => t.done).length;

  const completedMonths = months.filter(isMonthComplete).length;
  const current =
    stages.find((s) => activeMonths(s).some((m) => !isMonthComplete(m))) ?? stages[0];

  return {
    overallProgress: totalItems === 0 ? 0 : Math.round((doneItems / totalItems) * 100),
    completedGoals: goals.filter((g) => g.done).length,
    completedMonths,
    totalMonths: months.length,
    currentStageTitle: current?.title ?? "—",
  };
}

export interface MonthPageStats {
  overallProgress: number;
  goalsCompleted: number;
  habits: number;
  focusScore: number;
}

export function computeMonthStats(month: RoadmapMonth): MonthPageStats {
  const goals = month.goals ?? [];
  const tasks = (month.days ?? []).flatMap((d) => d.tasks ?? []);
  const doneTasks = tasks.filter((t) => t.done).length;
  const overall =
    goals.length + tasks.length === 0
      ? 0
      : Math.round(
          ((goals.filter((g) => g.done).length + doneTasks) / (goals.length + tasks.length)) *
            100
        );

  const habits =
    month.habitsScore ??
    (tasks.length === 0 ? 0 : Math.round((doneTasks / tasks.length) * 100));

  const focus =
    month.focusScore ??
    Math.round(
      ((monthProgress(month) + habits) / 2) || 0
    );

  return {
    overallProgress: overall,
    goalsCompleted: goals.filter((g) => g.done).length,
    habits,
    focusScore: focus,
  };
}

export function findStageMonth(
  roadmap: RoadmapData | undefined,
  stageId: string,
  monthId: string
): { stage: RoadmapStage; month: RoadmapMonth } | null {
  const stage = (roadmap?.stages ?? []).find((s) => s.id === stageId);
  if (!stage) return null;
  const month = (stage.months ?? []).find((m) => m.id === monthId);
  if (!month) return null;
  return { stage, month };
}

export function ensureDayTasks(tasks: RoadmapTask[] | undefined): RoadmapTask[] {
  return tasks ?? [];
}
