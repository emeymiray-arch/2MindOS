"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Phase = {
  id: string;
  title: string;
  order: number;
  durationWeeks?: number;
  status?: string;
  objectives: string[];
  milestones: { id: string; title: string; done: boolean }[];
  progress?: number;
};

type PlanPayload = {
  plan: {
    id: string;
    title: string;
    desiredResult?: string;
    why?: string;
    startingPoint?: string;
    strategy?: string;
    deadline?: string;
    status: string;
    progress: number;
    ownerType: "goal" | "project";
    ownerId: string;
    phases: Phase[];
  };
  owner: { title: string; goal?: { id: string }; project?: { id: string } };
  currentPhase: Phase | null;
  currentWeek: {
    id: string;
    weekStart: string;
    objectives: { id: string; title: string; done: boolean }[];
  } | null;
  today: { id: string; title: string; done: boolean; date: string }[];
};

type WeekOutlineItem = {
  weekStart: string;
  weekEnd: string;
  label: string;
  suggestedOutcome: string;
  suggestedActions: string[];
};

type DayBreak = { date: string; dayLabel: string; titles: string[] };

export default function PlanDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const planId = String(params.id ?? "");

  const [data, setData] = useState<PlanPayload | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    title: "",
    desiredResult: "",
    why: "",
    startingPoint: "",
    strategy: "",
    deadline: "",
  });
  const [phaseTitle, setPhaseTitle] = useState("");
  const [phaseWeeks, setPhaseWeeks] = useState("2");
  const [milestoneDrafts, setMilestoneDrafts] = useState<Record<string, string>>({});
  const [outline, setOutline] = useState<WeekOutlineItem[] | null>(null);
  const [dayBreak, setDayBreak] = useState<DayBreak[] | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/work-plans?id=${encodeURIComponent(planId)}`);
    if (!res.ok) {
      setError("Plan not found");
      setData(null);
      return;
    }
    const json = await res.json();
    setData(json);
    setDraft({
      title: json.plan.title ?? "",
      desiredResult: json.plan.desiredResult ?? "",
      why: json.plan.why ?? "",
      startingPoint: json.plan.startingPoint ?? "",
      strategy: json.plan.strategy ?? "",
      deadline: json.plan.deadline ?? "",
    });
  }, [planId]);

  useEffect(() => {
    load();
  }, [load]);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const { apiPost } = await import("@/lib/client-api");
      const result = await apiPost("/api/work-plans", body);
      if (!result.ok && result.error) setError(String(result.error));
      await load();
      return result;
    } catch {
      setError("Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  }

  if (!data && !error) {
    return <div className="text-[var(--ink-faint)]">…</div>;
  }
  if (!data) {
    return (
      <div className="fade-in mx-auto max-w-2xl space-y-4">
        <p className="text-[var(--ink-soft)]">{error}</p>
        <button type="button" className="btn btn-soft" onClick={() => router.back()}>
          ← Back
        </button>
      </div>
    );
  }

  const { plan, owner, currentPhase, currentWeek, today } = data;
  const backHref =
    plan.ownerType === "goal"
      ? `/goals?id=${plan.ownerId}`
      : `/projects/${plan.ownerId}`;

  return (
    <div className="fade-in mx-auto max-w-2xl space-y-10 pb-16">
      <div className="flex items-center justify-between gap-3">
        <Link href={backHref} className="text-[13px] font-medium text-[var(--ink-faint)]">
          ← {owner.title}
        </Link>
        <button
          type="button"
          className="btn btn-soft"
          disabled={busy}
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? "Done" : "Edit Plan"}
        </button>
      </div>

      <header className="space-y-3">
        <p className="text-[12px] font-medium text-[var(--ink-faint)]">Plan Overview</p>
        <h1 className="font-display text-3xl tracking-[-0.03em]">{plan.title}</h1>
        <p className="text-[14px] text-[var(--ink-soft)]">
          {owner.title} · {plan.progress}%
        </p>
        <div className="meter">
          <span style={{ width: `${plan.progress}%` }} />
        </div>
      </header>

      {error ? <p className="text-[13px] text-[var(--ink-soft)]">{error}</p> : null}

      {editing ? (
        <section className="card space-y-3 p-6">
          {(
            [
              ["title", "Title"],
              ["desiredResult", "Desired Result"],
              ["why", "Why"],
              ["startingPoint", "Starting Point"],
              ["strategy", "Strategy"],
              ["deadline", "Deadline"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block space-y-1">
              <span className="text-[12px] text-[var(--ink-faint)]">{label}</span>
              {key === "deadline" ? (
                <input
                  type="date"
                  value={draft[key]}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                />
              ) : key === "title" ? (
                <input
                  value={draft[key]}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                />
              ) : (
                <textarea
                  rows={2}
                  value={draft[key]}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                />
              )}
            </label>
          ))}
          <button
            type="button"
            className="btn btn-ink"
            disabled={busy}
            onClick={async () => {
              await post({ action: "update", id: plan.id, ...draft });
              setEditing(false);
            }}
          >
            Save
          </button>
        </section>
      ) : (
        <section className="space-y-4">
          {plan.desiredResult ? (
            <div>
              <p className="text-[12px] text-[var(--ink-faint)]">Desired Result</p>
              <p className="text-[15px]">{plan.desiredResult}</p>
            </div>
          ) : null}
          {plan.why ? (
            <div>
              <p className="text-[12px] text-[var(--ink-faint)]">Why</p>
              <p className="text-[15px]">{plan.why}</p>
            </div>
          ) : null}
          {plan.startingPoint ? (
            <div>
              <p className="text-[12px] text-[var(--ink-faint)]">Starting Point</p>
              <p className="text-[15px]">{plan.startingPoint}</p>
            </div>
          ) : null}
          {plan.strategy ? (
            <div>
              <p className="text-[12px] text-[var(--ink-faint)]">Strategy</p>
              <p className="text-[15px]">{plan.strategy}</p>
            </div>
          ) : null}
          {plan.deadline ? (
            <p className="text-[13px] text-[var(--ink-faint)]">Deadline · {plan.deadline}</p>
          ) : null}
        </section>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-medium text-[var(--ink-faint)]">Timeline · Phases</p>
          <p className="text-[13px] text-[var(--ink-faint)]">
            Current · {currentPhase?.title ?? "—"}
          </p>
        </div>

        {plan.phases.map((ph) => (
          <div key={ph.id} className="card space-y-3 p-5">
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <p className="font-semibold">{ph.title}</p>
                <p className="text-[12px] text-[var(--ink-faint)]">
                  {ph.durationWeeks ? `${ph.durationWeeks} weeks · ` : ""}
                  {ph.status ?? "planned"} · {ph.progress ?? 0}%
                </p>
              </div>
              {ph.status !== "active" ? (
                <button
                  type="button"
                  className="btn btn-soft text-[12px]"
                  disabled={busy}
                  onClick={() =>
                    post({ action: "activatePhase", planId: plan.id, phaseId: ph.id })
                  }
                >
                  Activate
                </button>
              ) : null}
            </div>
            <div className="meter">
              <span style={{ width: `${ph.progress ?? 0}%` }} />
            </div>

            {(ph.objectives ?? []).length > 0 ? (
              <ul className="space-y-1 text-[13px] text-[var(--ink-soft)]">
                {ph.objectives.map((o) => (
                  <li key={o}>· {o}</li>
                ))}
              </ul>
            ) : null}

            <div className="space-y-2">
              <p className="text-[12px] text-[var(--ink-faint)]">Milestones</p>
              {(ph.milestones ?? []).map((m) => (
                <div key={m.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    className={`check ${m.done ? "check-on" : "check-off"}`}
                    disabled={busy}
                    onClick={() =>
                      post({
                        action: "toggleMilestone",
                        planId: plan.id,
                        phaseId: ph.id,
                        milestoneId: m.id,
                        done: !m.done,
                      })
                    }
                  >
                    {m.done ? "✓" : ""}
                  </button>
                  <span className="text-[14px]">{m.title}</span>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  className="min-w-0 flex-1"
                  placeholder="Milestone"
                  value={milestoneDrafts[ph.id] ?? ""}
                  onChange={(e) =>
                    setMilestoneDrafts({ ...milestoneDrafts, [ph.id]: e.target.value })
                  }
                />
                <button
                  type="button"
                  className="btn btn-ink"
                  disabled={busy || !(milestoneDrafts[ph.id] ?? "").trim()}
                  onClick={() => {
                    post({
                      action: "addMilestone",
                      planId: plan.id,
                      phaseId: ph.id,
                      title: (milestoneDrafts[ph.id] ?? "").trim(),
                    });
                    setMilestoneDrafts({ ...milestoneDrafts, [ph.id]: "" });
                  }}
                >
                  +
                </button>
              </div>
            </div>
          </div>
        ))}

        <div className="card flex flex-wrap gap-2 p-4">
          <input
            className="min-w-[140px] flex-1"
            placeholder="Phase title"
            value={phaseTitle}
            onChange={(e) => setPhaseTitle(e.target.value)}
          />
          <input
            className="w-24"
            type="number"
            min={1}
            placeholder="Weeks"
            value={phaseWeeks}
            onChange={(e) => setPhaseWeeks(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-ink"
            disabled={busy || !phaseTitle.trim()}
            onClick={() => {
              post({
                action: "addPhase",
                planId: plan.id,
                title: phaseTitle.trim(),
                durationWeeks: Number(phaseWeeks) || undefined,
              });
              setPhaseTitle("");
            }}
          >
            + Phase
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12px] font-medium text-[var(--ink-faint)]">Current Week</p>
          <Link href="/week" className="text-[13px] font-medium text-[var(--ink-faint)]">
            Week →
          </Link>
        </div>
        {currentWeek ? (
          <div className="card space-y-2 p-5">
            <p className="text-[13px] text-[var(--ink-faint)]">с {currentWeek.weekStart}</p>
            {(currentWeek.objectives ?? []).length === 0 ? (
              <p className="text-[13px] text-[var(--ink-faint)]">Нет objectives — сгенерируй ниже</p>
            ) : (
              <ul className="space-y-1">
                {currentWeek.objectives.map((o) => (
                  <li key={o.id} className="text-[14px]">
                    {o.done ? "✓ " : "○ "}
                    {o.title}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="text-[13px] text-[var(--ink-faint)]">Неделя ещё не создана</p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-soft"
            disabled={busy || !currentPhase}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await fetch("/api/work-plans", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "generateWeekOutline",
                    planId: plan.id,
                    phaseId: currentPhase?.id,
                  }),
                });
                const j = await r.json();
                setOutline(j.outline ?? null);
              } finally {
                setBusy(false);
              }
            }}
          >
            Generate Weekly Plan
          </button>
          {currentWeek ? (
            <button
              type="button"
              className="btn btn-soft"
              disabled={busy}
              onClick={async () => {
                const actions = (currentWeek.objectives ?? []).map((o) => o.title);
                const r = await fetch("/api/work-plans", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "breakWeekIntoDays",
                    weekStart: currentWeek.weekStart,
                    actions,
                    outcome: actions[0],
                  }),
                });
                const j = await r.json();
                setDayBreak(j.days ?? null);
              }}
            >
              Break into days
            </button>
          ) : null}
        </div>

        {outline ? (
          <div className="card space-y-3 p-5">
            <p className="text-[12px] font-medium text-[var(--ink-faint)]">Preview · Weekly outline</p>
            {outline.map((w) => (
              <div key={w.weekStart} className="space-y-1 border-t border-[var(--line)] pt-3 first:border-0 first:pt-0">
                <p className="font-semibold">
                  {w.label} · {w.weekStart}
                </p>
                <p className="text-[14px]">{w.suggestedOutcome}</p>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-ink"
              disabled={busy}
              onClick={async () => {
                await post({
                  action: "applyWeekOutline",
                  planId: plan.id,
                  phaseId: currentPhase?.id,
                  outline,
                });
                setOutline(null);
              }}
            >
              Apply to weeks
            </button>
          </div>
        ) : null}

        {dayBreak ? (
          <div className="card space-y-3 p-5">
            <p className="text-[12px] font-medium text-[var(--ink-faint)]">Preview · Days</p>
            {dayBreak.map((d) => (
              <div key={d.date} className="flex gap-3 text-[14px]">
                <span className="w-24 shrink-0 text-[var(--ink-faint)]">{d.dayLabel}</span>
                <span>{d.titles.join(", ") || "—"}</span>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-ink"
              disabled={busy}
              onClick={async () => {
                await post({
                  action: "applyDayTasks",
                  planId: plan.id,
                  phaseId: currentPhase?.id,
                  weekStart: currentWeek?.weekStart,
                  days: dayBreak,
                });
                setDayBreak(null);
              }}
            >
              Apply to days
            </button>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-medium text-[var(--ink-faint)]">Today</p>
          <Link href="/today" className="text-[13px] font-medium text-[var(--ink-faint)]">
            Today →
          </Link>
        </div>
        {today.length === 0 ? (
          <p className="text-[13px] text-[var(--ink-faint)]">Нет задач на сегодня из этого плана</p>
        ) : (
          <ul className="space-y-2">
            {today.map((t) => (
              <li key={t.id} className="text-[15px]">
                {t.done ? "✓ " : "○ "}
                {t.title}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
