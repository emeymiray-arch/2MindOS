import { NextResponse } from "next/server";
import { id, now } from "@/lib/id";
import { getStore, updateStore } from "@/lib/store";
import { calcGoalProgress, goalAnalytics } from "@/lib/tasks";
import type { Goal, GoalStage } from "@/lib/types";

export async function GET(request: Request) {
  const store = await getStore();
  const showArchived = new URL(request.url).searchParams.get("archived") === "1";
  const goals = store.goals.filter((g) => (showArchived ? g.archived : !g.archived && g.active));
  return NextResponse.json({
    goals: goals.map((g) => ({
      ...g,
      progress: calcGoalProgress(g),
      analytics: goalAnalytics(g, store.stageDayLogs),
    })),
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const action = String(body.action ?? "create");

  if (action === "create") {
    const title = String(body.title ?? "").trim();
    if (!title) return NextResponse.json({ error: "title" }, { status: 400 });
    const store = await updateStore((s) => {
      const t = now();
      const nodeId = id();
      s.nodes.unshift({
        id: nodeId,
        kind: "goal",
        title,
        metadata: {},
        salience: 0.9,
        createdAt: t,
        updatedAt: t,
      });
      const goal: Goal = {
        id: id(),
        nodeId,
        title,
        deadline: body.deadline ? String(body.deadline) : undefined,
        stages: [],
        notes: body.notes ? String(body.notes) : undefined,
        progress: 0,
        active: true,
        archived: false,
        createdAt: t,
      };
      s.goals.unshift(goal);
    });
    return NextResponse.json({ goals: store.goals.filter((g) => !g.archived) });
  }

  if (action === "update") {
    const store = await updateStore((s) => {
      const g = s.goals.find((x) => x.id === body.id);
      if (!g) return;
      if (body.title != null) g.title = String(body.title);
      if (body.deadline !== undefined) g.deadline = body.deadline || undefined;
      if (body.notes !== undefined) g.notes = body.notes || undefined;
    });
    return NextResponse.json({ goals: store.goals });
  }

  if (action === "archive") {
    const store = await updateStore((s) => {
      const g = s.goals.find((x) => x.id === body.id);
      if (g) {
        g.archived = true;
        g.active = false;
      }
    });
    return NextResponse.json({ goals: store.goals.filter((g) => !g.archived) });
  }

  if (action === "delete") {
    const store = await updateStore((s) => {
      s.goals = s.goals.filter((x) => x.id !== body.id);
    });
    return NextResponse.json({ goals: store.goals.filter((g) => !g.archived) });
  }

  if (action === "addStage") {
    const goalId = String(body.goalId ?? "");
    const title = String(body.title ?? "").trim();
    if (!goalId || !title) return NextResponse.json({ error: "fields" }, { status: 400 });
    const store = await updateStore((s) => {
      const g = s.goals.find((x) => x.id === goalId);
      if (!g) return;
      const stage: GoalStage = {
        id: id(),
        title,
        done: false,
        deadlineStart: body.deadlineStart ? String(body.deadlineStart) : undefined,
        deadlineEnd: body.deadlineEnd ? String(body.deadlineEnd) : undefined,
        order: g.stages.length + 1,
      };
      g.stages.push(stage);
      g.progress = calcGoalProgress(g);
    });
    return NextResponse.json({ goals: store.goals });
  }

  if (action === "toggleStage") {
    const store = await updateStore((s) => {
      const g = s.goals.find((x) => x.id === body.goalId);
      const st = g?.stages.find((x) => x.id === body.stageId);
      if (!st || !g) return;
      st.done = Boolean(body.done ?? !st.done);
      g.progress = calcGoalProgress(g);
    });
    return NextResponse.json({ goals: store.goals });
  }

  if (action === "updateStage") {
    const store = await updateStore((s) => {
      const g = s.goals.find((x) => x.id === body.goalId);
      const st = g?.stages.find((x) => x.id === body.stageId);
      if (!st) return;
      if (body.title != null) st.title = String(body.title);
      if (body.deadlineStart !== undefined) st.deadlineStart = body.deadlineStart || undefined;
      if (body.deadlineEnd !== undefined) st.deadlineEnd = body.deadlineEnd || undefined;
      if (g) g.progress = calcGoalProgress(g);
    });
    return NextResponse.json({ goals: store.goals });
  }

  if (action === "archiveStage") {
    const store = await updateStore((s) => {
      const g = s.goals.find((x) => x.id === body.goalId);
      const st = g?.stages.find((x) => x.id === body.stageId);
      if (st) st.archived = true;
      if (g) g.progress = calcGoalProgress(g);
    });
    return NextResponse.json({ goals: store.goals });
  }

  if (action === "unarchiveStage") {
    const store = await updateStore((s) => {
      const g = s.goals.find((x) => x.id === body.goalId);
      const st = g?.stages.find((x) => x.id === body.stageId);
      if (st) st.archived = false;
      if (g) g.progress = calcGoalProgress(g);
    });
    return NextResponse.json({ goals: store.goals });
  }

  if (action === "deleteStage") {
    const store = await updateStore((s) => {
      const g = s.goals.find((x) => x.id === body.goalId);
      if (!g) return;
      g.stages = g.stages.filter((x) => x.id !== body.stageId);
      g.progress = calcGoalProgress(g);
    });
    return NextResponse.json({ goals: store.goals });
  }

  return NextResponse.json({ error: "unknown" }, { status: 400 });
}
