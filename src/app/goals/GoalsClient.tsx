"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PlanScheme } from "@/components/plan/PlanScheme";
import { ActionMode, ActionOption, PageToolbar } from "@/components/ui/PageToolbar";
import { StorageAnalytics } from "@/components/ui/StorageAnalytics";
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

const STORAGE_COLORS = {
  blue: "#6B8CAE",
  green: "#6F8F78",
  orange: "#B8956A",
  red: "#A87272",
  gray: "#A0A0A0",
};

const PHASES = [
  { value: "foundation", label: "Фаза 1 · 1-2 месяц" },
  { value: "development", label: "Фаза 2 · 3-4 месяц" },
  { value: "later", label: "Фаза 3 · 5-6 месяц" },
] as const;

/** Muted sphere accents — no neon. Rank keeps same colors adjacent. */
function colorForArea(areaName?: string) {
  const n = (areaName ?? "").toLowerCase();
  if (/здоров|сон|спорт|тело|питани|медиц|энерги|wellness|health/.test(n)) {
    return { key: 1, accent: "#5F8F72", soft: "rgba(95, 143, 114, 0.08)" };
  }
  if (/само|развит|обуч|англий|коран|чтен|книг|навык|education|skill/.test(n)) {
    return { key: 2, accent: "#6B8CAE", soft: "rgba(107, 140, 174, 0.08)" };
  }
  if (/стиль|эстет|дом|гардероб|beauty|style/.test(n)) {
    return { key: 3, accent: "#B8956A", soft: "rgba(184, 149, 106, 0.08)" };
  }
  if (/работ|бизнес|проект|карьер|деньг|finance|work/.test(n)) {
    return { key: 4, accent: "#8F7A9E", soft: "rgba(143, 122, 158, 0.08)" };
  }
  return { key: 5, accent: "#A87272", soft: "rgba(168, 114, 114, 0.08)" };
}

function phaseLabel(bucket?: string) {
  const found = PHASES.find((phase) => phase.value === (bucket ?? "development"));
  return found?.label ?? "Фаза 2 · 3-4 месяц";
}

function sortByColor(items: GoalView[]) {
  return [...items].sort((a, b) => {
    const ca = colorForArea(a.area?.name);
    const cb = colorForArea(b.area?.name);
    if (ca.key !== cb.key) return ca.key - cb.key;
    return a.title.localeCompare(b.title, "ru");
  });
}

function buildGoalSegments(goal: GoalView) {
  const stages = (goal.stages ?? []).filter((stage) => !stage.archived);
  const done = stages.filter((stage) => stage.done).length;
  const active = stages.filter((stage) => !stage.done && stage.status === "active").length;
  const overdue = stages.filter(
    (stage) =>
      !stage.done &&
      Boolean(stage.deadlineEnd) &&
      new Date(stage.deadlineEnd as string).getTime() < Date.now()
  ).length;
  const planned = Math.max(stages.length - done - active - overdue, 0);
  const total = done + active + overdue + planned;
  if (total === 0) {
    const accent = colorForArea(goal.area?.name).accent;
    const pct = Math.max(0, Math.min(100, goal.progress ?? 0));
    return [
      { label: "Прогресс", value: pct, color: accent },
      { label: "Остаток", value: Math.max(0, 100 - pct), color: STORAGE_COLORS.gray },
    ];
  }
  return [
    { label: "Готово", value: done, color: STORAGE_COLORS.blue },
    { label: "Активно", value: active, color: STORAGE_COLORS.green },
    { label: "Просрочено", value: overdue, color: STORAGE_COLORS.red },
    { label: "План", value: planned, color: STORAGE_COLORS.gray },
  ];
}

function GoalAnalyticsBar({ goal }: { goal: GoalView }) {
  const segments = buildGoalSegments(goal);
  const total = Math.max(
    1,
    segments.reduce((sum, s) => sum + Math.max(0, s.value), 0)
  );
  return (
    <div
      className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full"
      style={{ background: "var(--line)" }}
      aria-hidden
    >
      {segments.map((s) => {
        const w = (Math.max(0, s.value) / total) * 100;
        if (w <= 0) return null;
        return (
          <span
            key={s.label}
            style={{ width: `${w}%`, background: s.color }}
            className="h-full"
          />
        );
      })}
    </div>
  );
}

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
  const [mode, setMode] = useState<ActionMode>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
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

  function applyGoalsPayload(data: Record<string, unknown>) {
    if (Array.isArray(data.goals)) setGoals(data.goals as GoalView[]);
    if (Array.isArray(data.foundation)) setFoundation(data.foundation as GoalView[]);
    if (Array.isArray(data.development)) setDevelopment(data.development as GoalView[]);
    if (Array.isArray(data.later)) setLater(data.later as GoalView[]);
    if (data.plan && typeof data.plan === "object") setPlan(data.plan as { title: string });
    if (Array.isArray(data.areas)) setAreas(data.areas as Sphere[]);
  }

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const { apiPost } = await import("@/lib/client-api");
      const result = await apiPost("/api/goals", body);
      if (!result.ok && result.error) {
        setError(result.error);
        return;
      }
      applyGoalsPayload(result.data);
      if (selected?.id) {
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
    const sorted = sortByColor(items);
    if (sorted.length === 0) return null;
    return (
      <section className="space-y-3">
        <p className="text-[12px] font-medium text-[var(--ink-faint)]">{label}</p>
        <div className="space-y-2">
          {sorted.map((g) => {
            const tone = colorForArea(g.area?.name);
            return (
              <button
                key={g.id}
                type="button"
                className="card block w-full p-3 text-left"
                style={{
                  borderLeftWidth: 3,
                  borderLeftColor: tone.accent,
                  background: tone.soft,
                }}
                onClick={() => setSelected(g)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[14px] font-semibold">{g.title}</span>
                  <span className="tabular-nums text-[12px] text-[var(--ink-soft)]">
                    {g.progress}%
                  </span>
                </div>
                <GoalAnalyticsBar goal={g} />
              </button>
            );
          })}
        </div>
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
        }}
      >
        ← Цели
      </button>
      <header className="space-y-3">
        <h1 className="font-display text-3xl">{selected.title}</h1>
        <p className="text-[14px] text-[var(--ink-soft)]">
          {selected.area?.name ?? ""}
          {selected.deadline ? ` · до ${selected.deadline}` : ""}
          {` · ${selected.progress}%`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selected.bucket ?? "development"}
            onChange={(e) => post({ action: "update", id: selected.id, bucket: e.target.value })}
            className="text-[12px]"
            disabled={busy}
          >
            {PHASES.map((phase) => (
              <option key={phase.value} value={phase.value}>
                {phase.label}
              </option>
            ))}
          </select>
        </div>
        <div className="card mt-2 space-y-2 p-3">
          <p className="text-[12px] font-medium text-[var(--ink-faint)]">Изменить цель</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={selected.title}
              onChange={(e) => setSelected({ ...selected, title: e.target.value })}
              placeholder="Название цели"
            />
            <select
              value={selected.lifeAreaId ?? ""}
              onChange={(e) => setSelected({ ...selected, lifeAreaId: e.target.value || undefined })}
            >
              <option value="">Сфера</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              type="date"
              value={selected.deadline ?? ""}
              onChange={(e) => setSelected({ ...selected, deadline: e.target.value || undefined })}
            />
            <button
              type="button"
              className="btn btn-ink"
              disabled={busy || !selected.title.trim()}
              onClick={() =>
                post({
                  action: "update",
                  id: selected.id,
                  title: selected.title.trim(),
                  lifeAreaId: selected.lifeAreaId ?? "",
                  deadline: selected.deadline ?? "",
                  bucket: selected.bucket ?? "development",
                })
              }
            >
              Сохранить
            </button>
          </div>
        </div>
          {selected.description ? (
            <p className="text-[14px] text-[var(--ink-faint)]">{selected.description}</p>
          ) : null}
          <div className="meter">
            <span style={{ width: `${selected.progress}%` }} />
          </div>
        </header>
        <StorageAnalytics
          title="Аналитика"
          segments={buildGoalSegments(selected)}
          centerValue={`${selected.progress}%`}
          centerLabel="прогресс"
        />

        <section className="card space-y-4 p-5">
          <p className="text-[12px] font-medium text-[var(--ink-faint)]">План</p>
          {selected.workPlan ? (
            <PlanScheme
              key={selected.workPlan.id}
              planId={selected.workPlan.id}
              onProgress={(progress) =>
                setSelected({
                  ...selected,
                  progress,
                  workPlan: selected.workPlan
                    ? { ...selected.workPlan, progress }
                    : selected.workPlan,
                })
              }
            />
          ) : (
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
                    title: `План: ${selected.title}`,
                    lite: true,
                  });
                  if (!result.ok && result.error) {
                    setError(String(result.error));
                    return;
                  }
                  const plan = result.data.plan as
                    | { id: string; title: string; progress: number }
                    | undefined;
                  if (plan?.id) {
                    setSelected({
                      ...selected,
                      workPlanId: plan.id,
                      workPlan: {
                        id: plan.id,
                        title: plan.title,
                        progress: plan.progress ?? 0,
                        status: "active",
                      },
                    });
                  }
                  await load();
                } catch {
                  setError("Не удалось создать план");
                } finally {
                  setBusy(false);
                }
              }}
            >
              + План
            </button>
          )}
        </section>

        {(selected.weekObjectives ?? []).length > 0 ? (
        <section className="space-y-2">
          <p className="text-[12px] font-medium text-[var(--ink-faint)]">Эта неделя</p>
            <ul className="space-y-1">
              {selected.weekObjectives.map((o) => (
                <li key={o.id} className="text-[14px]">
                  {o.done ? "✓ " : "○ "}
                  {o.title}
                </li>
              ))}
            </ul>
        </section>
        ) : null}

        {(selected.todayActions ?? []).length > 0 ? (
        <section className="space-y-2">
          <p className="text-[12px] font-medium text-[var(--ink-faint)]">Сегодня</p>
            <ul className="space-y-1">
              {selected.todayActions.map((t) => (
                <li key={t.id} className="text-[14px]">
                  {t.done ? "✓ " : "○ "}
                  {t.title}
                </li>
              ))}
            </ul>
        </section>
        ) : null}

        {error ? <p className="text-[13px] text-[var(--ink-soft)]">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="fade-in mx-auto max-w-2xl space-y-10 pb-16">
      <header className="space-y-2">
        <h1 className="font-display text-3xl">Цели</h1>
        <p className="text-[15px] text-[var(--ink-soft)]">{plan?.title ?? ""}</p>
      </header>

      {error ? <p className="text-[13px] text-[var(--ink-soft)]">{error}</p> : null}

      <div className="card flex flex-wrap gap-2 p-3">
        <input
          className="min-w-[120px] flex-1"
          value={title}
          placeholder="Цель"
          disabled={busy}
          onChange={(e) => setTitle(e.target.value)}
        />
        <select value={areaId} onChange={(e) => setAreaId(e.target.value)} disabled={busy}>
          <option value="">Сфера</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select value={bucket} onChange={(e) => setBucket(e.target.value)} disabled={busy}>
          {PHASES.map((phase) => (
            <option key={phase.value} value={phase.value}>
              {phase.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-ink"
          disabled={busy || !title.trim()}
          onClick={() => {
            const t = title.trim();
            if (!t) return;
            setTitle("");
            void post({
              action: "create",
              title: t,
              lifeAreaId: areaId || undefined,
              bucket,
            });
          }}
        >
          +
        </button>
      </div>

      <Bucket label={phaseLabel("foundation")} items={foundation} />
      <Bucket label={phaseLabel("development")} items={development} />
      <Bucket label={phaseLabel("later")} items={later} />

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
