"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/client-api";
import { KpiTile, PageHero, WidgetHead } from "@/components/ui/Widgets";

type Day14 = {
  date: string;
  planned: number;
  completed: number;
  percent: number;
  habitsPercent?: number;
  goalsPercent?: number;
};

type HabitRow = { id: string; title: string; daysHit: number; rate: number };

type Analytics = {
  week: { percent: number; planned: number; completed: number };
  weeks: { weekStart: string; percent: number; planned?: number; completed?: number }[];
  days14: Day14[];
  byStatus?: { ahead: number; on_track: number; behind: number; no_plan: number };
  velocity: {
    activeStreak: number;
    percent14: number;
    avgTasksDay14: number;
    daysFullyDone14: number;
    daysWithPlan14: number;
    planned14?: number;
    done14?: number;
  };
  habits?: { active: number; logs30: number; list: HabitRow[] };
  modules?: { done: number; total: number };
  stages?: { done: number; total: number };
  tasks?: {
    completionRate: number;
    done30?: number;
    created30?: number;
    overdue?: number;
    bySource?: {
      habits?: { done: number; total: number };
      goals?: { done: number; total: number };
      personal?: { done: number; total: number };
    };
  };
};

function avg(nums: number[]) {
  if (!nums.length) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function pct(done: number, total: number) {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await apiGet("/api/os?compose=0");
    if (res.ok) setData((res.data.analytics as Analytics) ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    if (!data) return null;
    const days = data.days14 ?? [];
    const today = days[days.length - 1];
    const dayAvg = avg(days.map((d) => d.percent));
    const weeks = data.weeks ?? [];
    const weekAvg = avg(weeks.map((w) => w.percent));
    const monthAvg = avg(weeks.slice(0, 4).map((w) => w.percent));
    const habitAvg = avg((data.habits?.list ?? []).map((h) => h.rate));
    const habitFromDays = avg(days.map((d) => d.habitsPercent ?? 0));
    const stages = data.stages ?? { done: 0, total: 0 };
    const modules = data.modules ?? { done: 0, total: 0 };
    const status = data.byStatus ?? { ahead: 0, on_track: 0, behind: 0, no_plan: 0 };
    const goalsActive = status.ahead + status.on_track + status.behind + status.no_plan;
    const goalsOk = status.ahead + status.on_track;
    return {
      todayPct: today?.percent ?? 0,
      todayDone: today?.completed ?? 0,
      todayPlan: today?.planned ?? 0,
      dayAvg,
      weekNow: data.week?.percent ?? 0,
      weekDone: data.week?.completed ?? 0,
      weekPlan: data.week?.planned ?? 0,
      weekAvg,
      monthAvg: monthAvg || data.velocity?.percent14 || 0,
      habitAvg: habitAvg || habitFromDays,
      habitsActive: data.habits?.active ?? 0,
      stagePct: pct(stages.done, stages.total),
      stages,
      modulePct: pct(modules.done, modules.total),
      modules,
      streak: data.velocity?.activeStreak ?? 0,
      avgTasks: data.velocity?.avgTasksDay14 ?? 0,
      daysFull: data.velocity?.daysFullyDone14 ?? 0,
      daysWithPlan: data.velocity?.daysWithPlan14 ?? 0,
      done14: data.velocity?.done14 ?? 0,
      planned14: data.velocity?.planned14 ?? 0,
      percent14: data.velocity?.percent14 ?? 0,
      taskRate: data.tasks?.completionRate ?? 0,
      overdue: data.tasks?.overdue ?? 0,
      goalsActive,
      goalsOk,
      goalsBehind: status.behind,
      goalsNoPlan: status.no_plan,
      habitTasks: data.tasks?.bySource?.habits,
      goalTasks: data.tasks?.bySource?.goals,
    };
  }, [data]);

  if (loading || !stats) {
    return (
      <div className="page-stack">
        <PageHero title="Аналитика" />
        <section className="panel">
          <p className="text-[var(--ink-faint)]">…</p>
        </section>
      </div>
    );
  }

  const habitList = data?.habits?.list ?? [];

  return (
    <div className="page-stack">
      <PageHero title="Аналитика" />

      <section className="panel pulse-board">
        <div className="pulse-cell">
          <p className="pulse-label">Сегодня</p>
          <p className="pulse-value">{stats.todayPct}%</p>
          <p className="pulse-sub">
            {stats.todayDone}/{stats.todayPlan} задач
          </p>
        </div>
        <div className="pulse-cell">
          <p className="pulse-label">Неделя</p>
          <p className="pulse-value">{stats.weekNow}%</p>
          <p className="pulse-sub">
            {stats.weekDone}/{stats.weekPlan} · ср. {stats.weekAvg}%
          </p>
        </div>
        <div className="pulse-cell">
          <p className="pulse-label">Месяц</p>
          <p className="pulse-value">{stats.monthAvg}%</p>
          <p className="pulse-sub">ср. по 4 неделям</p>
        </div>
        <div className="pulse-cell">
          <p className="pulse-label">Серия</p>
          <p className="pulse-value">{stats.streak}</p>
          <p className="pulse-sub">дней подряд</p>
        </div>
      </section>

      <div className="bento">
        <div className="span-3">
          <KpiTile
            label="Привычки"
            value={<>{stats.habitAvg}%</>}
            hint={`${stats.habitsActive} активных`}
            color="#38bdf8"
          />
        </div>
        <div className="span-3">
          <KpiTile
            label="Этапы"
            value={<>{stats.stagePct}%</>}
            hint={`${stats.stages.done}/${stats.stages.total}`}
            color="#a855f7"
          />
        </div>
        <div className="span-3">
          <KpiTile
            label="Шаги планов"
            value={<>{stats.modulePct}%</>}
            hint={`${stats.modules.done}/${stats.modules.total}`}
            color="#34d399"
          />
        </div>
        <div className="span-3">
          <KpiTile
            label="Цели в ритме"
            value={
              <>
                {stats.goalsOk}
                <span className="kpi-den">/{stats.goalsActive}</span>
              </>
            }
            hint={stats.goalsBehind ? `${stats.goalsBehind} отстают` : "ок"}
            color="var(--accent)"
          />
        </div>

        <div className="span-3">
          <KpiTile
            label="День · среднее"
            value={<>{stats.dayAvg}%</>}
            color="var(--accent)"
          />
        </div>
        <div className="span-3">
          <KpiTile
            label="14 дней"
            value={<>{stats.percent14}%</>}
            hint={`${stats.done14}/${stats.planned14}`}
            color="#fb923c"
          />
        </div>
        <div className="span-3">
          <KpiTile
            label="Задач / день"
            value={<>{stats.avgTasks}</>}
            hint={`${stats.daysFull}/${stats.daysWithPlan} полных дней`}
            color="#38bdf8"
          />
        </div>
        <div className="span-3">
          <KpiTile
            label="Просрочено"
            value={<>{stats.overdue}</>}
            hint={`закрытие 30д ${stats.taskRate}%`}
            color="#f87171"
          />
        </div>

        <div className="span-12">
          <section className="panel">
            <WidgetHead title="14 дней" tone="orange" />
            <div className="analytics-day-bars">
              {(data?.days14 ?? []).map((d) => (
                <div key={d.date} className="analytics-day-bar" title={`${d.date}: ${d.percent}% · ${d.completed}/${d.planned}`}>
                  <span style={{ height: `${Math.max(4, d.percent)}%` }} />
                  <em>{d.date.slice(8)}</em>
                </div>
              ))}
            </div>
          </section>
        </div>

        {habitList.length > 0 ? (
          <div className="span-12">
            <section className="panel">
              <WidgetHead title="Привычки · 30 дней" tone="green" />
              <ul className="stack-tight">
                {habitList.map((h) => (
                  <li key={h.id} className="signal-row">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{h.title}</p>
                      <p className="text-[11px] text-[var(--ink-faint)]">{h.daysHit}/30 дней</p>
                    </div>
                    <p className="tabular-nums font-bold text-[var(--accent)]">{h.rate}%</p>
                    <div className="habit-mini-bar w-20">
                      <span style={{ width: `${h.rate}%`, background: "var(--accent)" }} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
