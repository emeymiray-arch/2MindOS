import { NextResponse } from "next/server";
import { id, now } from "@/lib/id";
import { ensureWeek, weekStartMonday } from "@/lib/lifeos";
import { getStore, updateStore } from "@/lib/store";
import { calcGoalProgress } from "@/lib/tasks";
import type { WeeklyObjective } from "@/lib/types";

export async function GET(request: Request) {
  const store = await getStore();
  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? now().slice(0, 10);
  const weekStart = weekStartMonday(date);
  const week = store.weeks?.find((w) => w.weekStart === weekStart);
  const activeGoals = store.goals
    .filter((g) => g.active && !g.archived && (g.bucket ?? "development") !== "later")
    .map((g) => ({
      ...g,
      progress: calcGoalProgress(g, store),
      workPlanId: g.workPlanId,
      area: store.spheres.find((s) => s.id === g.lifeAreaId) ?? null,
      currentPhase: g.workPlanId
        ? store.workPlans
            ?.find((p) => p.id === g.workPlanId)
            ?.phases.find((ph) => ph.status === "active" && !ph.archived) ?? null
        : null,
    }));

  return NextResponse.json({
    weekStart,
    week: week ?? null,
    weeks: store.weeks ?? [],
    activeGoals,
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "ensure");
  const date = String(body.date ?? now().slice(0, 10));
  const weekStart = body.weekStart ? String(body.weekStart) : weekStartMonday(date);

  if (action === "ensure") {
    const store = await updateStore((s) => {
      ensureWeek(s, weekStart);
    });
    return NextResponse.json({
      week: store.weeks.find((w) => w.weekStart === weekStart),
      weekStart,
    });
  }

  if (action === "addObjective") {
    const goalId = String(body.goalId ?? "");
    const title = String(body.title ?? "").trim();
    if (!goalId || !title) return NextResponse.json({ error: "fields" }, { status: 400 });
    const store = await updateStore((s) => {
      const week = ensureWeek(s, weekStart);
      const goal = s.goals.find((g) => g.id === goalId);
      const obj: WeeklyObjective = {
        id: id(),
        goalId,
        phaseId: body.phaseId ? String(body.phaseId) : undefined,
        workPlanId: body.workPlanId
          ? String(body.workPlanId)
          : goal?.workPlanId,
        title,
        done: false,
      };
      week.objectives.push(obj);
      if (obj.workPlanId) week.workPlanId = obj.workPlanId;
      if (obj.phaseId) week.phaseId = obj.phaseId;
    });
    return NextResponse.json({
      week: store.weeks.find((w) => w.weekStart === weekStart),
      weekStart,
    });
  }

  if (action === "toggleObjective") {
    const store = await updateStore((s) => {
      const week = ensureWeek(s, weekStart);
      const obj = week.objectives.find((o) => o.id === body.id);
      if (obj) obj.done = !obj.done;
    });
    return NextResponse.json({
      week: store.weeks.find((w) => w.weekStart === weekStart),
      weekStart,
    });
  }

  if (action === "deleteObjective") {
    const store = await updateStore((s) => {
      const week = ensureWeek(s, weekStart);
      week.objectives = week.objectives.filter((o) => o.id !== body.id);
    });
    return NextResponse.json({
      week: store.weeks.find((w) => w.weekStart === weekStart),
      weekStart,
    });
  }

  if (action === "spawnTasks") {
    const objectiveId = String(body.objectiveId ?? "");
    const titles: string[] = Array.isArray(body.titles)
      ? body.titles.map(String)
      : body.title
        ? [String(body.title)]
        : [];
    const taskDate = String(body.taskDate ?? date);
    const store = await updateStore((s) => {
      const week = ensureWeek(s, weekStart);
      const obj = week.objectives.find((o) => o.id === objectiveId);
      if (!obj) return;
      const goal = s.goals.find((g) => g.id === obj.goalId);
      for (const title of titles) {
        const t = title.trim();
        if (!t) continue;
        s.dayTasks.push({
          id: id(),
          date: taskDate,
          title: t,
          done: false,
          goalId: obj.goalId || undefined,
          goalTitle: goal?.title,
          stageId: obj.phaseId,
          weekId: week.id,
          objectiveId: obj.id,
          workPlanId: obj.workPlanId ?? week.workPlanId,
          lifeAreaId: goal?.lifeAreaId,
          priority: "must",
        });
      }
    });
    return NextResponse.json({
      week: store.weeks.find((w) => w.weekStart === weekStart),
      weekStart,
      tasks: store.dayTasks.filter((t) => t.date === taskDate && !t.archived),
    });
  }

  return NextResponse.json({ error: "unknown" }, { status: 400 });
}
