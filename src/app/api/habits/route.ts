import { NextResponse } from "next/server";
import { id, now, todayKey } from "@/lib/id";
import { getStore, updateStore } from "@/lib/store";
import type { Habit } from "@/lib/types";

function streakFor(habitId: string, logs: { habitId: string; date: string; value: number }[]) {
  const dates = new Set(
    logs.filter((l) => l.habitId === habitId && l.value > 0).map((l) => l.date)
  );
  let streak = 0;
  const d = new Date(todayKey() + "T12:00:00");
  for (;;) {
    const key = d.toISOString().slice(0, 10);
    if (!dates.has(key)) break;
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export async function GET() {
  const store = await getStore();
  const today = todayKey();
  const habits = (store.habits ?? [])
    .filter((h) => h.active && !h.archived)
    .map((h) => {
      const todayLog = store.habitLogs.find((l) => l.habitId === h.id && l.date === today);
      const logs = store.habitLogs.filter((l) => l.habitId === h.id);
      const doneDays = new Set(logs.filter((l) => l.value > 0).map((l) => l.date)).size;
      const window = 30;
      return {
        ...h,
        streak: streakFor(h.id, store.habitLogs),
        todayValue: todayLog?.value ?? 0,
        todayDone: (todayLog?.value ?? 0) >= h.targetPerDay,
        completionRate: Math.round((doneDays / window) * 100),
        goal: h.goalId ? store.goals.find((g) => g.id === h.goalId) ?? null : null,
        area: h.lifeAreaId ? store.spheres.find((s) => s.id === h.lifeAreaId) ?? null : null,
      };
    });
  return NextResponse.json({ habits, today });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "create");

  if (action === "create") {
    const title = String(body.title ?? "").trim();
    if (!title) return NextResponse.json({ error: "title" }, { status: 400 });
    const store = await updateStore((s) => {
      const t = now();
      const nodeId = id();
      s.nodes.unshift({
        id: nodeId,
        kind: "habit",
        title,
        metadata: {},
        salience: 0.7,
        createdAt: t,
        updatedAt: t,
        sphereId: body.lifeAreaId ? String(body.lifeAreaId) : undefined,
      });
      const habit: Habit = {
        id: id(),
        nodeId,
        title,
        targetPerDay: Number(body.targetPerDay) || 1,
        unit: body.unit ? String(body.unit) : undefined,
        streak: 0,
        active: true,
        frequency: body.frequency === "weekly" ? "weekly" : "daily",
        goalId: body.goalId ? String(body.goalId) : undefined,
        lifeAreaId: body.lifeAreaId ? String(body.lifeAreaId) : undefined,
      };
      s.habits.unshift(habit);
    });
    return NextResponse.json({ habits: store.habits.filter((h) => h.active && !h.archived) });
  }

  if (action === "log") {
    const habitId = String(body.habitId ?? "");
    const date = String(body.date ?? todayKey());
    const value = body.value != null ? Number(body.value) : 1;
    const store = await updateStore((s) => {
      const h = s.habits.find((x) => x.id === habitId);
      if (!h) return;
      const existing = s.habitLogs.find((l) => l.habitId === habitId && l.date === date);
      if (existing) existing.value = value;
      else
        s.habitLogs.push({
          id: id(),
          habitId,
          date,
          value,
          createdAt: now(),
        });
      h.streak = streakFor(habitId, s.habitLogs);
    });
    return NextResponse.json({ ok: true, habits: store.habits });
  }

  if (action === "update") {
    const store = await updateStore((s) => {
      const h = s.habits.find((x) => x.id === body.id);
      if (!h) return;
      if (body.title != null) h.title = String(body.title);
      if (body.goalId !== undefined) h.goalId = body.goalId || undefined;
      if (body.lifeAreaId !== undefined) h.lifeAreaId = body.lifeAreaId || undefined;
      if (body.frequency != null) h.frequency = body.frequency === "weekly" ? "weekly" : "daily";
      if (body.targetPerDay != null) h.targetPerDay = Number(body.targetPerDay) || 1;
    });
    return NextResponse.json({ habits: store.habits });
  }

  if (action === "archive") {
    const store = await updateStore((s) => {
      const h = s.habits.find((x) => x.id === body.id);
      if (h) {
        h.archived = true;
        h.active = false;
      }
    });
    return NextResponse.json({ habits: store.habits.filter((h) => h.active && !h.archived) });
  }

  if (action === "delete") {
    const store = await updateStore((s) => {
      s.habits = s.habits.filter((h) => h.id !== body.id);
      s.habitLogs = s.habitLogs.filter((l) => l.habitId !== body.id);
    });
    return NextResponse.json({ habits: store.habits });
  }

  return NextResponse.json({ error: "unknown" }, { status: 400 });
}
