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
}: {
  task: TaskRowData;
  onToggle?: (id: string, done: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(task.done);

  async function toggle() {
    if (busy) return;
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
    if (next) toast("Готово", "ok");
  }

  const hasContext = Boolean(
    task.provenance?.goalTitle || task.provenance?.planTitle || task.provenance?.moduleTitle
  );

  return (
    <div className="border-b border-[var(--line)] last:border-0">
      <div className="flex items-start gap-3 py-3.5">
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
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => hasContext && setOpen((v) => !v)}
        >
          <p className={`text-[15px] font-semibold ${done ? "opacity-40 line-through" : ""}`}>
            {task.title}
          </p>
        </button>
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
