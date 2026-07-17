import { NextResponse } from "next/server";
import { getTodayVitals } from "@/lib/oracle";
import { getStore, updateStore } from "@/lib/store";
import { id, now, todayKey } from "@/lib/id";

export async function GET() {
  const store = await getStore();
  const vitals = getTodayVitals(store);
  return NextResponse.json({
    vitals,
    habits: store.habits,
    habitLogs: store.habitLogs.filter((l) => l.date === todayKey()),
    goals: store.goals.filter((g) => g.active),
    settings: store.settings,
    finance: store.finance,
    recentThoughts: store.nodes
      .filter((n) => ["thought", "idea", "dream", "wish", "goal"].includes(n.kind))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 8),
    oracle: store.oracleMessages.slice(-1)[0] ?? null,
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const store = await updateStore((s) => {
    const vitals = getTodayVitals(s);

    if (typeof body.waterDelta === "number") {
      vitals.waterMl = Math.max(0, vitals.waterMl + body.waterDelta);
    }
    if (typeof body.waterMl === "number") vitals.waterMl = body.waterMl;
    if (typeof body.sleepHours === "number") vitals.sleepHours = body.sleepHours;
    if (typeof body.mood === "number") vitals.mood = body.mood;
    if (body.prayer && typeof body.prayer === "string") {
      const key = body.prayer as keyof typeof vitals.prayers;
      if (key in vitals.prayers) {
        vitals.prayers[key] = Boolean(body.value ?? true);
      }
    }
    if (body.habitId) {
      const habitId = String(body.habitId);
      const day = todayKey();
      const already = s.habitLogs.some((l) => l.habitId === habitId && l.date === day);
      if (!already) {
        s.habitLogs.push({
          id: id(),
          habitId,
          date: day,
          value: Number(body.value ?? 1),
          createdAt: now(),
        });
        const habit = s.habits.find((h) => h.id === habitId);
        if (habit) habit.streak += 1;
      }
    }
    if (typeof body.mit === "string") s.settings.mit = body.mit;
    if (body.goalId && typeof body.progress === "number") {
      const g = s.goals.find((x) => x.id === body.goalId);
      if (g) g.progress = body.progress;
    }

    const done = Object.values(vitals.prayers).filter(Boolean).length;
    const waterRatio = Math.min(1, vitals.waterMl / Math.max(1, vitals.waterTargetMl));
    const sleepRatio = Math.min(
      1,
      vitals.sleepHours / Math.max(0.1, vitals.sleepTargetHours)
    );
    vitals.healthScore = Math.round(waterRatio * 35 + sleepRatio * 40 + (done / 5) * 25);
  });

  return NextResponse.json({ vitals: getTodayVitals(store), habits: store.habits });
}
