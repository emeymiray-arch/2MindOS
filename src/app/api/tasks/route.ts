import { NextResponse } from "next/server";
import { id } from "@/lib/id";
import { getStore, updateStore } from "@/lib/store";
import { ensureDayTask, tasksForDate, upsertStageDayLog } from "@/lib/tasks";

export async function GET(request: Request) {
  const store = await getStore();
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const month = searchParams.get("month");
  const archived = searchParams.get("archived") === "1";
  const tasks = tasksForDate(store, date, { archived });
  const events = (store.calendarEvents ?? []).filter((e) => !e.archived && e.date === date);
  const monthEvents = month
    ? (store.calendarEvents ?? []).filter((e) => !e.archived && e.date.startsWith(month))
    : [];
  return NextResponse.json({ date, tasks, events, monthEvents });
}

export async function POST(request: Request) {
  const body = await request.json();
  const action = String(body.action ?? "toggle");
  const date = String(body.date ?? new Date().toISOString().slice(0, 10));

  if (action === "toggle") {
    const taskId = String(body.id ?? body.taskId ?? "");
    const stageId = body.stageId ? String(body.stageId) : "";
    const done = Boolean(body.done);
    if (!taskId && !stageId) {
      return NextResponse.json({ error: "id" }, { status: 400 });
    }
    const store = await updateStore((s) => {
      const list = tasksForDate(s, date);
      const task =
        list.find((t) => t.id === taskId) ||
        (stageId ? list.find((t) => t.stageId === stageId) : undefined);
      if (!task) return;
      const persisted = ensureDayTask(s, { ...task, done, archived: false });
      if (persisted.stageId) {
        upsertStageDayLog(s, persisted.stageId, date, done, id);
        if (done) {
          for (const g of s.goals) {
            const st = g.stages.find((x) => x.id === persisted.stageId);
            if (st) st.done = true;
          }
        }
      }
    });
    return NextResponse.json({ tasks: tasksForDate(store, date) });
  }

  if (action === "add") {
    const title = String(body.title ?? "").trim();
    if (!title || !date) return NextResponse.json({ error: "fields" }, { status: 400 });
    const store = await updateStore((s) => {
      ensureDayTask(s, {
        date,
        title,
        done: false,
        deadlineEnd: body.deadlineEnd ? String(body.deadlineEnd) : undefined,
      });
    });
    return NextResponse.json({ tasks: tasksForDate(store, date) });
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
      if (task.stageId && body.title != null) {
        for (const g of s.goals) {
          const st = g.stages.find((x) => x.id === task!.stageId);
          if (st) st.title = task.title;
        }
      }
    });
    return NextResponse.json({ tasks: tasksForDate(store, date) });
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
      tasks: tasksForDate(store, date, { archived: !archived ? undefined : false }),
    });
  }

  if (action === "delete") {
    const taskId = String(body.id ?? "");
    if (!taskId) return NextResponse.json({ error: "id" }, { status: 400 });
    const store = await updateStore((s) => {
      const virt = tasksForDate(s, date).find((t) => t.id === taskId);
      if (virt?.stageId) {
        // Hide stage-linked task by archiving the day row; keep stage in goal
        const row = ensureDayTask(s, { ...virt, archived: true });
        row.archived = true;
        return;
      }
      s.dayTasks = (s.dayTasks ?? []).filter((t) => t.id !== taskId);
    });
    return NextResponse.json({ tasks: tasksForDate(store, date) });
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

  return NextResponse.json({ error: "unknown" }, { status: 400 });
}
