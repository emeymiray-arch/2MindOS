"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ActionMode, ActionOption, PageToolbar } from "@/components/ui/PageToolbar";
import type { DailyTaskItem, TaskPriority } from "@/lib/types";

type TaskView = DailyTaskItem & {
  effectivePriority?: TaskPriority;
  chain?: { area?: string; goal?: string; phase?: string; week?: string };
};

function shiftDate(iso: string, delta: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function TodayInner() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [tasks, setTasks] = useState<TaskView[]>([]);
  const [load, setLoad] = useState({ percent: 0, must: 0, should: 0, optional: 0 });
  const [mode, setMode] = useState<ActionMode>(null);
  const [edit, setEdit] = useState<{
    id: string;
    title: string;
    priority: TaskPriority;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [animKey, setAnimKey] = useState(0);

  const loadData = useCallback(async (d: string) => {
    const res = await fetch(`/api/tasks?date=${d}&month=${d.slice(0, 7)}`);
    const data = await res.json();
    if (!res.ok) {
      setError(String(data.error ?? res.status));
      return;
    }
    setTasks(data.tasks ?? []);
    setLoad(data.load ?? { percent: 0, must: 0, should: 0, optional: 0 });
    setError("");
  }, []);

  useEffect(() => {
    loadData(date);
  }, [date, loadData]);

  async function run(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const { apiPost } = await import("@/lib/client-api");
      const result = await apiPost("/api/tasks", { ...body, date });
      if (!result.ok && result.error) setError(result.error);
      await loadData(date);
    } catch {
      setError("Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  }

  const groups: { key: TaskPriority; label: string; tone: string }[] = [
    { key: "must", label: "Must", tone: "#ff453a" },
    { key: "should", label: "Should", tone: "#ff9f0a" },
    { key: "optional", label: "Optional", tone: "#30d158" },
  ];

  const byPriority = useMemo(() => {
    const map: Record<TaskPriority, TaskView[]> = { must: [], should: [], optional: [] };
    for (const t of tasks) {
      const p = (t.effectivePriority ?? t.priority ?? "should") as TaskPriority;
      map[p].push(t);
    }
    return map;
  }, [tasks]);

  const options: ActionOption[] = tasks.map((t) => ({
    id: t.id,
    label: t.title,
    group: t.chain?.goal || "Task",
  }));

  return (
    <div className="fade-in mx-auto max-w-2xl space-y-5 pb-10">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl">Today</h1>
        <Link href="/week" className="text-[13px] font-semibold text-[var(--ink-soft)]">
          Week →
        </Link>
      </div>

      <div className="card flex items-center justify-between gap-3 p-3">
        <button
          type="button"
          className="btn btn-soft"
          onClick={() => {
            setDate((d) => shiftDate(d, -1));
            setAnimKey((k) => k + 1);
          }}
        >
          ←
        </button>
        <div key={animKey} className="date-enter text-center">
          <p className="text-[15px] font-semibold capitalize">
            {new Date(date + "T12:00:00").toLocaleDateString("ru-RU", {
              weekday: "short",
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-soft"
          onClick={() => {
            setDate((d) => shiftDate(d, 1));
            setAnimKey((k) => k + 1);
          }}
        >
          →
        </button>
      </div>

      <div className={`card p-4 ${load.percent > 100 ? "border-[var(--bad)]" : ""}`}>
        <p className="text-[12px] font-semibold text-[var(--ink-faint)]">Daily load</p>
        <p
          className={`font-display text-3xl tabular-nums ${
            load.percent > 100 ? "text-[var(--bad)]" : ""
          }`}
        >
          {load.percent}%
        </p>
        {load.percent > 100 ? (
          <p className="mt-1 text-[13px] text-[var(--bad)]">
            Перегруз — перенеси, сделай optional или оставь на неделю
          </p>
        ) : null}
      </div>

      {error ? <p className="text-[13px] text-[var(--bad)]">{error}</p> : null}

      <div key={animKey} className="date-enter space-y-5">
        {groups.map((g) => (
          <section key={g.key} className="space-y-2">
            <p
              className="text-[12px] font-semibold uppercase tracking-[0.06em]"
              style={{ color: g.tone }}
            >
              {g.label}
            </p>
            <div className="card overflow-hidden">
              <div className="task-list">
                {byPriority[g.key].length === 0 ? (
                  <p className="p-4 text-[13px] text-[var(--ink-faint)]">—</p>
                ) : (
                  byPriority[g.key].map((t) => (
                    <div key={t.id} className="task-row flex-col items-stretch !gap-1">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          className={`check ${t.done ? "check-on" : "check-off"}`}
                          disabled={busy}
                          onClick={() =>
                            run({
                              action: "toggle",
                              id: t.id,
                              stageId: t.stageId,
                              done: !t.done,
                            })
                          }
                        >
                          {t.done ? "✓" : "×"}
                        </button>
                        <p className="item-title min-w-0 flex-1">{t.title}</p>
                      </div>
                      {(t.chain?.goal || t.chain?.phase) && (
                        <p className="pl-8 text-[11px] text-[var(--ink-faint)]">
                          {[t.chain.area, t.chain.goal, t.chain.phase].filter(Boolean).join(" → ")}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        ))}
      </div>

      {edit && (
        <div className="edit-sheet">
          <input
            value={edit.title}
            autoFocus
            onChange={(e) => setEdit({ ...edit, title: e.target.value })}
          />
          <select
            value={edit.priority}
            onChange={(e) => setEdit({ ...edit, priority: e.target.value as TaskPriority })}
          >
            <option value="must">Must</option>
            <option value="should">Should</option>
            <option value="optional">Optional</option>
          </select>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-ink"
              disabled={busy}
              onClick={async () => {
                if (edit.id === "new") {
                  await run({
                    action: "add",
                    title: edit.title.trim(),
                    priority: edit.priority,
                  });
                } else {
                  await run({
                    action: "update",
                    id: edit.id,
                    title: edit.title,
                    priority: edit.priority,
                  });
                }
                setEdit(null);
              }}
            >
              +
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setEdit(null)}>
              ×
            </button>
          </div>
        </div>
      )}

      <PageToolbar
        mode={mode}
        onMode={(m) => {
          setMode(m);
          setEdit(null);
        }}
        options={options}
        onPick={async (id, action) => {
          const t = tasks.find((x) => x.id === id);
          if (!t) return;
          if (action === "edit") {
            setEdit({
              id: t.id,
              title: t.title,
              priority: (t.effectivePriority ?? t.priority ?? "should") as TaskPriority,
            });
            setMode(null);
            return;
          }
          if (action === "archive") await run({ action: "archive", id });
          else await run({ action: "delete", id });
          setMode(null);
        }}
        onAdd={() => {
          setMode(null);
          setEdit({ id: "new", title: "", priority: "should" });
        }}
      />
    </div>
  );
}

export default function TodayPage() {
  return (
    <Suspense fallback={<div className="text-[var(--ink-faint)]">…</div>}>
      <TodayInner />
    </Suspense>
  );
}
