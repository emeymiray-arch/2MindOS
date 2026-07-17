"use client";

import { useCallback, useEffect, useState } from "react";
import { calcGoalProgress } from "@/lib/tasks";
import type { Goal, Project, VitalsDay } from "@/lib/types";

interface Pulse {
  overall: number;
  todayDone: number;
  todayTotal: number;
  goalsProgress: number;
  overdue: number;
  health: {
    score: number;
    sleep: string;
    water: string;
    prayers: string;
  } | null;
  projects: { id: string; name: string; line: string }[];
  attention: string | null;
}

function healthLine(v: VitalsDay) {
  const sleepOk = v.sleepHours >= v.sleepTargetHours;
  const waterPct = Math.round((v.waterMl / Math.max(1, v.waterTargetMl)) * 100);
  const prayers = Object.values(v.prayers ?? {}).filter(Boolean).length;
  return {
    score: v.healthScore ?? 0,
    sleep: sleepOk ? `${v.sleepHours}ч ок` : `${v.sleepHours}/${v.sleepTargetHours}ч`,
    water: `${waterPct}% воды`,
    prayers: `намаз ${prayers}/5`,
  };
}

function projectLine(p: Project): string {
  const kpi = p.kpi?.[0];
  const parts: string[] = [p.status];
  if (kpi?.value) parts.push(kpi.label ? `${kpi.label}: ${kpi.value}` : String(kpi.value));
  if (p.tagline) parts.push(p.tagline);
  return parts.filter(Boolean).join(" · ");
}

export function CommandCenter() {
  const [pulse, setPulse] = useState<Pulse | null>(null);

  const load = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const [state, tasks, vitalsRes] = await Promise.all([
      fetch("/api/state").then((r) => r.json()),
      fetch(`/api/tasks?date=${today}`).then((r) => r.json()),
      fetch("/api/vitals").then((r) => r.json()).catch(() => ({ vitals: null })),
    ]);

    const goals = ((state.goals ?? []) as Goal[]).filter((g) => g.active && !g.archived);
    const progresses = goals.map((g) => calcGoalProgress(g));
    const goalsProgress = progresses.length
      ? Math.round(progresses.reduce((a, b) => a + b, 0) / progresses.length)
      : 0;

    let overdue = 0;
    for (const g of goals) {
      for (const st of g.stages ?? []) {
        if (!st.done && !st.archived && st.deadlineEnd && st.deadlineEnd < today) overdue += 1;
      }
    }

    const taskList = (tasks.tasks ?? []) as { done: boolean }[];
    const todayTotal = taskList.length;
    const todayDone = taskList.filter((t) => t.done).length;
    const todayPct = todayTotal ? Math.round((todayDone / todayTotal) * 100) : 100;

    // Overall: goals weigh more, today tasks give daily pulse
    const overall = Math.round(goalsProgress * 0.7 + todayPct * 0.3);

    const v = vitalsRes.vitals as VitalsDay | null;
    const health = v ? healthLine(v) : null;

    const projects = ((state.projects ?? []) as Project[])
      .filter((p) => p.status !== "archived")
      .map((p) => ({ id: p.id, name: p.name, line: projectLine(p) }));

    let attention: string | null = null;
    if (overdue > 0) attention = `просрочено этапов: ${overdue}`;
    else if (health && health.score < 50) attention = "здоровье ниже нормы";
    else if (todayTotal > 0 && todayDone === 0) attention = "сегодня ещё ничего не закрыто";

    setPulse({
      overall,
      todayDone,
      todayTotal,
      goalsProgress,
      overdue,
      health,
      projects,
      attention,
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!pulse) {
    return (
      <div className="fade-in mx-auto max-w-md py-12 text-center text-[var(--ink-faint)]">…</div>
    );
  }

  return (
    <div className="fade-in mx-auto max-w-md space-y-6">
      <div>
        <h1 className="font-display text-3xl">Пульт</h1>
      </div>

      <div className="card space-y-4 p-5">
        <div>
          <p className="meta-quiet">Общий прогресс</p>
          <p className="mt-1 text-[40px] font-bold tracking-[-0.04em] leading-none">{pulse.overall}%</p>
          <p className="analytics-line mt-3">
            цели <strong>{pulse.goalsProgress}%</strong>
            {" · "}сегодня <strong>{pulse.todayDone}</strong>/{pulse.todayTotal}
          </p>
        </div>
        <div className="meter">
          <span style={{ width: `${pulse.overall}%` }} />
        </div>
      </div>

      <div className="card space-y-2 p-5">
        <p className="meta-quiet">Здоровье</p>
        {pulse.health ? (
          <>
            <p className="text-[28px] font-bold tracking-[-0.03em] leading-none">{pulse.health.score}</p>
            <p className="analytics-line">
              {pulse.health.sleep}
              {" · "}
              {pulse.health.water}
              {" · "}
              {pulse.health.prayers}
            </p>
          </>
        ) : (
          <p className="analytics-line">—</p>
        )}
      </div>

      <div className="card space-y-3 p-5">
        <p className="meta-quiet">Проекты</p>
        {pulse.projects.length > 0 && (
          <ul className="space-y-3">
            {pulse.projects.map((p) => (
              <li key={p.id}>
                <p className="item-title">{p.name}</p>
                <p className="meta-quiet mt-0.5">{p.line}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {pulse.attention && (
        <p className="text-center text-[13px] text-[var(--ink-faint)]">{pulse.attention}</p>
      )}
    </div>
  );
}
