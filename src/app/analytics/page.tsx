"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/client-api";
import { EmptyState, ProgressRing, StatusChip } from "@/components/ui/Progress";

type Reality = {
  actual: number;
  expected: number | null;
  status: "ahead" | "on_track" | "behind" | "no_plan";
  label: string;
  detail: string;
  deadlineRisk: boolean;
  daysLeft: number | null;
};

type AnalyticsGoal = {
  id: string;
  title: string;
  area?: string;
  reality: Reality;
  week: { planned: number; completed: number; percent: number };
  hasPlan: boolean;
  stages: {
    id: string;
    title: string;
    progress: number;
    status?: string;
    deadlineStart?: string;
    deadlineEnd?: string;
    modulesDone: number;
    modulesTotal: number;
  }[];
  nextStep: { title: string; stageTitle: string } | null;
};

type Analytics = {
  asOf: string;
  week: { planned: number; completed: number; remaining: number; percent: number };
  weeks: { weekStart: string; planned: number; completed: number; percent: number }[];
  goals: AnalyticsGoal[];
  byStatus: { ahead: number; on_track: number; behind: number; no_plan: number };
  modules: { done: number; total: number };
  stages: { done: number; total: number };
  tasks: { done30: number; created30: number; completionRate: number; overdue: number };
  habits: { active: number; logs30: number };
};

function pct(done: number, total: number) {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

function weekLabel(iso: string) {
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return iso;
  }
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void apiGet("/api/os").then((res) => {
      if (res.ok && res.data.analytics) setData(res.data.analytics as Analytics);
      setLoading(false);
    });
  }, []);

  if (loading) return <p className="text-[var(--ink-faint)]">Считаю…</p>;
  if (!data) {
    return <EmptyState title="Нет данных" body="Открой главную или проверь vault." />;
  }

  const avg =
    data.goals.length === 0
      ? 0
      : Math.round(
          data.goals.reduce((s, g) => s + (g.reality?.actual ?? 0), 0) / data.goals.length
        );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-[34px]">Аналитика</h1>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div
          className="surface flex flex-col items-center gap-2 p-4"
          style={{ background: "var(--c-blue-soft)" }}
        >
          <ProgressRing value={data.week.percent} size={64} />
          <p className="text-[12px] font-bold text-[var(--c-blue)]">Неделя</p>
        </div>
        <div
          className="surface flex flex-col items-center gap-2 p-4"
          style={{ background: "var(--c-green-soft)" }}
        >
          <ProgressRing value={avg} size={64} />
          <p className="text-[12px] font-bold text-[var(--c-green)]">Цели</p>
        </div>
        <div
          className="surface flex flex-col items-center gap-2 p-4"
          style={{ background: "var(--c-violet-soft)" }}
        >
          <ProgressRing value={pct(data.modules.done, data.modules.total)} size={64} />
          <p className="text-[12px] font-bold text-[var(--c-violet)]">
            Шаги {data.modules.done}/{data.modules.total}
          </p>
        </div>
        <div
          className="surface flex flex-col items-center gap-2 p-4"
          style={{ background: "var(--c-orange-soft)" }}
        >
          <ProgressRing value={pct(data.stages.done, data.stages.total)} size={64} />
          <p className="text-[12px] font-bold text-[var(--c-orange)]">
            Этапы {data.stages.done}/{data.stages.total}
          </p>
        </div>
      </div>

      <section className="surface p-5">
        <h2 className="font-display text-[1.25rem]">План vs реальность</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              ["ahead", "Впереди", "var(--c-green)", data.byStatus.ahead],
              ["on_track", "В темпе", "var(--c-blue)", data.byStatus.on_track],
              ["behind", "Отстаёт", "var(--c-orange)", data.byStatus.behind],
              ["no_plan", "Без плана", "var(--ink-faint)", data.byStatus.no_plan],
            ] as const
          ).map(([key, label, color, n]) => (
            <div
              key={key}
              className="rounded-[var(--radius-sm)] px-3 py-3 text-center"
              style={{ background: "var(--bg-muted)" }}
            >
              <p className="font-display text-[1.6rem]" style={{ color }}>
                {n}
              </p>
              <p className="text-[12px] font-bold" style={{ color }}>
                {label}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-[1.25rem]">6 недель</h2>
        <div className="surface mt-3 space-y-2.5 p-4">
          {data.weeks.map((w, i) => (
            <div key={w.weekStart + i} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-[12px] font-bold text-[var(--ink-faint)]">
                {weekLabel(w.weekStart)}
              </span>
              <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, w.percent)}%`,
                    background: i === 0 ? "var(--c-blue)" : "var(--c-violet)",
                  }}
                />
              </div>
              <span className="w-12 text-right text-[12px] font-bold tabular-nums">
                {w.percent}%
              </span>
              <span className="w-14 text-right text-[11px] font-semibold text-[var(--ink-faint)]">
                {w.completed}/{w.planned}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="surface p-4" style={{ background: "var(--c-blue-soft)" }}>
          <p className="text-[12px] font-bold text-[var(--c-blue)]">Задачи · 30 дней</p>
          <p className="font-display mt-2 text-[1.8rem] text-[var(--c-blue)]">
            {data.tasks.completionRate}%
          </p>
        </div>
        <div className="surface p-4" style={{ background: "var(--c-orange-soft)" }}>
          <p className="text-[12px] font-bold text-[var(--c-orange)]">Просрочено</p>
          <p className="font-display mt-2 text-[1.8rem] text-[var(--c-orange)]">
            {data.tasks.overdue}
          </p>
        </div>
        <div className="surface p-4" style={{ background: "var(--c-green-soft)" }}>
          <p className="text-[12px] font-bold text-[var(--c-green)]">Привычки</p>
          <p className="font-display mt-2 text-[1.8rem] text-[var(--c-green)]">
            {data.habits.logs30}
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-[1.25rem]">Цели подробно</h2>
        {data.goals.length === 0 ? (
          <EmptyState title="Нет активных целей" body="Создай цель — аналитика появится сама." />
        ) : (
          data.goals.map((g, i) => {
            const accents = [
              "var(--c-blue)",
              "var(--c-green)",
              "var(--c-orange)",
              "var(--c-violet)",
            ];
            const accent = accents[i % accents.length];
            return (
              <div
                key={g.id}
                className="surface space-y-3 p-4"
                style={{ borderLeft: `4px solid ${accent}` }}
              >
                <div className="flex items-start gap-3">
                  <ProgressRing
                    value={g.reality.actual}
                    expected={g.reality.expected}
                    size={52}
                    stroke={5}
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/goals/${g.id}`}
                      className="font-bold text-[var(--ink)] hover:text-[var(--accent)]"
                    >
                      {g.title}
                    </Link>
                  </div>
                  <StatusChip status={g.reality.status} label={g.reality.label} />
                </div>

                {g.nextStep ? (
                  <p className="rounded-[12px] bg-[var(--c-blue-soft)] px-3 py-2 text-[13px] font-semibold text-[var(--c-blue)]">
                    {g.nextStep.title}
                  </p>
                ) : null}

                {g.stages.length > 0 ? (
                  <div className="space-y-1.5">
                    {g.stages.map((st) => (
                      <div key={st.id} className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold">
                          {st.title}
                        </span>
                        <span className="text-[11px] font-bold text-[var(--ink-faint)]">
                          {st.modulesDone}/{st.modulesTotal}
                        </span>
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, st.progress)}%`,
                              background: accent,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] font-semibold" style={{ color: accent }}>
                    {g.hasPlan ? "Без шагов" : "Нет плана"}
                  </p>
                )}
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
