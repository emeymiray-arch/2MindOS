"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ActionMode, ActionOption, PageToolbar } from "@/components/ui/PageToolbar";
import { formatDeadline } from "@/lib/format";
import type { Goal, GoalStage } from "@/lib/types";

type GoalView = Goal & {
  analytics?: { total: number; done: number; open: number; overdue: number; progress: number };
};

export default function GoalsPage() {
  const [goals, setGoals] = useState<GoalView[]>([]);
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [stageDraft, setStageDraft] = useState<{ goalId: string; title: string; end: string } | null>(
    null
  );
  const [mode, setMode] = useState<ActionMode>(null);
  const [edit, setEdit] = useState<{
    kind: "goal" | "stage";
    goalId: string;
    stageId?: string;
    title: string;
    deadline: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/goals");
    const data = await res.json();
    setGoals(data.goals ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const { apiPost } = await import("@/lib/client-api");
      const result = await apiPost("/api/goals", body);
      if (!result.ok && result.error) setError(result.error);
      await load();
    } catch {
      setError("Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  }

  function stagesOf(g: GoalView): GoalStage[] {
    return (g.stages ?? []).filter((s) => !s.archived);
  }

  const options: ActionOption[] = useMemo(() => {
    const list: ActionOption[] = [];
    for (const g of goals) {
      list.push({ id: `goal:${g.id}`, label: g.title, group: "Цель" });
      for (const st of stagesOf(g)) {
        list.push({ id: `stage:${g.id}:${st.id}`, label: st.title, group: g.title });
      }
    }
    return list;
  }, [goals]);

  async function onPick(id: string, action: Exclude<ActionMode, null>) {
    if (id.startsWith("goal:")) {
      const goalId = id.slice(5);
      const g = goals.find((x) => x.id === goalId);
      if (!g) return;
      if (action === "edit") {
        setEdit({ kind: "goal", goalId, title: g.title, deadline: g.deadline ?? "" });
        setMode(null);
        return;
      }
      if (action === "archive") await post({ action: "archive", id: goalId });
      else await post({ action: "delete", id: goalId });
      setMode(null);
      return;
    }
    if (id.startsWith("stage:")) {
      const [, goalId, stageId] = id.split(":");
      const g = goals.find((x) => x.id === goalId);
      const st = g?.stages.find((x) => x.id === stageId);
      if (!g || !st) return;
      if (action === "edit") {
        setEdit({
          kind: "stage",
          goalId,
          stageId,
          title: st.title,
          deadline: st.deadlineEnd ?? "",
        });
        setMode(null);
        return;
      }
      if (action === "archive") await post({ action: "archiveStage", goalId, stageId });
      else await post({ action: "deleteStage", goalId, stageId });
      setMode(null);
    }
  }

  return (
    <div className="fade-in mx-auto max-w-3xl space-y-5 pb-8">
      <h1 className="font-display text-3xl">Цели</h1>

      {error && <p className="text-[13px] text-[var(--bad)]">{error}</p>}

      <div className="card flex flex-wrap gap-2 p-3">
        <input
          className="min-w-[140px] flex-1"
          value={title}
          disabled={busy}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input type="date" value={deadline} disabled={busy} onChange={(e) => setDeadline(e.target.value)} />
        <button
          type="button"
          className="btn btn-ink"
          disabled={busy}
          onClick={() => {
            if (!title.trim()) return;
            post({ action: "create", title, deadline: deadline || undefined });
            setTitle("");
            setDeadline("");
          }}
        >
          +
        </button>
      </div>

      <div className="space-y-3">
        {goals.map((g) => {
          const a = g.analytics;
          const stages = stagesOf(g);
          return (
            <article key={g.id} className="card p-5">
              <div className="flex items-start justify-between gap-2">
                <h2 className="item-title text-[18px]">{g.title}</h2>
                <button
                  type="button"
                  className="icon-btn shrink-0"
                  onClick={() => setStageDraft({ goalId: g.id, title: "", end: "" })}
                >
                  +
                </button>
              </div>

              <ul className="mt-3 space-y-1">
                {stages.map((st) => (
                  <li key={st.id} className="task-row !px-1">
                    <button
                      type="button"
                      className={`check ${st.done ? "check-on" : "check-off"}`}
                      disabled={busy}
                      onClick={() =>
                        post({
                          action: "toggleStage",
                          goalId: g.id,
                          stageId: st.id,
                          done: !st.done,
                        })
                      }
                    >
                      {st.done ? "✓" : "×"}
                    </button>
                    <p className="item-title min-w-0 flex-1">{st.title}</p>
                  </li>
                ))}
              </ul>

              {stageDraft?.goalId === g.id && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <input
                    className="min-w-[120px] flex-1"
                    value={stageDraft.title}
                    autoFocus
                    onChange={(e) => setStageDraft({ ...stageDraft, title: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && stageDraft.title.trim()) {
                        post({
                          action: "addStage",
                          goalId: g.id,
                          title: stageDraft.title,
                          deadlineStart: stageDraft.end || undefined,
                          deadlineEnd: stageDraft.end || undefined,
                        });
                        setStageDraft(null);
                      }
                      if (e.key === "Escape") setStageDraft(null);
                    }}
                  />
                  <input
                    type="date"
                    value={stageDraft.end}
                    onChange={(e) => setStageDraft({ ...stageDraft, end: e.target.value })}
                  />
                  <button
                    type="button"
                    className="btn btn-ink"
                    onClick={() => {
                      if (!stageDraft.title.trim()) return;
                      post({
                        action: "addStage",
                        goalId: g.id,
                        title: stageDraft.title,
                        deadlineStart: stageDraft.end || undefined,
                        deadlineEnd: stageDraft.end || undefined,
                      });
                      setStageDraft(null);
                    }}
                  >
                    +
                  </button>
                </div>
              )}

              <div className="mt-4 space-y-2">
                {a && (
                  <p className="analytics-line">
                    {g.deadline ? (
                      <>
                        <span className="meta-quiet">{formatDeadline(g.deadline)}</span>
                        {" · "}
                      </>
                    ) : null}
                    <strong>{a.done}</strong>/{a.total}
                    {a.overdue > 0 && (
                      <>
                        {" · "}просрочено <strong>{a.overdue}</strong>
                      </>
                    )}
                    {" · "}
                    <strong>{g.progress}%</strong>
                  </p>
                )}
                <div className="meter">
                  <span style={{ width: `${g.progress}%` }} />
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {edit && (
        <div className="edit-sheet">
          <input
            value={edit.title}
            autoFocus
            onChange={(e) => setEdit({ ...edit, title: e.target.value })}
          />
          <input
            type="date"
            value={edit.deadline}
            onChange={(e) => setEdit({ ...edit, deadline: e.target.value })}
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-ink"
              onClick={async () => {
                if (edit.kind === "goal") {
                  await post({
                    action: "update",
                    id: edit.goalId,
                    title: edit.title,
                    deadline: edit.deadline || undefined,
                  });
                } else {
                  await post({
                    action: "updateStage",
                    goalId: edit.goalId,
                    stageId: edit.stageId,
                    title: edit.title,
                    deadlineStart: edit.deadline || undefined,
                    deadlineEnd: edit.deadline || undefined,
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
        onPick={onPick}
      />
    </div>
  );
}
