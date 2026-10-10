"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/client-api";
import { Onboarding } from "@/components/shell/Onboarding";
import { EmptyState } from "@/components/ui/Progress";
import { TaskBlock, TaskRow, type TaskRowData } from "@/components/tasks/TaskRow";
import {
  IconAlert,
  IconFlame,
  IconHabits,
  IconSteps,
  IconTarget,
} from "@/components/ui/Icons";
import { WidgetHead, KpiTile } from "@/components/ui/Widgets";
import { toast } from "@/components/ui/Toast";

type Priority = "high" | "medium" | "low";

type GoalTask = TaskRowData & {
  goalTitle?: string;
  goalId?: string;
  effectivePriority?: Priority;
};

type LifePanel = {
  vision: string;
  horizonStageLabel: string;
  directions: { id: string; name: string; focus: "main" | "support" | "background" }[];
  attention: { kind: string; text: string; href?: string }[];
};

type WeekPulse = {
  planned: number;
  completed: number;
  percent: number;
};

type Day = {
  date: string;
  planned: number;
  completed: number;
  percent: number;
  goalsPercent?: number;
  habitsPercent?: number;
};

type AnalyticsGoal = {
  id: string;
  title: string;
  lifeAreaId?: string;
  reality: { actual: number; status: string };
  nextStep: { title: string; stageTitle: string } | null;
};

type HomeData = {
  today: string;
  week?: WeekPulse;
  analytics?: {
    weeks?: WeekPulse[];
    days14?: Day[];
    goals?: AnalyticsGoal[];
    stages?: { done: number; total: number };
    modules?: { done: number; total: number };
    habits?: { active: number };
    byStatus?: { ahead: number; on_track: number; behind: number; no_plan: number };
    velocity?: {
      activeStreak: number;
      bestStreak60: number;
      avgTasksDay14?: number;
      percent14?: number;
    };
  };
  life?: LifePanel;
  goals?: { id: string; reality: { status: string } }[];
  tasks: {
    fromGoals: GoalTask[];
    personal: GoalTask[];
    habits: TaskRowData[];
    overdue: TaskRowData[];
  };
};

function formatDay(iso: string) {
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString("ru-RU", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  } catch {
    return iso;
  }
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

function pickMain(data: HomeData) {
  const behind = new Set(
    (data.goals ?? []).filter((g) => g.reality.status === "behind").map((g) => g.id)
  );
  const candidates = [
    ...data.tasks.fromGoals.map((t) => ({
      task: t,
      behind: Boolean(t.goalId && behind.has(t.goalId)),
      reason: t.goalId && behind.has(t.goalId) ? `цель отстаёт · ${t.goalTitle ?? ""}` : t.goalTitle ?? "",
    })),
    ...data.tasks.personal
      .filter((t) => t.effectivePriority === "high")
      .map((t) => ({ task: t, behind: false, reason: "высокий приоритет" })),
  ].filter((c) => !c.task.done);
  candidates.sort(
    (a, b) =>
      Number(b.behind) - Number(a.behind) ||
      PRIORITY_RANK[a.task.effectivePriority ?? "medium"] -
        PRIORITY_RANK[b.task.effectivePriority ?? "medium"]
  );
  return candidates.slice(0, 4);
}

function weekdayShort(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("ru-RU", { weekday: "short" });
}

export default function HomePage() {
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [personalTitle, setPersonalTitle] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);

  const load = useCallback(async () => {
    const [osRes, stateRes] = await Promise.all([apiGet("/api/os"), apiGet("/api/state")]);
    if (osRes.ok) setData(osRes.data as unknown as HomeData);
    if (stateRes.ok) {
      const settings = stateRes.data.settings as { onboardingDone?: boolean } | undefined;
      const goals = (stateRes.data.goals as { archived?: boolean; active?: boolean }[]) ?? [];
      const habits = (stateRes.data.habits as { archived?: boolean; active?: boolean }[]) ?? [];
      const activeGoals = goals.filter((g) => g.active !== false && !g.archived).length;
      const activeHabits = habits.filter((h) => h.active !== false && !h.archived).length;
      setShowOnboarding(settings?.onboardingDone !== true && activeGoals === 0 && activeHabits === 0);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addPersonal(e: React.FormEvent) {
    e.preventDefault();
    const title = personalTitle.trim();
    if (!title) return;
    const res = await apiPost("/api/tasks", { action: "add", title, date: data?.today });
    if (!res.ok) {
      toast(res.error ?? "Не удалось добавить", "warn");
      return;
    }
    setPersonalTitle("");
    await load();
  }

  if (loading) return <p className="text-[var(--ink-faint)]">Загрузка…</p>;
  if (showOnboarding) {
    return (
      <Onboarding
        onDone={() => {
          setShowOnboarding(false);
          void load();
        }}
      />
    );
  }
  if (!data) {
    return (
      <EmptyState
        title="Нет данных"
        body="Открой настройки или обнови страницу."
        action={
          <Link href="/settings" className="btn btn-primary">
            Настройки
          </Link>
        }
      />
    );
  }

  const life = data.life;
  const habits = data.tasks.habits;
  const steps = data.tasks.fromGoals;
  const personal = data.tasks.personal;
  const habitsDone = habits.filter((t) => t.done).length;
  const stepsDone = steps.filter((t) => t.done).length;
  const personalDone = personal.filter((t) => t.done).length;
  const done = habitsDone + stepsDone + personalDone;
  const total = habits.length + steps.length + personal.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const habitPct = habits.length ? Math.round((habitsDone / habits.length) * 100) : 0;
  const stepsPct = steps.length ? Math.round((stepsDone / steps.length) * 100) : 0;
  const weekPcts = (data.analytics?.weeks ?? []).map((w) => w.percent).reverse();
  const days14 = data.analytics?.days14 ?? [];
  const days7 = days14.slice(-7);
  const habitSeries = days14.map((d) => d.habitsPercent ?? 0);
  const goalSeries = days14.map((d) => d.goalsPercent ?? 0);
  const velocity = data.analytics?.velocity;
  const alerts = life?.attention ?? [];
  const mainTasks = pickMain(data);
  const mainIds = new Set(mainTasks.map((c) => c.task.id));
  const otherSteps = steps.filter((t) => !mainIds.has(t.id));
  const status = data.analytics?.byStatus;
  const goalsActive =
    (status?.ahead ?? 0) +
    (status?.on_track ?? 0) +
    (status?.behind ?? 0) +
    (status?.no_plan ?? 0);
  const goalsOk = (status?.ahead ?? 0) + (status?.on_track ?? 0);
  const stages = data.analytics?.stages ?? { done: 0, total: 0 };
  const modules = data.analytics?.modules ?? { done: 0, total: 0 };
  const stagePct = stages.total ? Math.round((stages.done / stages.total) * 100) : 0;
  const modulePct = modules.total ? Math.round((modules.done / modules.total) * 100) : 0;

  const mainDirs = (life?.directions ?? []).filter((d) => d.focus === "main");
  const goalsByArea = new Map<string, AnalyticsGoal[]>();
  for (const g of data.analytics?.goals ?? []) {
    if (!g.lifeAreaId) continue;
    goalsByArea.set(g.lifeAreaId, [...(goalsByArea.get(g.lifeAreaId) ?? []), g]);
  }
  const focusGoals = mainDirs.flatMap((d) => {
    const goals = (goalsByArea.get(d.id) ?? []).filter((g) => g.reality.actual < 100);
    return goals.slice(0, 2).map((goal) => ({ direction: d, goal }));
  });

  return (
    <div className="page-stack">
      <header className="home-hero">
        <h1 className="page-title text-[1.85rem] md:text-[2.25rem]">{formatDay(data.today)}</h1>
      </header>

      <section className="panel pulse-board">
        <div className="pulse-cell">
          <p className="pulse-label">Сегодня</p>
          <p className="pulse-value">{pct}%</p>
          <p className="pulse-sub">
            {done}/{total}
          </p>
        </div>
        <div className="pulse-cell">
          <p className="pulse-label">Неделя</p>
          <p className="pulse-value">{data.week?.percent ?? 0}%</p>
          <p className="pulse-sub">
            {data.week?.completed ?? 0}/{data.week?.planned ?? 0}
          </p>
        </div>
        <div className="pulse-cell">
          <p className="pulse-label">Привычки</p>
          <p className="pulse-value">{habitPct}%</p>
          <p className="pulse-sub">
            {habitsDone}/{habits.length}
          </p>
        </div>
        <div className="pulse-cell">
          <p className="pulse-label">Цели · шаги</p>
          <p className="pulse-value">{stepsPct}%</p>
          <p className="pulse-sub">
            {stepsDone}/{steps.length}
          </p>
        </div>
        <div className="pulse-cell">
          <p className="pulse-label">Серия</p>
          <p className="pulse-value">{velocity?.activeStreak ?? 0}</p>
          <p className="pulse-sub">дней</p>
        </div>
        <div className="pulse-cell">
          <p className="pulse-label">Просрочено</p>
          <p className="pulse-value" style={{ color: data.tasks.overdue.length ? "var(--behind)" : undefined }}>
            {data.tasks.overdue.length}
          </p>
          <p className="pulse-sub">задач</p>
        </div>
      </section>

      <div className="bento">
        <div className="span-3">
          <KpiTile
            label="Привычки"
            value={
              <>
                {habitsDone}
                <span className="kpi-den">/{habits.length}</span>
              </>
            }
            hint={`${habitPct}%`}
            color="#34d399"
            icon={<IconHabits size={16} />}
            series={habitSeries.length ? habitSeries : undefined}
          />
        </div>
        <div className="span-3">
          <KpiTile
            label="Шаги сегодня"
            value={
              <>
                {stepsDone}
                <span className="kpi-den">/{steps.length}</span>
              </>
            }
            hint={`${stepsPct}%`}
            color="#a855f7"
            icon={<IconSteps size={16} />}
            series={goalSeries.length ? goalSeries : undefined}
          />
        </div>
        <div className="span-3">
          <KpiTile
            label="Этапы"
            value={<>{stagePct}%</>}
            hint={`${stages.done}/${stages.total}`}
            color="#fb923c"
            icon={<IconFlame size={16} />}
          />
        </div>
        <div className="span-3">
          <KpiTile
            label="Цели в ритме"
            value={
              <>
                {goalsOk}
                <span className="kpi-den">/{goalsActive}</span>
              </>
            }
            hint={status?.behind ? `${status.behind} отстают` : `${modulePct}% шагов плана`}
            color="#38bdf8"
            icon={<IconTarget size={16} />}
            series={weekPcts.length ? weekPcts : undefined}
          />
        </div>

        <div className="span-7">
          <section className="panel h-full">
            <WidgetHead
              title="Главное сегодня"
              tone="violet"
              action={
                data.tasks.overdue.length ? (
                  <Link href="/analytics" className="widget-link" style={{ color: "var(--behind)" }}>
                    {data.tasks.overdue.length} проср.
                  </Link>
                ) : (
                  <span className="text-[12px] text-[var(--ink-faint)]">{mainTasks.length}</span>
                )
              }
            />
            {mainTasks.length === 0 ? (
              <p className="text-[14px] leading-relaxed text-[var(--ink-soft)]">
                {total > 0 && done === total ? "Всё закрыто." : "Пока пусто."}
              </p>
            ) : (
              <TaskBlock>
                <ol className="-mx-1 space-y-2">
                  {mainTasks.map((c) => (
                    <li key={c.task.id}>
                      <TaskRow task={c.task} onChanged={() => void load()} />
                    </li>
                  ))}
                </ol>
              </TaskBlock>
            )}
          </section>
        </div>

        <div className="span-5">
          <section className="panel h-full">
            <WidgetHead title="Неделя" tone="blue" />
            <div className="mb-3 flex items-baseline gap-2">
              <span className="text-[1.6rem] font-bold tabular-nums text-[var(--accent)]">
                {data.week?.percent ?? 0}%
              </span>
              <span className="text-[12px] text-[var(--ink-faint)]">
                {data.week?.completed ?? 0}/{data.week?.planned ?? 0}
              </span>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {days7.map((d) => {
                const isToday = d.date === data.today;
                const value = isToday ? pct : d.percent;
                const empty = !isToday && d.planned === 0;
                return (
                  <div key={d.date} className="flex flex-col items-center gap-1.5">
                    <div
                      className="week-bar"
                      data-today={isToday}
                      title={`${d.date}: ${d.completed}/${d.planned}`}
                    >
                      <span style={{ height: empty ? "6%" : `${Math.max(10, value)}%` }} />
                    </div>
                    <span className="text-[11px] font-medium text-[var(--ink-faint)]">
                      {weekdayShort(d.date)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <div className="span-6">
          <section className="panel h-full">
            <WidgetHead
              title="Привычки"
              tone="green"
              action={
                <Link href="/habits" className="widget-link">
                  {habitsDone}/{habits.length}
                </Link>
              }
            />
            {habits.length === 0 ? (
              <p className="text-[14px] leading-relaxed text-[var(--ink-soft)]">Нет привычек.</p>
            ) : (
              <TaskBlock>
                <div className="-mx-1 space-y-1">
                  {habits.map((t) => (
                    <TaskRow key={t.id} task={t} onChanged={() => void load()} />
                  ))}
                </div>
              </TaskBlock>
            )}
          </section>
        </div>

        <div className="span-6">
          <section className="panel h-full">
            <WidgetHead
              title="Остальные шаги"
              tone="violet"
              action={
                <Link href="/goals" className="widget-link">
                  {otherSteps.filter((t) => !t.done).length} откр.
                </Link>
              }
            />
            {otherSteps.length === 0 ? (
              <p className="text-[14px] leading-relaxed text-[var(--ink-soft)]">
                {steps.length ? "Всё уже в «Главном»." : "Нет шагов на сегодня."}
              </p>
            ) : (
              <TaskBlock>
                <div className="-mx-1 max-h-[16rem] space-y-1 overflow-y-auto">
                  {otherSteps.map((t) => (
                    <TaskRow key={t.id} task={t} onChanged={() => void load()} />
                  ))}
                </div>
              </TaskBlock>
            )}
          </section>
        </div>

        <div className="span-4">
          <section className="panel h-full">
            <WidgetHead
              title="Сигналы"
              tone="orange"
              action={<Link href="/analytics" className="widget-link">аналит.</Link>}
            />
            {alerts.length === 0 && data.tasks.overdue.length === 0 ? (
              <p className="text-[14px] leading-relaxed text-[var(--ink-soft)]">Тихо.</p>
            ) : (
              <ul className="space-y-2.5">
                {alerts.slice(0, 3).map((a, i) => (
                  <li key={i}>
                    <Link href={a.href || "/analytics"} className="signal-row">
                      <span className="signal-ico" style={{ color: "#fbbf24" }}>
                        <IconAlert size={14} />
                      </span>
                      <span className="min-w-0 truncate text-[14px] font-medium leading-snug">
                        {a.text}
                      </span>
                    </Link>
                  </li>
                ))}
                {data.tasks.overdue.slice(0, 2).map((t) => (
                  <li key={t.id} className="signal-row is-bad">
                    <span className="signal-ico" style={{ color: "var(--behind)" }}>
                      <IconAlert size={14} />
                    </span>
                    <span className="min-w-0 truncate text-[14px] font-medium leading-snug">
                      {t.title}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="span-4">
          <section className="panel h-full">
            <WidgetHead
              title="Цели в фокусе"
              tone="pink"
              action={<Link href="/map" className="widget-link">карта</Link>}
            />
            {focusGoals.length === 0 ? (
              <p className="text-[14px] leading-relaxed text-[var(--ink-soft)]">
                Нет активных целей в главном.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {focusGoals.map(({ direction, goal }) => (
                  <li key={`${direction.id}-${goal.id}`}>
                    <Link href={`/goals/${goal.id}`} className="next-card">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold leading-snug">
                          {goal.title}
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] text-[var(--ink-faint)]">
                          {direction.name}
                          {goal.nextStep?.title ? ` · дальше: ${goal.nextStep.title}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-[15px] font-bold tabular-nums text-[var(--accent)]">
                        {Math.round(goal.reality.actual)}%
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="span-4">
          <section className="panel h-full">
            <WidgetHead title="Своё" tone="blue" />
            <TaskBlock>
              <div className="-mx-1 space-y-1">
                {personal.map((t) => (
                  <TaskRow key={t.id} task={t} onChanged={() => void load()} />
                ))}
                <form onSubmit={addPersonal} className="flex gap-2 pt-3">
                  <input
                    value={personalTitle}
                    onChange={(e) => setPersonalTitle(e.target.value)}
                    placeholder="Задача…"
                    className="field min-w-0 flex-1"
                  />
                  <button type="submit" className="btn btn-primary shrink-0">
                    +
                  </button>
                </form>
              </div>
            </TaskBlock>
          </section>
        </div>
      </div>
    </div>
  );
}
