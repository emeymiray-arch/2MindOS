"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ActionMode, ActionOption, PageToolbar } from "@/components/ui/PageToolbar";
import type { Goal, GoalStage, Sphere } from "@/lib/types";

type GoalView = Goal & {
  progress: number;
  area: Sphere | null;
  currentPhase: GoalStage | null;
  weekObjectives: { id: string; title: string; done: boolean }[];
  todayActions: { id: string; title: string; done: boolean }[];
  workPlanId?: string;
  workPlan?: {
    id: string;
    title: string;
    progress: number;
    desiredResult?: string;
    status: string;
  } | null;
};

export default function GoalsClient() {
  const search = useSearchParams();
  const focusId = search.get("id");

  const [goals, setGoals] = useState<GoalView[]>([]);
  const [foundation, setFoundation] = useState<GoalView[]>([]);
  const [development, setDevelopment] = useState<GoalView[]>([]);
  const [later, setLater] = useState<GoalView[]>([]);
  const [areas, setAreas] = useState<Sphere[]>([]);
  const [plan, setPlan] = useState<{ title: string } | null>(null);
  const [selected, setSelected] = useState<GoalView | null>(null);

  const [title, setTitle] = useState("");
  const [areaId, setAreaId] = useState("");
  const [bucket, setBucket] = useState("development");
  const [phaseTitle, setPhaseTitle] = useState("");
  const [mode, setMode] = useState<ActionMode>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [planDraft, setPlanDraft] = useState({
    desiredResult: "",
    why: "",
    startingPoint: "",
    strategy: "",
  });

  const load = useCallback(async () => {
    await fetch("/api/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ensure" }),
    });
    const res = await fetch("/api/goals");
    const data = await res.json();
    setGoals(data.goals ?? []);
    setFoundation(data.foundation ?? []);
    setDevelopment(data.development ?? []);
    setLater(data.later ?? []);
    setAreas(data.areas ?? []);
    setPlan(data.plan ?? null);
    if (focusId) {
      const g = (data.goals ?? []).find((x: GoalView) => x.id === focusId);
      setSelected(g ?? null);
    }
  }, [focusId]);

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
      if (selected) {
        const res = await fetch(`/api/goals?id=${selected.id}`);
        const data = await res.json();
        setSelected(data.goal ?? null);
      }
    } catch {
      setError("Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  }

  const options: ActionOption[] = useMemo(() => {
    const list: ActionOption[] = [];
    for (const g of goals) {
      list.push({ id: `goal:${g.id}`, label: g.title, group: "Goal" });
      for (const st of (g.stages ?? []).filter((s) => !s.archived)) {
        list.push({ id: `phase:${g.id}:${st.id}`, label: st.title, group: g.title });
      }
    }
    return list;
  }, [goals]);

  function Bucket({ label, items }: { label: string; items: GoalView[] }) {
    return (
      <section className="space-y-4">
        <p className="text-[12px] font-medium text-[var(--ink-faint)]">{label}</p>
        {items.length === 0 ? (
          <p className="text-[13px] text-[var(--ink-faint)]">—</p>
        ) : (
          <div className="space-y-2">
            {items.map((g) => (
              <button
                key={g.id}
                type="button"
                className="card block w-full space-y-1 p-4 text-left"
                onClick={() => setSelected(g)}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">
                    {g.area?.emoji ? `${g.area.emoji} ` : ""}
                    {g.title}
                  </span>
                  <span className="tabular-nums text-[var(--ink-soft)]">{g.progress}%</span>
                </div>
                {g.currentPhase ? (
                  <p className="text-[13px] text-[var(--ink-faint)]">Phase · {g.currentPhase.title}</p>
                ) : null}
                {!g.workPlanId && !g.workPlan ? (
                  <p className="text-[12px] text-[var(--ink-faint)]">Plan not created</p>
                ) : null}
                <div className="meter mt-2">
                  <span style={{ width: `${g.progress}%` }} />
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    );
  }

  if (selected) {
    return (
    <div className="fade-in mx-auto max-w-2xl space-y-10 pb-16">
      <button
        type="button"
        className="text-[13px] font-medium text-[var(--ink-faint)]"
        onClick={() => {
          setSelected(null);
          setCreatingPlan(false);
        }}
      >
        ← Goals
      </button>
      <header className="space-y-3">
        <h1 className="font-display text-3xl">{selected.title}</h1>
        <p className="text-[14px] text-[var(--ink-soft)]">
          {selected.area?.name ?? "Life area"}
          {selected.priority ? ` · ${selected.priority}` : ""}
          {selected.deadline ? ` · ${selected.deadline}` : ""}
          {` · ${selected.progress}%`}
        </p>
          {selected.description ? (
            <p className="text-[14px] text-[var(--ink-faint)]">{selected.description}</p>
          ) : null}
          <div className="meter">
            <span style={{ width: `${selected.progress}%` }} />
          </div>
        </header>

        <section className="card space-y-4 p-6">
          <p className="text-[12px] font-medium text-[var(--ink-faint)]">Plan</p>
          {selected.workPlan ? (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <p className="font-semibold">{selected.workPlan.title}</p>
                  <p className="text-[13px] text-[var(--ink-faint)]">
                    {selected.workPlan.progress}% complete
                  </p>
                </div>
                <Link href={`/plans/${selected.workPlan.id}`} className="btn btn-ink">
                  Open Plan
                </Link>
              </div>
              {selected.workPlan.desiredResult ? (
                <p className="text-[14px] text-[var(--ink-soft)]">{selected.workPlan.desiredResult}</p>
              ) : null}
            </>
          ) : creatingPlan ? (
            <div className="space-y-3">
              <p className="text-[13px] text-[var(--ink-soft)]">Plan this goal</p>
              {(
                [
                  ["desiredResult", "Desired Result"],
                  ["why", "Why"],
                  ["startingPoint", "Starting Point"],
                  ["strategy", "Strategy"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block space-y-1">
                  <span className="text-[12px] text-[var(--ink-faint)]">{label}</span>
                  <textarea
                    rows={2}
                    value={planDraft[key]}
                    onChange={(e) => setPlanDraft({ ...planDraft, [key]: e.target.value })}
                  />
                </label>
              ))}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-ink"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      const { apiPost } = await import("@/lib/client-api");
                      const result = await apiPost("/api/work-plans", {
                        action: "create",
                        ownerType: "goal",
                        ownerId: selected.id,
                        title: `Plan: ${selected.title}`,
                        ...planDraft,
                      });
                      if (!result.ok && result.error) setError(String(result.error));
                      else {
                        const plan = result.data.plan as { id?: string } | undefined;
                        if (plan?.id) {
                          window.location.href = `/plans/${plan.id}`;
                          return;
                        }
                      }
                      await load();
                      const res = await fetch(`/api/goals?id=${selected.id}`);
                      const data = await res.json();
                      setSelected(data.goal ?? null);
                      setCreatingPlan(false);
                    } catch {
                      setError("Не удалось создать план");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Create Plan
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setCreatingPlan(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[14px] text-[var(--ink-soft)]">Plan not created</p>
              <button
                type="button"
                className="btn btn-ink"
                onClick={() => setCreatingPlan(true)}
              >
                + Create Plan
              </button>
            </div>
          )}
        </section>

        <section className="space-y-2">
          <p className="text-[12px] font-medium text-[var(--ink-faint)]">Current Phase</p>
          <p className="font-display text-xl">{selected.currentPhase?.title ?? "—"}</p>
        </section>

        <section className="space-y-2">
          <p className="text-[12px] font-medium text-[var(--ink-faint)]">Phases</p>
          {(selected.stages ?? [])
            .filter((s) => !s.archived)
            .map((st) => (
              <div key={st.id} className="card flex items-center gap-3 p-4">
                <button
                  type="button"
                  className={`check ${st.done ? "check-on" : "check-off"}`}
                  disabled={busy}
                  onClick={() =>
                    post({
                      action: "toggleStage",
                      goalId: selected.id,
                      stageId: st.id,
                      done: !st.done,
                    })
                  }
                >
                  {st.done ? "✓" : ""}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{st.title}</p>
                  <p className="text-[12px] text-[var(--ink-faint)]">{st.status ?? "planned"}</p>
                </div>
                {!st.done && st.status !== "active" ? (
                  <button
                    type="button"
                    className="btn btn-soft text-[12px]"
                    disabled={busy}
                    onClick={() =>
                      post({ action: "activateStage", goalId: selected.id, stageId: st.id })
                    }
                  >
                    Activate
                  </button>
                ) : null}
              </div>
            ))}
          {!selected.workPlan ? (
            <div className="flex gap-2">
              <input
                className="min-w-0 flex-1"
                placeholder="Phase"
                value={phaseTitle}
                onChange={(e) => setPhaseTitle(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-ink"
                disabled={busy || !phaseTitle.trim()}
                onClick={() => {
                  post({ action: "addStage", goalId: selected.id, title: phaseTitle.trim() });
                  setPhaseTitle("");
                }}
              >
                +
              </button>
            </div>
          ) : (
            <Link
              href={`/plans/${selected.workPlan.id}`}
              className="text-[13px] font-medium text-[var(--ink-faint)]"
            >
              Manage phases in Plan →
            </Link>
          )}
        </section>

        <section className="space-y-2">
          <p className="text-[12px] font-medium text-[var(--ink-faint)]">This Week</p>
          {(selected.weekObjectives ?? []).length === 0 ? (
            <p className="text-[13px] text-[var(--ink-faint)]">
              <Link href="/week">Задай objective в Week →</Link>
            </p>
          ) : (
            <ul className="space-y-1">
              {selected.weekObjectives.map((o) => (
                <li key={o.id} className="text-[14px]">
                  {o.done ? "✓ " : "○ "}
                  {o.title}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2">
          <p className="text-[12px] font-medium text-[var(--ink-faint)]">Today&apos;s Actions</p>
          {(selected.todayActions ?? []).length === 0 ? (
            <p className="text-[13px] text-[var(--ink-faint)]">
              <Link href="/today">Нет задач · Today →</Link>
            </p>
          ) : (
            <ul className="space-y-1">
              {selected.todayActions.map((t) => (
                <li key={t.id} className="text-[14px]">
                  {t.done ? "✓ " : "○ "}
                  {t.title}
                </li>
              ))}
            </ul>
          )}
        </section>

        {error ? <p className="text-[13px] text-[var(--ink-soft)]">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="fade-in mx-auto max-w-2xl space-y-10 pb-16">
      <header className="space-y-2">
        <h1 className="font-display text-3xl">Goals</h1>
        <p className="text-[15px] text-[var(--ink-soft)]">{plan?.title ?? "6 Month Plan"}</p>
      </header>

      {error ? <p className="text-[13px] text-[var(--ink-soft)]">{error}</p> : null}

      <div className="card flex flex-wrap gap-2 p-3">
        <input
          className="min-w-[120px] flex-1"
          value={title}
          placeholder="Goal"
          disabled={busy}
          onChange={(e) => setTitle(e.target.value)}
        />
        <select value={areaId} onChange={(e) => setAreaId(e.target.value)} disabled={busy}>
          <option value="">Area</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.emoji} {a.name}
            </option>
          ))}
        </select>
        <select value={bucket} onChange={(e) => setBucket(e.target.value)} disabled={busy}>
          <option value="foundation">Foundation</option>
          <option value="development">Development</option>
          <option value="later">Later</option>
        </select>
        <button
          type="button"
          className="btn btn-ink"
          disabled={busy || !title.trim()}
          onClick={() => {
            post({
              action: "create",
              title: title.trim(),
              lifeAreaId: areaId || undefined,
              bucket,
            });
            setTitle("");
          }}
        >
          +
        </button>
      </div>

      <Bucket label="Foundation" items={foundation} />
      <Bucket label="Development" items={development} />
      <Bucket label="Later" items={later} />

      <PageToolbar
        mode={mode}
        onMode={setMode}
        options={options}
        onPick={async (id, action) => {
          if (id.startsWith("goal:")) {
            const goalId = id.slice(5);
            if (action === "edit") {
              const g = goals.find((x) => x.id === goalId);
              if (g) setSelected(g);
            } else if (action === "archive") await post({ action: "archive", id: goalId });
            else await post({ action: "delete", id: goalId });
          } else if (id.startsWith("phase:")) {
            const [, goalId, stageId] = id.split(":");
            if (action === "archive") await post({ action: "archiveStage", goalId, stageId });
            else if (action === "delete") await post({ action: "deleteStage", goalId, stageId });
          }
          setMode(null);
        }}
      />
    </div>
  );
}
