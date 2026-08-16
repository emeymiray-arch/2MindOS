import { NextResponse } from "next/server";
import { todayKey } from "@/lib/id";
import {
  activePlan,
  currentPhase,
  dailyLoad,
  goalsInBucket,
  inheritTaskPriority,
  taskChain,
  weekStartMonday,
} from "@/lib/lifeos";
import { getStore } from "@/lib/store";
import { calcGoalProgress, tasksForDate } from "@/lib/tasks";

export async function GET() {
  const store = await getStore();
  const today = todayKey();
  const plan = activePlan(store);
  const weekStart = weekStartMonday(today);
  const week = store.weeks?.find((w) => w.weekStart === weekStart);

  const activeGoals = store.goals
    .filter((g) => g.active && !g.archived && (g.bucket ?? "development") !== "later")
    .map((g) => ({
      id: g.id,
      title: g.title,
      progress: calcGoalProgress(g),
      priority: g.priority ?? "medium",
      bucket: g.bucket ?? "development",
      lifeAreaId: g.lifeAreaId,
      area: store.spheres.find((s) => s.id === g.lifeAreaId) ?? null,
      phase: currentPhase(g) ?? null,
    }));

  const later = goalsInBucket(store, "later").map((g) => ({
    id: g.id,
    title: g.title,
    area: store.spheres.find((s) => s.id === g.lifeAreaId)?.name,
  }));

  const tasks = tasksForDate(store, today).map((t) => ({
    ...t,
    effectivePriority: inheritTaskPriority(store, t),
    chain: (() => {
      const c = taskChain(store, t);
      return {
        area: c.area?.name,
        plan: c.plan?.title,
        goal: c.goal?.title,
        phase: c.phase?.title,
        week: c.week?.weekStart,
      };
    })(),
  }));

  const load = dailyLoad(tasks, store, store.settings.dailyCapacity ?? 6);

  const foundationMatters = goalsInBucket(store, "foundation")
    .slice(0, 3)
    .map((g) => ({ id: g.id, title: g.title, progress: calcGoalProgress(g) }));
  const priorityMatters = activeGoals
    .filter((g) => g.priority === "critical" || g.priority === "high")
    .slice(0, 3)
    .map((g) => ({ id: g.id, title: g.title, progress: g.progress }));
  const matters = [...foundationMatters, ...priorityMatters]
    .filter((g, i, arr) => arr.findIndex((x) => x.id === g.id) === i)
    .slice(0, 5);

  return NextResponse.json({
    today,
    plan,
    weekStart,
    week,
    areas: store.spheres,
    matters,
    workingOn: activeGoals,
    notDoing: later,
    tasks,
    load,
    objectives: week?.objectives ?? [],
  });
}
