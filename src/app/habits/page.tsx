"use client";

import { useCallback, useEffect, useState } from "react";
import { ActionMode, ActionOption, PageToolbar } from "@/components/ui/PageToolbar";

type HabitRow = {
  id: string;
  title: string;
  frequency?: string;
  streak: number;
  todayDone: boolean;
  completionRate: number;
  goal: { title: string } | null;
  area: { name: string; emoji?: string } | null;
};

export default function HabitsPage() {
  const [habits, setHabits] = useState<HabitRow[]>([]);
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<ActionMode>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/habits");
    const data = await res.json();
    setHabits(data.habits ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const { apiPost } = await import("@/lib/client-api");
      const result = await apiPost("/api/habits", body);
      if (!result.ok && result.error) setError(result.error);
      await load();
    } catch {
      setError("Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  }

  const options: ActionOption[] = habits.map((h) => ({
    id: h.id,
    label: h.title,
    group: h.frequency === "weekly" ? "Weekly" : "Daily",
  }));

  return (
    <div className="fade-in mx-auto max-w-2xl space-y-10 pb-16">
      <h1 className="font-display text-3xl">Habits</h1>
      {error ? <p className="text-[13px] text-[var(--ink-soft)]">{error}</p> : null}

      <div className="card flex gap-2 p-4">
        <input
          className="min-w-0 flex-1"
          value={title}
          disabled={busy}
          placeholder="Habit"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && title.trim()) {
              post({ action: "create", title: title.trim() });
              setTitle("");
            }
          }}
        />
        <button
          type="button"
          className="btn btn-ink"
          disabled={busy || !title.trim()}
          onClick={() => {
            post({ action: "create", title: title.trim() });
            setTitle("");
          }}
        >
          +
        </button>
      </div>

      <div className="space-y-3">
        {habits.map((h) => (
          <div key={h.id} className="card flex items-center gap-3 p-4">
            <button
              type="button"
              className={`check ${h.todayDone ? "check-on" : "check-off"}`}
              disabled={busy}
              onClick={() =>
                post({
                  action: "log",
                  habitId: h.id,
                  value: h.todayDone ? 0 : 1,
                })
              }
            >
              {h.todayDone ? "✓" : "×"}
            </button>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{h.title}</p>
              <p className="text-[12px] text-[var(--ink-faint)]">
                streak {h.streak} · {h.completionRate}% / 30d
                {h.goal ? ` · ${h.goal.title}` : ""}
              </p>
            </div>
          </div>
        ))}
      </div>

      <PageToolbar
        mode={mode}
        onMode={setMode}
        options={options}
        onPick={async (id, action) => {
          if (action === "archive") await post({ action: "archive", id });
          else if (action === "delete") await post({ action: "delete", id });
          setMode(null);
        }}
      />
    </div>
  );
}
