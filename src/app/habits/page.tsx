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

  async function remove(h: HabitRow) {
    if (!window.confirm(`Удалить привычку «${h.title}»?`)) return;
    const res = await apiPost("/api/habits", { action: "delete", id: h.id });
    if (!res.ok) {
      toast(res.error ?? "Не удалось удалить", "warn");
      return;
    }
    toast("Удалила", "ok");
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
            <div
              key={h.id}
              className="surface flex w-full items-center gap-3 p-4"
              style={{
                borderLeft: `4px solid ${c}`,
                background: h.todayDone ? `color-mix(in srgb, ${c} 12%, white)` : undefined,
              }}
            >
              <button
                type="button"
                onClick={() => void toggle(h)}
                className="flex min-w-0 flex-1 items-center gap-4 text-left"
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] text-[15px] font-black text-white"
                  style={{ background: c }}
                >
                  {h.todayDone ? "✓" : "◇"}
                </span>
                <span className="min-w-0">
                  <span className="block font-bold">{h.title}</span>
                  <span className="text-[12px] font-semibold" style={{ color: c }}>
                    серия {h.streak} · {Math.round(h.completionRate * 100)}%
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="shrink-0 px-2 text-[18px] font-bold text-[var(--ink-soft)] hover:text-[var(--behind)]"
                onClick={() => void remove(h)}
                aria-label="Удалить"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
