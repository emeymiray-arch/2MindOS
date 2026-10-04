"use client";

import Link from "next/link";
import { createContext, useContext, useState } from "react";
import { apiPost } from "@/lib/client-api";
import { toast } from "@/components/ui/Toast";

type BlockMode = "none" | "edit" | "delete";

const BlockModeContext = createContext<BlockMode>("none");

function PencilIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M10.8 2.7l2.5 2.5-7.6 7.6-3.2.7.7-3.2 7.6-7.6z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M2.8 4.3h10.4M6.3 4.3V2.8h3.4v1.5M4.2 4.3l.6 8.9h6.4l.6-8.9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Wraps a list of TaskRows; one edit/delete toggle pair sits in the block's bottom corner. */
export function TaskBlock({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<BlockMode>("none");
  const toggle = (next: BlockMode) => setMode((m) => (m === next ? "none" : next));

  return (
    <BlockModeContext.Provider value={mode}>
      <div className="flex flex-1 flex-col">
        {children}
        <div className="mt-auto flex items-center justify-end gap-1 pt-2">
          {mode !== "none" ? (
            <span className="mr-1 text-[11px] font-medium text-[var(--ink-faint)]">
              {mode === "edit" ? "нажми на задачу, чтобы изменить" : "нажми на задачу, чтобы удалить"}
            </span>
          ) : null}
          <button
            type="button"
            aria-label="Режим изменения"
            aria-pressed={mode === "edit"}
            onClick={() => toggle("edit")}
            className={`flex h-8 w-8 items-center justify-center rounded-full border transition ${
              mode === "edit"
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                : "border-[var(--line)] text-[var(--ink-soft)] hover:text-[var(--accent)]"
            }`}
          >
            <PencilIcon />
          </button>
          <button
            type="button"
            aria-label="Режим удаления"
            aria-pressed={mode === "delete"}
            onClick={() => toggle("delete")}
            className={`flex h-8 w-8 items-center justify-center rounded-full border transition ${
              mode === "delete"
                ? "border-[var(--behind)] bg-[var(--c-pink-soft)] text-[var(--behind)]"
                : "border-[var(--line)] text-[var(--ink-soft)] hover:text-[var(--behind)]"
            }`}
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    </BlockModeContext.Provider>
  );
}

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
  const mode = useContext(BlockModeContext);

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
          className={`mt-0.5 flex h-[1.15rem] w-[1.15rem] shrink-0 items-center justify-center rounded-full border transition ${
            done
              ? "check-pop border-[var(--accent)] bg-[var(--accent)] text-white shadow-[0_0_14px_rgba(168,85,247,0.6)]"
              : "border-[var(--line-strong)] bg-[var(--bg-card)] hover:border-[var(--accent)] hover:shadow-[0_0_12px_rgba(168,85,247,0.3)]"
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
            disabled={busy}
            className={`min-w-0 flex-1 rounded-md text-left transition ${
              mode === "edit"
                ? "underline decoration-dashed decoration-[var(--accent)] underline-offset-4"
                : mode === "delete"
                  ? "hover:text-[var(--behind)]"
                  : ""
            }`}
            onClick={() => {
              if (mode === "edit") setEditing(true);
              else if (mode === "delete") void remove();
              else if (hasContext) setOpen((v) => !v);
            }}
            onDoubleClick={() => setEditing(true)}
          >
            <p className={`text-[15px] font-semibold ${done ? "opacity-40 line-through" : ""}`}>
              {title}
            </p>
          </button>
        )}
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
