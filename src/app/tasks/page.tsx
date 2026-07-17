"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ActionMode, ActionOption, PageToolbar } from "@/components/ui/PageToolbar";
import type { CalendarEvent, DailyTaskItem } from "@/lib/types";

function shiftDate(iso: string, delta: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function monthMatrix(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

async function api(body: Record<string, unknown>) {
  const res = await fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export default function TasksPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [tasks, setTasks] = useState<DailyTaskItem[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [monthEvents, setMonthEvents] = useState<CalendarEvent[]>([]);
  const [tab, setTab] = useState<"tasks" | "calendar">("tasks");
  const [showArchived, setShowArchived] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [mode, setMode] = useState<ActionMode>(null);
  const [edit, setEdit] = useState<{ kind: "task" | "event"; id: string; title: string } | null>(
    null
  );
  const [animKey, setAnimKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7)) - 1;
  const monthKey = date.slice(0, 7);

  const load = useCallback(
    async (d: string, archived = showArchived) => {
      const res = await fetch(
        `/api/tasks?date=${d}&month=${d.slice(0, 7)}${archived ? "&archived=1" : ""}`
      );
      const data = await res.json();
      setTasks(data.tasks ?? []);
      setEvents(data.events ?? []);
      setMonthEvents(data.monthEvents ?? []);
    },
    [showArchived]
  );

  useEffect(() => {
    load(date, showArchived);
  }, [date, load, showArchived]);

  const eventDates = useMemo(() => new Set(monthEvents.map((e) => e.date)), [monthEvents]);

  function go(delta: number) {
    setDate((d) => shiftDate(d, delta));
    setAnimKey((k) => k + 1);
  }

  async function run(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const data = await api({ ...body, date });
      if (data.error) setError(String(data.error));
      await load(date, showArchived);
    } catch {
      setError("Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  }

  const options: ActionOption[] = useMemo(() => {
    if (tab === "calendar") {
      return events.map((e) => ({ id: `event:${e.id}`, label: e.title, group: "Событие" }));
    }
    return tasks.map((t) => ({
      id: `task:${t.id}`,
      label: t.title,
      group: t.goalTitle || "Задача",
    }));
  }, [tab, tasks, events]);

  async function onPick(id: string, action: Exclude<ActionMode, null>) {
    if (id.startsWith("task:")) {
      const taskId = id.slice(5);
      const t = tasks.find((x) => x.id === taskId);
      if (!t) return;
      if (action === "edit") {
        setEdit({ kind: "task", id: taskId, title: t.title });
        setMode(null);
        return;
      }
      if (action === "archive") {
        await run({ action: showArchived ? "unarchive" : "archive", id: taskId });
      } else {
        await run({ action: "delete", id: taskId });
      }
      setMode(null);
      return;
    }
    if (id.startsWith("event:")) {
      const eventId = id.slice(6);
      const e = events.find((x) => x.id === eventId);
      if (!e) return;
      if (action === "edit") {
        setEdit({ kind: "event", id: eventId, title: e.title });
        setMode(null);
        return;
      }
      if (action === "archive") await run({ action: "archiveEvent", id: eventId });
      else await run({ action: "deleteEvent", id: eventId });
      setMode(null);
    }
  }

  const cells = monthMatrix(y, m);

  return (
    <div className="fade-in mx-auto max-w-2xl space-y-5 pb-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl">Задачи</h1>
        <div className="flex gap-2">
          <button type="button" className={`chip ${tab === "tasks" ? "chip-on" : ""}`} onClick={() => setTab("tasks")}>
            Список
          </button>
          <button
            type="button"
            className={`chip ${tab === "calendar" ? "chip-on" : ""}`}
            onClick={() => setTab("calendar")}
          >
            Календарь
          </button>
        </div>
      </div>

      <div className="card flex items-center justify-between gap-3 p-3">
        <button type="button" className="btn btn-soft" onClick={() => go(-1)}>
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
        <button type="button" className="btn btn-soft" onClick={() => go(1)}>
          →
        </button>
      </div>

      {error && <p className="text-[13px] text-[var(--bad)]">{error}</p>}

      {tab === "tasks" ? (
        <div key={`t-${animKey}`} className="date-enter space-y-3">
          <div className="card flex gap-2 p-3">
            <input
              className="min-w-0 flex-1"
              value={newTitle}
              disabled={busy}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTitle.trim()) {
                  run({ action: "add", title: newTitle.trim(), date });
                  setNewTitle("");
                }
              }}
            />
            <button
              type="button"
              className="btn btn-ink"
              disabled={busy}
              onClick={() => {
                if (!newTitle.trim()) return;
                run({ action: "add", title: newTitle.trim(), date });
                setNewTitle("");
              }}
            >
              +
            </button>
          </div>

          <div className="card overflow-hidden">
            <div className="task-list">
              {tasks.map((t) => (
                <div key={t.id} className="task-row">
                  <button
                    type="button"
                    className={`check ${t.done ? "check-on" : "check-off"}`}
                    disabled={busy || showArchived}
                    onClick={() => run({ action: "toggle", id: t.id, stageId: t.stageId, done: !t.done })}
                  >
                    {t.done ? "✓" : "×"}
                  </button>
                  <p className="item-title min-w-0 flex-1">{t.title}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div key={`c-${animKey}`} className="date-enter space-y-4">
          <div className="card p-4">
            <p className="meta-quiet mb-3 text-center">
              {new Date(y, m, 1).toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}
            </p>
            <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-[var(--ink-faint)]">
              {["пн", "вт", "ср", "чт", "пт", "сб", "вс"].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="cal-grid">
              {cells.map((day, i) => {
                if (day == null) return <div key={`e-${i}`} />;
                const iso = `${monthKey}-${String(day).padStart(2, "0")}`;
                const on = iso === date;
                const has = eventDates.has(iso);
                return (
                  <button
                    key={iso}
                    type="button"
                    className={`cal-cell ${on ? "cal-cell-on" : ""} ${has ? "cal-cell-dot" : ""}`}
                    onClick={() => {
                      setDate(iso);
                      setAnimKey((k) => k + 1);
                    }}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card flex gap-2 p-3">
            <input
              className="min-w-0 flex-1"
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && eventTitle.trim()) {
                  run({ action: "addEvent", title: eventTitle.trim(), date });
                  setEventTitle("");
                }
              }}
            />
            <button
              type="button"
              className="btn btn-ink"
              onClick={() => {
                if (!eventTitle.trim()) return;
                run({ action: "addEvent", title: eventTitle.trim(), date });
                setEventTitle("");
              }}
            >
              +
            </button>
          </div>

          <div className="card overflow-hidden">
            <div className="task-list">
              {events.map((e) => (
                <div key={e.id} className="task-row">
                  <p className="item-title">{e.title}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {edit && (
        <div className="edit-sheet">
          <input
            value={edit.title}
            autoFocus
            onChange={(e) => setEdit({ ...edit, title: e.target.value })}
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-ink"
              onClick={async () => {
                if (edit.kind === "task") await run({ action: "update", id: edit.id, title: edit.title });
                else await run({ action: "updateEvent", id: edit.id, title: edit.title });
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
        onPick={onPick}
        extra={
          tab === "tasks" ? (
            <button
              type="button"
              className={`icon-btn ${showArchived ? "icon-btn-on" : ""}`}
              onClick={() => setShowArchived((v) => !v)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 8v13H3V8" />
                <path d="M1 3h22v5H1z" />
                <path d="M10 12h4" />
              </svg>
            </button>
          ) : null
        }
      />
    </div>
  );
}
