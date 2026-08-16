"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type GoalRow = {
  id: string;
  title: string;
  progress: number;
  area: { name: string; emoji?: string } | null;
  currentPhase: { id: string; title: string } | null;
};

type WeekData = {
  weekStart: string;
  week: {
    id: string;
    objectives: {
      id: string;
      goalId: string;
      phaseId?: string;
      title: string;
      done: boolean;
    }[];
  } | null;
  activeGoals: GoalRow[];
};

export default function WeekPage() {
  const [data, setData] = useState<WeekData | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    await fetch("/api/weeks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ensure" }),
    });
    const res = await fetch("/api/weeks");
    setData(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const { apiPost } = await import("@/lib/client-api");
      const result = await apiPost("/api/weeks", body);
      if (!result.ok && result.error) setError(result.error);
      await load();
    } catch {
      setError("Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <div className="text-[var(--ink-faint)]">…</div>;

  const weekLabel = new Date(data.weekStart + "T12:00:00").toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });

  return (
    <div className="fade-in mx-auto max-w-2xl space-y-6 pb-10">
      <header className="space-y-1">
        <h1 className="font-display text-3xl">Week</h1>
        <p className="text-[15px] text-[var(--ink-soft)]">с {weekLabel}</p>
      </header>

      {error ? <p className="text-[13px] text-[var(--bad)]">{error}</p> : null}

      <p className="text-[13px] text-[var(--ink-faint)]">
        Active goals → weekly objective → tasks for Today
      </p>

      <div className="space-y-4">
        {data.activeGoals.map((g) => {
          const objs = (data.week?.objectives ?? []).filter((o) => o.goalId === g.id);
          return (
            <section key={g.id} className="card space-y-3 p-5">
              <div className="flex items-baseline justify-between gap-2">
                <div>
                  <Link href={`/goals?id=${g.id}`} className="font-semibold">
                    {g.area?.emoji ? `${g.area.emoji} ` : ""}
                    {g.title}
                  </Link>
                  {g.currentPhase ? (
                    <p className="text-[13px] text-[var(--ink-faint)]">Phase · {g.currentPhase.title}</p>
                  ) : null}
                </div>
                <span className="tabular-nums text-[var(--ink-soft)]">{g.progress}%</span>
              </div>

              <ul className="space-y-2">
                {objs.map((o) => (
                  <li key={o.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      className={`check ${o.done ? "check-on" : "check-off"}`}
                      disabled={busy}
                      onClick={() => post({ action: "toggleObjective", id: o.id })}
                    >
                      {o.done ? "✓" : "×"}
                    </button>
                    <span className="min-w-0 flex-1 text-[14px]">{o.title}</span>
                    <button
                      type="button"
                      className="btn btn-ghost text-[12px]"
                      disabled={busy}
                      onClick={() =>
                        post({
                          action: "spawnTasks",
                          objectiveId: o.id,
                          titles: [o.title],
                        })
                      }
                    >
                      → Today
                    </button>
                  </li>
                ))}
              </ul>

              <div className="flex gap-2">
                <input
                  className="min-w-0 flex-1"
                  placeholder="Weekly objective"
                  value={drafts[g.id] ?? ""}
                  disabled={busy}
                  onChange={(e) => setDrafts({ ...drafts, [g.id]: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && drafts[g.id]?.trim()) {
                      post({
                        action: "addObjective",
                        goalId: g.id,
                        phaseId: g.currentPhase?.id,
                        title: drafts[g.id].trim(),
                      });
                      setDrafts({ ...drafts, [g.id]: "" });
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn btn-ink"
                  disabled={busy || !drafts[g.id]?.trim()}
                  onClick={() => {
                    post({
                      action: "addObjective",
                      goalId: g.id,
                      phaseId: g.currentPhase?.id,
                      title: drafts[g.id].trim(),
                    });
                    setDrafts({ ...drafts, [g.id]: "" });
                  }}
                >
                  +
                </button>
              </div>
            </section>
          );
        })}
      </div>

      {data.activeGoals.length === 0 ? (
        <p className="text-[13px] text-[var(--ink-faint)]">
          Нет активных целей.{" "}
          <Link href="/goals" className="font-semibold">
            Создай в Goals
          </Link>
        </p>
      ) : null}
    </div>
  );
}
