import { NextResponse } from "next/server";
import { id, todayKey } from "@/lib/id";
import { getStore, updateStore } from "@/lib/store";
import {
  activeCategories,
  categoryAnalytics,
  ensureDayTask,
  tasksForDate,
  upsertStageDayLog,
} from "@/lib/tasks";
import { dailyLoad, inheritTaskPriority, recomputeFromTaskToggle, taskChain } from "@/lib/lifeos";
import { onTaskComplete } from "@/lib/gamification";
import { feedbackAfterAction, playerSnapshot } from "@/lib/action-feedback";
import { composeToday, ensureTodayComposed, shouldAutoCompose } from "@/lib/compose-today";
import {
  cleanTopicTitle,
  defaultTaskMinutes,
  formatTaskTitle,
  isGenericPlanTitle,
} from "@/lib/daily-focus";
import { unlockNextPlanStep } from "@/lib/plan-calendar";
import { activeTimerPayload, formatMinutes, sumMinutesForDate, taskMinutesToday } from "@/lib/time";
import type { TaskPriority } from "@/lib/types";

function enrichTasks(store: Awaited<ReturnType<typeof getStore>>, date: string, archived?: boolean) {
  const tasks = tasksForDate(store, date, { archived: archived ? true : undefined }).map((t) => {
    const chain = taskChain(store, t);
    const phaseRaw = chain.workPhase?.title ?? chain.phase?.title;
    let phase: string | undefined;
    if (phaseRaw && !isGenericPlanTitle(phaseRaw)) {
      phase = phaseRaw;
    } else if (chain.milestone?.title) {
      const m = cleanTopicTitle(chain.milestone.title);
      if (m && m !== cleanTopicTitle(t.title)) phase = m;
    }
    const estimatedMinutes = t.estimatedMinutes ?? defaultTaskMinutes(store);
    const goalLabel = chain.goal?.title ?? chain.project?.name;
    return {
      ...t,
      estimatedMinutes,
      effectivePriority: inheritTaskPriority(store, t),
      minutesToday: taskMinutesToday(store, t.id, date),
      chain: {
        area: chain.area?.name,
        areaId: chain.area?.id,
        plan: chain.plan?.title,
        workPlan: chain.workPlan?.title,
        workPlanId: chain.workPlan?.id,
        goal: goalLabel,
        project: chain.project?.name,
        phase: phase && !isGenericPlanTitle(phase) ? cleanTopicTitle(phase) : undefined,
        milestone: chain.milestone?.title ? cleanTopicTitle(chain.milestone.title) : undefined,
        week: chain.week?.weekStart,
        why: goalLabel,
      },
    };
  });
  const open = tasks.filter((t) => !t.done);
  const estimatedTotal = open.reduce((s, t) => s + (t.estimatedMinutes ?? 0), 0);
  const loggedTotal = sumMinutesForDate(store, date);
  const load = dailyLoad(tasks, store, store.settings.dailyCapacity ?? 6);
  return {
    tasks,
    load,
    daySummary: {
      estimatedMinutes: estimatedTotal,
      loggedMinutes: loggedTotal,
      estimatedFormatted: formatMinutes(estimatedTotal),
      loggedFormatted: formatMinutes(loggedTotal),
      openCount: open.length,
    },
  };
}

function taskPayload(store: Awaited<ReturnType<typeof getStore>>, date: string, month: string) {
  const enriched = enrichTasks(store, date);
  return {
    date,
    ...enriched,
    activeTimer: activeTimerPayload(store),
    categories: activeCategories(store),
    analytics: categoryAnalytics(store, month),
    areas: store.spheres,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
    const month = searchParams.get("month") ?? date.slice(0, 7);
    const archived = searchParams.get("archived") === "1";

    let store = await getStore();
    if (shouldAutoCompose(date)) {
      const composed = await ensureTodayComposed(getStore, updateStore, date);
      store = composed.store;
    }

    const tasks = enrichTasks(store, date, archived);
    const events = (store.calendarEvents ?? []).filter((e) => !e.archived && e.date === date);
    const monthEvents = month
      ? (store.calendarEvents ?? []).filter((e) => !e.archived && e.date.startsWith(month))
      : [];
    return NextResponse.json({
      date,
      ...tasks,
      events,
      monthEvents,
      categories: activeCategories(store),
      analytics: categoryAnalytics(store, month),
      areas: store.spheres,
      activeTimer: activeTimerPayload(store),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "load failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body.action ?? "toggle");
    const date = String(body.date ?? todayKey());
    const month = date.slice(0, 7);

    if (action === "toggle") {
      const taskId = String(body.id ?? body.taskId ?? "");
      const stageId = body.stageId ? String(body.stageId) : "";
      const done = Boolean(body.done);
      if (!taskId && !stageId) {
        return NextResponse.json({ error: "id" }, { status: 400 });
      }
      let feedback = null as ReturnType<typeof feedbackAfterAction>;
      const store = await updateStore((s) => {
        const before = playerSnapshot(s);
        const list = tasksForDate(s, date);
        const task =
          list.find((t) => t.id === taskId) ||
          (stageId ? list.find((t) => t.stageId === stageId) : undefined);
        if (!task) return;
        const persisted = ensureDayTask(s, { ...task, done, archived: false });
        if (persisted.stageId) {
          upsertStageDayLog(s, persisted.stageId, date, done, id);
        }
        recomputeFromTaskToggle(s, persisted);
        let xp = 0;
        if (done) {
          xp =
            persisted.priority === "must" ? 15 : persisted.priority === "should" ? 10 : 5;
          onTaskComplete(s, persisted, date);
          if (persisted.workPlanId) {
            unlockNextPlanStep(s, persisted.workPlanId, date);
          }
        }
        if (persisted.habitId) {
          const habit = s.habits.find((h) => h.id === persisted.habitId);
          if (habit) {
            const existing = s.habitLogs.find(
              (l) => l.habitId === habit.id && l.date === date
            );
            const value = done ? habit.targetPerDay : 0;
            if (existing) existing.value = value;
            else if (done) {
              s.habitLogs.push({
                id: id(),
                habitId: habit.id,
                date,
                value,
                createdAt: new Date().toISOString(),
              });
            }
          }
        }
        const after = playerSnapshot(s);
        if (done) feedback = feedbackAfterAction(before, after, xp);
      });
      return NextResponse.json({ ...taskPayload(store, date, month), feedback });
    }

    if (action === "spawnFromPlan") {
      const raw = String(body.title ?? "").trim();
      if (!raw) return NextResponse.json({ error: "title" }, { status: 400 });
      const store = await updateStore((s) => {
        const goal = body.goalId
          ? s.goals.find((g) => g.id === String(body.goalId))
          : undefined;
        ensureDayTask(s, {
          date,
          title: formatTaskTitle(raw, goal?.title),
          done: false,
          goalId: body.goalId ? String(body.goalId) : undefined,
          workPlanId: body.workPlanId ? String(body.workPlanId) : undefined,
          priority: (body.priority as TaskPriority) || "should",
          estimatedMinutes: defaultTaskMinutes(s),
        });
      });
      return NextResponse.json({
        ...taskPayload(store, date, month),
        feedback: { message: "Добавлено в сегодня" },
      });
    }

    if (action === "add") {
      const title = String(body.title ?? "").trim();
      if (!title || !date) return NextResponse.json({ error: "fields" }, { status: 400 });
      const categoryId = body.categoryId ? String(body.categoryId) : undefined;
      const store = await updateStore((s) => {
        ensureDayTask(s, {
          date,
          title,
          done: false,
          categoryId,
          goalId: body.goalId ? String(body.goalId) : undefined,
          goalTitle: body.goalTitle ? String(body.goalTitle) : undefined,
          stageId: body.stageId ? String(body.stageId) : undefined,
          weekId: body.weekId ? String(body.weekId) : undefined,
          objectiveId: body.objectiveId ? String(body.objectiveId) : undefined,
          lifeAreaId: body.lifeAreaId ? String(body.lifeAreaId) : undefined,
          priority: (body.priority as TaskPriority) || "should",
          deadlineEnd: body.deadlineEnd ? String(body.deadlineEnd) : undefined,
        });
      });
      return NextResponse.json(taskPayload(store, date, month));
    }

    if (action === "update") {
      const taskId = String(body.id ?? "");
      if (!taskId) return NextResponse.json({ error: "id" }, { status: 400 });
      const store = await updateStore((s) => {
        if (!s.dayTasks) s.dayTasks = [];
        let task = s.dayTasks.find((t) => t.id === taskId);
        if (!task) {
          const virt = tasksForDate(s, date).find((t) => t.id === taskId);
          if (virt) task = ensureDayTask(s, virt);
        }
        if (!task) return;
        if (body.title != null) task.title = String(body.title).trim() || task.title;
        if (body.date != null) task.date = String(body.date);
        if (body.deadlineEnd !== undefined) task.deadlineEnd = body.deadlineEnd || undefined;
        if (body.done != null) task.done = Boolean(body.done);
        if (body.categoryId !== undefined) {
          task.categoryId = body.categoryId ? String(body.categoryId) : undefined;
        }
        if (body.priority != null) task.priority = body.priority as TaskPriority;
        if (body.goalId !== undefined) task.goalId = body.goalId || undefined;
        if (body.lifeAreaId !== undefined) task.lifeAreaId = body.lifeAreaId || undefined;
        if (body.stageId !== undefined) task.stageId = body.stageId || undefined;
        if (task.stageId && body.title != null) {
          for (const g of s.goals) {
            const st = g.stages.find((x) => x.id === task!.stageId);
            if (st) st.title = task.title;
          }
        }
      });
      return NextResponse.json(taskPayload(store, date, month));
    }

    if (action === "archive" || action === "unarchive") {
      const taskId = String(body.id ?? "");
      if (!taskId) return NextResponse.json({ error: "id" }, { status: 400 });
      const archived = action === "archive";
      const store = await updateStore((s) => {
        let task = (s.dayTasks ?? []).find((t) => t.id === taskId);
        if (!task) {
          const virt = tasksForDate(s, date).find((t) => t.id === taskId);
          if (virt) task = ensureDayTask(s, virt);
        }
        if (task) task.archived = archived;
      });
      return NextResponse.json({
        ...taskPayload(store, date, month),
        tasks: tasksForDate(store, date, { archived: !archived ? undefined : false }),
      });
    }

    if (action === "delete") {
      const taskId = String(body.id ?? "");
      if (!taskId) return NextResponse.json({ error: "id" }, { status: 400 });
      const store = await updateStore((s) => {
        const virt = tasksForDate(s, date).find((t) => t.id === taskId);
        if (virt?.stageId) {
          const row = ensureDayTask(s, { ...virt, archived: true });
          row.archived = true;
          return;
        }
        s.dayTasks = (s.dayTasks ?? []).filter((t) => t.id !== taskId);
      });
      return NextResponse.json(taskPayload(store, date, month));
    }

    if (action === "createCategory") {
      const name = String(body.name ?? "").trim();
      if (!name) return NextResponse.json({ error: "name" }, { status: 400 });
      const store = await updateStore((s) => {
        if (!s.taskCategories) s.taskCategories = [];
        s.taskCategories.push({
          id: id(),
          name,
          order: s.taskCategories.length + 1,
          archived: false,
        });
      });
      return NextResponse.json(taskPayload(store, date, month));
    }

    if (action === "updateCategory") {
      const catId = String(body.id ?? "");
      if (!catId) return NextResponse.json({ error: "id" }, { status: 400 });
      const store = await updateStore((s) => {
        const c = (s.taskCategories ?? []).find((x) => x.id === catId);
        if (!c) return;
        if (body.name != null) c.name = String(body.name).trim() || c.name;
      });
      return NextResponse.json(taskPayload(store, date, month));
    }

    if (action === "archiveCategory") {
      const catId = String(body.id ?? "");
      if (!catId) return NextResponse.json({ error: "id" }, { status: 400 });
      const store = await updateStore((s) => {
        const c = (s.taskCategories ?? []).find((x) => x.id === catId);
        if (c) c.archived = true;
      });
      return NextResponse.json(taskPayload(store, date, month));
    }

    if (action === "deleteCategory") {
      const catId = String(body.id ?? "");
      if (!catId) return NextResponse.json({ error: "id" }, { status: 400 });
      const store = await updateStore((s) => {
        s.taskCategories = (s.taskCategories ?? []).filter((x) => x.id !== catId);
        for (const t of s.dayTasks ?? []) {
          if (t.categoryId === catId) t.categoryId = undefined;
        }
      });
      return NextResponse.json(taskPayload(store, date, month));
    }

    if (action === "addEvent") {
      const title = String(body.title ?? "").trim();
      if (!title || !date) return NextResponse.json({ error: "fields" }, { status: 400 });
      const store = await updateStore((s) => {
        s.calendarEvents.push({
          id: id(),
          title,
          date,
          note: body.note ? String(body.note) : undefined,
          important: Boolean(body.important ?? true),
        });
      });
      return NextResponse.json({
        events: store.calendarEvents.filter((e) => !e.archived && e.date === date),
      });
    }

    if (action === "updateEvent") {
      const store = await updateStore((s) => {
        const e = s.calendarEvents.find((x) => x.id === body.id);
        if (!e) return;
        if (body.title != null) e.title = String(body.title);
        if (body.date != null) e.date = String(body.date);
        if (body.note !== undefined) e.note = body.note || undefined;
      });
      return NextResponse.json({
        events: store.calendarEvents.filter((e) => !e.archived && e.date === date),
      });
    }

    if (action === "archiveEvent") {
      await updateStore((s) => {
        const e = s.calendarEvents.find((x) => x.id === body.id);
        if (e) e.archived = true;
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "deleteEvent") {
      const store = await updateStore((s) => {
        s.calendarEvents = s.calendarEvents.filter((e) => e.id !== body.id);
      });
      return NextResponse.json({
        events: store.calendarEvents.filter((e) => !e.archived && e.date === date),
      });
    }

    if (action === "composeToday") {
      const targetDate = String(body.date ?? todayKey());
      const store = await updateStore((s) => {
        composeToday(s, targetDate);
      });
      return NextResponse.json({
        ...taskPayload(store, targetDate, targetDate.slice(0, 7)),
        composed: true,
      });
    }

    return NextResponse.json({ error: "unknown" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "save failed";
    console.error("[tasks POST]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
