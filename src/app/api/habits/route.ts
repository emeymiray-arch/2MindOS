import { apiError, apiJson } from "@/lib/api-response";
import { parseValue, readJson, validationErrorResponse } from "@/lib/api-validate";
import { id, now, todayKey } from "@/lib/id";
import { habitSchemas } from "@/lib/schemas/habits";
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
  return apiJson({ habits, today });
}

export async function POST(request: Request) {
  try {
    const raw = await readJson(request);
    const action = String((raw as { action?: string } | null)?.action ?? "create");

    if (action === "create") {
      const data = parseValue(raw, habitSchemas.create);
      const store = await updateStore((s) => {
        const t = now();
        const nodeId = id();
        s.nodes.unshift({
          id: nodeId,
          kind: "habit",
          title: data.title,
          metadata: {},
          salience: 0.7,
          createdAt: t,
          updatedAt: t,
          sphereId: data.lifeAreaId,
        });
        const habit: Habit = {
          id: id(),
          nodeId,
          title: data.title,
          targetPerDay: data.targetPerDay || 1,
          unit: data.unit,
          streak: 0,
          active: true,
          frequency: data.frequency === "weekly" ? "weekly" : "daily",
          goalId: data.goalId,
          lifeAreaId: data.lifeAreaId,
        };
        s.habits.unshift(habit);
      });
      return apiJson({ habits: store.habits.filter((h) => h.active && !h.archived) });
    }

    if (action === "log") {
      const data = parseValue(raw, habitSchemas.log);
      const date = data.date ?? todayKey();
      const store = await updateStore((s) => {
        const h = s.habits.find((x) => x.id === data.habitId);
        if (!h) return;
        const existing = s.habitLogs.find((l) => l.habitId === data.habitId && l.date === date);
        if (existing) existing.value = data.value;
        else
          s.habitLogs.push({
            id: id(),
            habitId: data.habitId,
            date,
            value: data.value,
            createdAt: now(),
          });
        h.streak = streakFor(data.habitId, s.habitLogs);
      });
      return apiJson({ ok: true, habits: store.habits });
    }

    if (action === "update") {
      const data = parseValue(raw, habitSchemas.update);
      const store = await updateStore((s) => {
        const h = s.habits.find((x) => x.id === data.id);
        if (!h) return;
        if (data.title != null) h.title = data.title;
        if (data.goalId !== undefined) h.goalId = data.goalId;
        if (data.lifeAreaId !== undefined) h.lifeAreaId = data.lifeAreaId;
        if (data.frequency != null) h.frequency = data.frequency;
        if (data.targetPerDay != null) h.targetPerDay = data.targetPerDay;
        if (data.active != null) h.active = data.active;
      });
      return apiJson({ habits: store.habits });
    }

    if (action === "archive") {
      const data = parseValue(raw, habitSchemas.archive);
      const store = await updateStore((s) => {
        const h = s.habits.find((x) => x.id === data.id);
        if (h) {
          h.archived = true;
          h.active = false;
        }
      });
      return apiJson({ habits: store.habits.filter((h) => h.active && !h.archived) });
    }

    if (action === "delete") {
      const data = parseValue(raw, habitSchemas.delete);
      const store = await updateStore((s) => {
        s.habits = s.habits.filter((h) => h.id !== data.id);
        s.habitLogs = s.habitLogs.filter((l) => l.habitId !== data.id);
      });
      return apiJson({ habits: store.habits });
    }

    return apiJson({ error: "unknown" }, { status: 400 });
  } catch (e) {
    return validationErrorResponse(e) ?? apiError(e, "save failed");
  }
}
