"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/client-api";
import { toast } from "@/components/ui/Toast";

type HabitRow = {
  id: string;
  title: string;
  frequency?: string;
  streak: number;
  todayDone: boolean;
  completionRate: number;
};

export default function HabitsPage() {
  const [habits, setHabits] = useState<HabitRow[]>([]);
  const [title, setTitle] = useState("");

  const load = useCallback(async () => {
    const res = await apiGet("/api/habits");
    if (res.ok) setHabits((res.data.habits as HabitRow[]) ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    const res = await apiPost("/api/habits", { action: "create", title: t });
    if (!res.ok) {
      toast(res.error ?? "Ошибка", "warn");
      return;
    }
    setTitle("");
    toast("Привычка добавлена", "ok");
    await load();
  }

  async function toggle(h: HabitRow) {
    await apiPost("/api/habits", {
      action: "log",
      habitId: h.id,
      value: h.todayDone ? 0 : 1,
    });
    await load();
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-[34px]">Привычки</h1>
      </header>

      <form onSubmit={create} className="surface flex gap-2 p-4">
        <input
          className="field min-w-0 flex-1"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Новая привычка"
        />
        <button type="submit" className="btn btn-primary shrink-0">
          +
        </button>
      </form>

      <div className="space-y-2.5">
        {habits.map((h, i) => {
          const colors = ["var(--c-green)", "var(--c-blue)", "var(--c-orange)", "var(--c-violet)"];
          const c = colors[i % colors.length];
          return (
            <button
              key={h.id}
              type="button"
              onClick={() => void toggle(h)}
              className="surface flex w-full items-center gap-4 p-4 text-left transition hover:shadow-[var(--shadow)]"
              style={{
                background: h.todayDone ? "var(--c-green-soft)" : "#fff",
                borderLeft: `4px solid ${h.todayDone ? "var(--ahead)" : c}`,
              }}
            >
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full text-[14px] font-black text-white"
                style={{ background: h.todayDone ? "var(--ahead)" : c }}
              >
                {h.todayDone ? "✓" : "◇"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold">{h.title}</p>
                <p className="mt-0.5 text-[12px] font-semibold" style={{ color: c }}>
                  серия {h.streak} · {h.completionRate}%
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
