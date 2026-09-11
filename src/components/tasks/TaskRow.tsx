"use client";

import Link from "next/link";
import { useState } from "react";
import { apiPost } from "@/lib/client-api";
import { toast } from "@/components/ui/Toast";

export type TaskRowData = {
  id: string;
  title: string;
  done: boolean;
  date?: string;
  provenance?: {
    why: string;
    goalId?: string;
    goalTitle?: string;
    planTitle?: string;
    phaseTitle?: string;
    moduleTitle?: string;
    deadline?: string;
    source: string;
  };
};

export function TaskRow({
  task,
  onToggle,
  onChanged,
}: {
  task: TaskRowData;
  onToggle?: (id: string, done: boolean) => void;
  onChanged?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(task.done);
  const [title, setTitle] = useState(task.title);
  const [editing, setEditing] = useState(false);

  async function toggle() {
    if (busy || editing) return;
    setBusy(true);
    const next = !done;
    setDone(next);
    const res = await apiPost("/api/tasks", {
      action: "toggle",
      id: task.id,
      done: next,
      date: task.date,
    });
    setBusy(false);
    if (!res.ok) {
      setDone(!next);
      toast(res.error ?? "Не удалось сохранить", "warn");
      return;
    }
    onToggle?.(task.id, next);
    onChanged?.();
    if (next) toast("Готово", "ok");
  }

  async function saveTitle() {
    const next = title.trim();
    if (!next || next === task.title) {
      setTitle(task.title);
      setEditing(false);
      return;
    }
    setBusy(true);
    const res = await apiPost("/api/tasks", {
      action: "update",
      id: task.id,
      title: next,
      date: task.date,
    });
    setBusy(false);
    if (!res.ok) {
      setTitle(task.title);
      toast(res.error ?? "Не удалось изменить", "warn");
      setEditing(false);
      return;
    }
    setEditing(false);
    toast("Изменила", "ok");
    onChanged?.();
  }

  async function remove() {
    if (busy) return;
    if (!window.confirm(`Удалить «${title}»?`)) return;
    setBusy(true);
    const res = await apiPost("/api/tasks", {
      action: "delete",
      id: task.id,
      date: task.date,
    });
    setBusy(false);
    if (!res.ok) {
      toast(res.error ?? "Не удалось удалить", "warn");
      return;
    }
    toast("Удалила", "ok");
    onChanged?.();
  }

  const hasContext = Boolean(
    task.provenance?.goalTitle || task.provenance?.planTitle || task.provenance?.moduleTitle
  );

  return (
    <div className="border-b border-[var(--line)] last:border-0">
      <div className="flex items-start gap-2 py-3.5">
        <button
          type="button"
          aria-label={done ? "Снять выполнение" : "Выполнить"}
          disabled={busy}
          onClick={() => void toggle()}
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
            done
              ? "check-pop border-[var(--accent)] bg-[var(--accent)] text-white"
              : "border-[var(--line-strong)] bg-white hover:border-[var(--accent)]"
          }`}
        >
          {done ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
              <path
                d="M2.5 6.2L4.8 8.5L9.5 3.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : null}
        </button>

        {editing ? (
          <form
            className="min-w-0 flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              void saveTitle();
            }}
          >
            <input
              className="field w-full py-1 text-[15px] font-semibold"
              value={title}
              autoFocus
              disabled={busy}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => void saveTitle()}
            />
          </form>
        ) : (
          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            onClick={() => hasContext && setOpen((v) => !v)}
            onDoubleClick={() => setEditing(true)}
          >
            <p className={`text-[15px] font-semibold ${done ? "opacity-40 line-through" : ""}`}>
              {title}
            </p>
          </button>
        )}

        <div className="flex shrink-0 items-center gap-1 pt-0.5">
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-[12px] font-bold text-[var(--ink-soft)] hover:bg-[var(--bg-muted)] hover:text-[var(--accent)]"
            disabled={busy}
            onClick={() => setEditing(true)}
            aria-label="Изменить"
          >
            ✎
          </button>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-[12px] font-bold text-[var(--ink-soft)] hover:bg-[var(--c-pink-soft)] hover:text-[var(--behind)]"
            disabled={busy}
            onClick={() => void remove()}
            aria-label="Удалить"
          >
            ×
          </button>
        </div>
      </div>
      {open && hasContext && task.provenance ? (
        <div className="mb-3 ml-9 rounded-[var(--radius-sm)] bg-[var(--c-blue-soft)] px-3.5 py-3 text-[13px] font-medium">
          <ul className="space-y-1.5">
            {task.provenance.goalTitle ? (
              <li>
                {task.provenance.goalId ? (
                  <Link
                    href={`/goals/${task.provenance.goalId}`}
                    className="font-bold text-[var(--accent)]"
                  >
                    {task.provenance.goalTitle}
                  </Link>
                ) : (
                  task.provenance.goalTitle
                )}
              </li>
            ) : null}
            {task.provenance.planTitle ? <li>{task.provenance.planTitle}</li> : null}
            {task.provenance.moduleTitle ? <li>{task.provenance.moduleTitle}</li> : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
