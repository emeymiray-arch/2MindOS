"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { DayCard } from "@/components/roadmap/DayCard";
import { ProgressRing } from "@/components/roadmap/ProgressRing";
import { StatPills } from "@/components/roadmap/StatPills";
import type { MonthPageStats } from "@/lib/roadmap";
import type { RoadmapMonth, RoadmapStage } from "@/lib/types";

export default function RoadmapMonthPage() {
  const params = useParams();
  const stageId = String(params.stageId ?? "");
  const monthId = String(params.monthId ?? "");

  const [title, setTitle] = useState("");
  const [month, setMonth] = useState<RoadmapMonth | null>(null);
  const [stage, setStage] = useState<RoadmapStage | null>(null);
  const [stats, setStats] = useState<MonthPageStats | null>(null);
  const [goalTitle, setGoalTitle] = useState("");
  const [dayDate, setDayDate] = useState("");
  const [taskDraft, setTaskDraft] = useState<{ dayId: string; title: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const apply = useCallback((data: Record<string, unknown>) => {
    if (data.title) setTitle(String(data.title));
    if (data.month) setMonth(data.month as RoadmapMonth);
    if (data.stage) setStage(data.stage as RoadmapStage);
    if (data.stats) setStats(data.stats as MonthPageStats);
  }, []);

  const load = useCallback(async () => {
    if (!stageId || !monthId) return;
    const res = await fetch(`/api/roadmap?stageId=${stageId}&monthId=${monthId}`);
    const data = await res.json();
    if (data.error) {
      setError("Month not found");
      return;
    }
    apply(data);
  }, [stageId, monthId, apply]);

  useEffect(() => {
    load();
  }, [load]);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const { apiPost } = await import("@/lib/client-api");
      const result = await apiPost("/api/roadmap", { ...body, stageId, monthId });
      if (!result.ok && result.error) setError(result.error);
      else if (result.data.month) apply(result.data);
      else await load();
    } catch {
      setError("Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  }

  const progress = stats?.overallProgress ?? 0;
  const days = month?.days ?? [];

  return (
    <div className="fade-in mx-auto max-w-5xl space-y-12 pb-16">
      <div>
        <Link
          href="/roadmap"
          className="text-[13px] font-semibold text-[var(--ink-soft)] transition-opacity hover:opacity-70"
        >
          ← Roadmap
        </Link>
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 font-display text-4xl md:text-5xl"
        >
          {title || "…"}
        </motion.h1>
        {stage?.title ? (
          <p className="mt-2 text-[14px] text-[var(--ink-faint)]">
            {stage.title}
            {stage.subtitle ? ` · ${stage.subtitle}` : ""}
          </p>
        ) : null}
      </div>

      {error ? <p className="text-[13px] text-[var(--bad)]">{error}</p> : null}

      <section className="card flex flex-col items-start gap-8 p-6 sm:flex-row sm:items-center sm:gap-12 sm:p-8">
        <ProgressRing value={progress} size={148} stroke={12} />
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--ink-faint)]">
            Overall Score
          </p>
          <p className="mt-2 font-display text-[48px] tabular-nums leading-none">{progress}%</p>
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl">Days</h2>
          <div className="flex flex-wrap gap-2">
            <input
              type="date"
              value={dayDate}
              onChange={(e) => setDayDate(e.target.value)}
              disabled={busy}
            />
            <button
              type="button"
              className="btn btn-soft"
              disabled={busy || !dayDate}
              onClick={async () => {
                await post({ action: "addDay", date: dayDate });
                setDayDate("");
              }}
            >
              +
            </button>
          </div>
        </div>

        {days.length === 0 ? (
          <p className="text-[13px] text-[var(--ink-faint)]">No days yet</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {days.map((d) => (
              <div key={d.id} className="space-y-2">
                <DayCard
                  day={d}
                  onToggle={(taskId) =>
                    post({ action: "toggleTask", dayId: d.id, taskId })
                  }
                />
                {taskDraft?.dayId === d.id ? (
                  <div className="flex gap-2">
                    <input
                      className="min-w-0 flex-1"
                      value={taskDraft.title}
                      placeholder="Task"
                      onChange={(e) => setTaskDraft({ ...taskDraft, title: e.target.value })}
                    />
                    <button
                      type="button"
                      className="btn btn-ink"
                      disabled={busy || !taskDraft.title.trim()}
                      onClick={async () => {
                        await post({
                          action: "addTask",
                          dayId: d.id,
                          title: taskDraft.title.trim(),
                        });
                        setTaskDraft(null);
                      }}
                    >
                      +
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => setTaskDraft(null)}>
                      ×
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn btn-ghost text-[12px]"
                    onClick={() => setTaskDraft({ dayId: d.id, title: "" })}
                  >
                    + task
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl">Month goals</h2>
        <ul className="card space-y-0 divide-y divide-[var(--line)] p-2">
          {(month?.goals ?? []).map((g) => (
            <li key={g.id}>
              <button
                type="button"
                className="roadmap-goal-row w-full px-3 py-3 text-left"
                disabled={busy}
                onClick={() => post({ action: "toggleGoal", goalId: g.id })}
              >
                <span className={`roadmap-tick ${g.done ? "on" : "off"}`}>{g.done ? "✔" : "○"}</span>
                <span className="roadmap-goal-text">{g.title}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <input
            className="min-w-[160px] flex-1"
            value={goalTitle}
            disabled={busy}
            placeholder="Goal"
            onChange={(e) => setGoalTitle(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-ink"
            disabled={busy || !goalTitle.trim()}
            onClick={async () => {
              await post({ action: "addGoal", title: goalTitle.trim(), done: true });
              setGoalTitle("");
            }}
          >
            +
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl">Stats</h2>
        <StatPills
          items={[
            { label: "Overall Progress", value: `${stats?.overallProgress ?? 0}%`, tone: "green" },
            {
              label: "Goals Completed",
              value: String(stats?.goalsCompleted ?? 0),
              tone: "blue",
            },
            { label: "Habits", value: `${stats?.habits ?? 0}%`, tone: "orange" },
            { label: "Focus Score", value: `${stats?.focusScore ?? 0}%`, tone: "purple" },
          ]}
        />
      </section>
    </div>
  );
}
