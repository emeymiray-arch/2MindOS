import { NextResponse } from "next/server";
import { id } from "@/lib/id";
import {
  activeStages,
  computeMonthStats,
  computeRoadmapStats,
  findStageMonth,
  monthTitle,
} from "@/lib/roadmap";
import { getStore, updateStore } from "@/lib/store";
import type {
  RoadmapDay,
  RoadmapMonth,
  RoadmapMonthGoal,
  RoadmapStage,
  RoadmapTask,
} from "@/lib/types";

function findStage(stages: RoadmapStage[], stageId: string) {
  return stages.find((s) => s.id === stageId);
}

function findMonth(stage: RoadmapStage, monthId: string) {
  return stage.months.find((m) => m.id === monthId);
}

export async function GET(request: Request) {
  const store = await getStore();
  const url = new URL(request.url);
  const stageId = url.searchParams.get("stageId");
  const monthId = url.searchParams.get("monthId");
  const showArchived = url.searchParams.get("archived") === "1";

  if (stageId && monthId) {
    const found = findStageMonth(store.roadmap, stageId, monthId);
    if (!found) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({
      stage: found.stage,
      month: found.month,
      title: monthTitle(found.month.year, found.month.month),
      progress: computeMonthStats(found.month).overallProgress,
      stats: computeMonthStats(found.month),
    });
  }

  const stages = showArchived
    ? store.roadmap.stages
    : activeStages(store.roadmap);

  return NextResponse.json({
    roadmap: { stages },
    stats: computeRoadmapStats(store.roadmap),
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "");

  if (action === "createStage") {
    const title = String(body.title ?? "").trim() || "Stage";
    const subtitle = String(body.subtitle ?? "").trim();
    const store = await updateStore((s) => {
      const order = s.roadmap.stages.length + 1;
      s.roadmap.stages.push({
        id: id(),
        title,
        subtitle,
        order,
        archived: false,
        months: [],
      });
    });
    return NextResponse.json({
      roadmap: { stages: activeStages(store.roadmap) },
      stats: computeRoadmapStats(store.roadmap),
    });
  }

  if (action === "updateStage") {
    const store = await updateStore((s) => {
      const st = findStage(s.roadmap.stages, String(body.stageId));
      if (!st) return;
      if (body.title != null) st.title = String(body.title).trim() || st.title;
      if (body.subtitle != null) st.subtitle = String(body.subtitle).trim();
    });
    return NextResponse.json({
      roadmap: { stages: activeStages(store.roadmap) },
      stats: computeRoadmapStats(store.roadmap),
    });
  }

  if (action === "archiveStage") {
    const store = await updateStore((s) => {
      const st = findStage(s.roadmap.stages, String(body.stageId));
      if (st) st.archived = true;
    });
    return NextResponse.json({
      roadmap: { stages: activeStages(store.roadmap) },
      stats: computeRoadmapStats(store.roadmap),
    });
  }

  if (action === "deleteStage") {
    const store = await updateStore((s) => {
      s.roadmap.stages = s.roadmap.stages.filter((x) => x.id !== body.stageId);
      s.roadmap.stages.forEach((st, i) => {
        st.order = i + 1;
      });
    });
    return NextResponse.json({
      roadmap: { stages: activeStages(store.roadmap) },
      stats: computeRoadmapStats(store.roadmap),
    });
  }

  if (action === "reorderStages") {
    const order = Array.isArray(body.order) ? (body.order as string[]) : [];
    const store = await updateStore((s) => {
      const map = new Map(s.roadmap.stages.map((st) => [st.id, st]));
      const next: RoadmapStage[] = [];
      order.forEach((sid, i) => {
        const st = map.get(sid);
        if (st) {
          st.order = i + 1;
          next.push(st);
          map.delete(sid);
        }
      });
      for (const st of map.values()) {
        st.order = next.length + 1;
        next.push(st);
      }
      s.roadmap.stages = next;
    });
    return NextResponse.json({
      roadmap: { stages: activeStages(store.roadmap) },
      stats: computeRoadmapStats(store.roadmap),
    });
  }

  if (action === "createMonth") {
    const stageId = String(body.stageId ?? "");
    const year = Number(body.year) || new Date().getFullYear();
    const month = Number(body.month) || new Date().getMonth() + 1;
    const store = await updateStore((s) => {
      const st = findStage(s.roadmap.stages, stageId);
      if (!st) return;
      const m: RoadmapMonth = {
        id: id(),
        year,
        month: Math.max(1, Math.min(12, month)),
        goals: [],
        days: [],
        archived: false,
      };
      st.months.push(m);
    });
    return NextResponse.json({
      roadmap: { stages: activeStages(store.roadmap) },
      stats: computeRoadmapStats(store.roadmap),
    });
  }

  if (action === "archiveMonth") {
    const store = await updateStore((s) => {
      const st = findStage(s.roadmap.stages, String(body.stageId));
      const m = st ? findMonth(st, String(body.monthId)) : undefined;
      if (m) m.archived = true;
    });
    return NextResponse.json({
      roadmap: { stages: activeStages(store.roadmap) },
      stats: computeRoadmapStats(store.roadmap),
    });
  }

  if (action === "deleteMonth") {
    const store = await updateStore((s) => {
      const st = findStage(s.roadmap.stages, String(body.stageId));
      if (!st) return;
      st.months = st.months.filter((m) => m.id !== body.monthId);
    });
    return NextResponse.json({
      roadmap: { stages: activeStages(store.roadmap) },
      stats: computeRoadmapStats(store.roadmap),
    });
  }

  if (action === "addGoal") {
    const title = String(body.title ?? "").trim();
    if (!title) return NextResponse.json({ error: "title" }, { status: 400 });
    const store = await updateStore((s) => {
      const st = findStage(s.roadmap.stages, String(body.stageId));
      const m = st ? findMonth(st, String(body.monthId)) : undefined;
      if (!m) return;
      const g: RoadmapMonthGoal = { id: id(), title, done: Boolean(body.done) };
      m.goals.push(g);
    });
    return NextResponse.json({
      roadmap: { stages: activeStages(store.roadmap) },
      stats: computeRoadmapStats(store.roadmap),
    });
  }

  if (action === "toggleGoal") {
    const store = await updateStore((s) => {
      const st = findStage(s.roadmap.stages, String(body.stageId));
      const m = st ? findMonth(st, String(body.monthId)) : undefined;
      const g = m?.goals.find((x) => x.id === body.goalId);
      if (g) g.done = !g.done;
    });
    if (body.stageId && body.monthId) {
      const found = findStageMonth(store.roadmap, String(body.stageId), String(body.monthId));
      if (found) {
        return NextResponse.json({
          stage: found.stage,
          month: found.month,
          title: monthTitle(found.month.year, found.month.month),
          progress: computeMonthStats(found.month).overallProgress,
          stats: computeMonthStats(found.month),
        });
      }
    }
    return NextResponse.json({
      roadmap: { stages: activeStages(store.roadmap) },
      stats: computeRoadmapStats(store.roadmap),
    });
  }

  if (action === "deleteGoal") {
    const store = await updateStore((s) => {
      const st = findStage(s.roadmap.stages, String(body.stageId));
      const m = st ? findMonth(st, String(body.monthId)) : undefined;
      if (!m) return;
      m.goals = m.goals.filter((g) => g.id !== body.goalId);
    });
    return NextResponse.json({
      roadmap: { stages: activeStages(store.roadmap) },
      stats: computeRoadmapStats(store.roadmap),
    });
  }

  if (action === "addDay") {
    const date = String(body.date ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "date" }, { status: 400 });
    }
    const store = await updateStore((s) => {
      const st = findStage(s.roadmap.stages, String(body.stageId));
      const m = st ? findMonth(st, String(body.monthId)) : undefined;
      if (!m) return;
      if (m.days.some((d) => d.date === date)) return;
      const day: RoadmapDay = { id: id(), date, tasks: [] };
      m.days.push(day);
      m.days.sort((a, b) => a.date.localeCompare(b.date));
    });
    const found = findStageMonth(store.roadmap, String(body.stageId), String(body.monthId));
    if (!found) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({
      stage: found.stage,
      month: found.month,
      title: monthTitle(found.month.year, found.month.month),
      progress: computeMonthStats(found.month).overallProgress,
      stats: computeMonthStats(found.month),
    });
  }

  if (action === "addTask") {
    const title = String(body.title ?? "").trim();
    if (!title) return NextResponse.json({ error: "title" }, { status: 400 });
    const store = await updateStore((s) => {
      const st = findStage(s.roadmap.stages, String(body.stageId));
      const m = st ? findMonth(st, String(body.monthId)) : undefined;
      const day = m?.days.find((d) => d.id === body.dayId);
      if (!day) return;
      const task: RoadmapTask = { id: id(), title, done: false };
      day.tasks.push(task);
    });
    const found = findStageMonth(store.roadmap, String(body.stageId), String(body.monthId));
    if (!found) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({
      stage: found.stage,
      month: found.month,
      title: monthTitle(found.month.year, found.month.month),
      progress: computeMonthStats(found.month).overallProgress,
      stats: computeMonthStats(found.month),
    });
  }

  if (action === "toggleTask") {
    const store = await updateStore((s) => {
      const st = findStage(s.roadmap.stages, String(body.stageId));
      const m = st ? findMonth(st, String(body.monthId)) : undefined;
      const day = m?.days.find((d) => d.id === body.dayId);
      const task = day?.tasks.find((t) => t.id === body.taskId);
      if (task) task.done = !task.done;
    });
    const found = findStageMonth(store.roadmap, String(body.stageId), String(body.monthId));
    if (!found) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({
      stage: found.stage,
      month: found.month,
      title: monthTitle(found.month.year, found.month.month),
      progress: computeMonthStats(found.month).overallProgress,
      stats: computeMonthStats(found.month),
    });
  }

  if (action === "deleteDay") {
    const store = await updateStore((s) => {
      const st = findStage(s.roadmap.stages, String(body.stageId));
      const m = st ? findMonth(st, String(body.monthId)) : undefined;
      if (!m) return;
      m.days = m.days.filter((d) => d.id !== body.dayId);
    });
    const found = findStageMonth(store.roadmap, String(body.stageId), String(body.monthId));
    if (!found) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({
      stage: found.stage,
      month: found.month,
      title: monthTitle(found.month.year, found.month.month),
      progress: computeMonthStats(found.month).overallProgress,
      stats: computeMonthStats(found.month),
    });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
