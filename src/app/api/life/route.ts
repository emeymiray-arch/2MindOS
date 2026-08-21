import { apiError, apiJson } from "@/lib/api-response";
import { todayKey } from "@/lib/id";
import {
  activePlan,
  calcWorkPlanProgress,
  currentPhase,
  currentWorkPhase,
  dailyLoad,
  findWorkPlan,
  goalsInBucket,
  inheritTaskPriority,
  taskChain,
  weekStartMonday,
} from "@/lib/lifeos";
import { getStore } from "@/lib/store";
import { calcGoalProgress, tasksForDate } from "@/lib/tasks";

export async function GET() {
  try {
    const store = await getStore();
    const today = todayKey();
    const plan = activePlan(store);
    const weekStart = weekStartMonday(today);
    const week = store.weeks?.find((w) => w.weekStart === weekStart);

    const activeGoals = store.goals
      .filter((g) => g.active && !g.archived && (g.bucket ?? "development") !== "later")
      .map((g) => {
        const workPlan = g.workPlanId ? findWorkPlan(store, g.workPlanId) : undefined;
        const progress = workPlan ? calcWorkPlanProgress(workPlan) : calcGoalProgress(g, store);
        const phase = workPlan ? currentWorkPhase(workPlan) : currentPhase(g);
        return {
          id: g.id,
          title: g.title,
          progress,
          priority: g.priority ?? "medium",
          bucket: g.bucket ?? "development",
          lifeAreaId: g.lifeAreaId,
          area: store.spheres.find((s) => s.id === g.lifeAreaId) ?? null,
          phase: phase ? { id: phase.id, title: phase.title } : null,
          workPlan: workPlan
            ? { id: workPlan.id, title: workPlan.title, progress: calcWorkPlanProgress(workPlan) }
            : null,
          hasPlan: Boolean(workPlan),
        };
      });

    const later = goalsInBucket(store, "later").map((g) => ({
      id: g.id,
      title: g.title,
      area: store.spheres.find((s) => s.id === g.lifeAreaId)?.name,
    }));

    const tasks = tasksForDate(store, today).map((t) => {
      const c = taskChain(store, t);
      return {
        ...t,
        effectivePriority: inheritTaskPriority(store, t),
        chain: {
          area: c.area?.name,
          plan: c.plan?.title,
          workPlan: c.workPlan?.title,
          goal: c.goal?.title,
          phase: c.phase?.title,
          week: c.week?.weekStart,
          why: [
            c.workPlan?.title && `План: ${c.workPlan.title}`,
            c.phase?.title && `Этап: ${c.phase.title}`,
            c.goal?.title && `Цель: ${c.goal.title}`,
          ]
            .filter(Boolean)
            .join(" · "),
        },
      };
    });

    const load = dailyLoad(tasks, store, store.settings.dailyCapacity ?? 6);

    const foundationMatters = goalsInBucket(store, "foundation")
      .slice(0, 3)
      .map((g) => ({
        id: g.id,
        title: g.title,
        progress: calcGoalProgress(g, store),
        hasPlan: Boolean(g.workPlanId),
      }));
    const priorityMatters = activeGoals
      .filter((g) => g.priority === "critical" || g.priority === "high")
      .slice(0, 3)
      .map((g) => ({ id: g.id, title: g.title, progress: g.progress, hasPlan: g.hasPlan }));
    const matters = [...foundationMatters, ...priorityMatters]
      .filter((g, i, arr) => arr.findIndex((x) => x.id === g.id) === i)
      .slice(0, 5);

    const currentWorkPlans = (store.workPlans ?? [])
      .filter((p) => p.status === "active")
      .slice(0, 5)
      .map((p) => ({
        id: p.id,
        title: p.title,
        progress: calcWorkPlanProgress(p),
        phase: currentWorkPhase(p)?.title,
        ownerType: p.ownerType,
      }));

    return apiJson({
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
      currentWorkPlans,
    });
  } catch (e) {
    return apiError(e);
  }
}
