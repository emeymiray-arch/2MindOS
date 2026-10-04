"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/client-api";
import { Onboarding } from "@/components/shell/Onboarding";
import { EmptyState } from "@/components/ui/Progress";
import { TaskBlock, TaskRow, type TaskRowData } from "@/components/tasks/TaskRow";
import { Sparkline } from "@/components/ui/Charts";
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
    velocity?: { activeStreak: number; bestStreak60: number };
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
  return candidates.slice(0, 3);
}

function weekdayShort(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("ru-RU", { weekday: "short" });
}

function Panel({
  title,
  action,
  className = "",
  children,
}: {
  title: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`panel flex h-full flex-col ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
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
  const main = (life?.directions ?? []).filter((d) => d.focus === "main");
  const habits = data.tasks.habits;
  const steps = data.tasks.fromGoals;
  const personal = data.tasks.personal;
  const habitsDone = habits.filter((t) => t.done).length;
  const stepsDone = steps.filter((t) => t.done).length;
  const personalDone = personal.filter((t) => t.done).length;
  const done = habitsDone + stepsDone + personalDone;
  const total = habits.length + steps.length + personal.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const weekPcts = (data.analytics?.weeks ?? []).map((w) => w.percent).reverse();
  const days14 = data.analytics?.days14 ?? [];
  const days7 = days14.slice(-7);
  const habitSeries = days14.map((d) => d.habitsPercent ?? 0);
  const goalSeries = days14.map((d) => d.goalsPercent ?? 0);
  const velocity = data.analytics?.velocity;
  const alerts = life?.attention ?? [];
  const mainTasks = pickMain(data);
  const goalsByArea = new Map<string, AnalyticsGoal[]>();
  for (const g of data.analytics?.goals ?? []) {
    if (!g.lifeAreaId) continue;
    goalsByArea.set(g.lifeAreaId, [...(goalsByArea.get(g.lifeAreaId) ?? []), g]);
  }
  const directionSteps = main.map((d) => {
    const goals = (goalsByArea.get(d.id) ?? []).filter((g) => g.reality.actual < 100);
    const goal =
      goals.find((g) => g.reality.status === "behind" && g.nextStep) ??
      goals.find((g) => g.nextStep) ??
      goals[0];
    return { direction: d, goal };
  });

  return (
    <div className="space-y-4">
      <header className="dash-header">
        <div>
          <p className="page-kicker">{formatDay(data.today)}</p>
          <h1 className="page-title text-[2.2rem] md:text-[2.6rem]">Сегодня</h1>
          {life?.vision?.trim() ? <p className="page-lede mt-2">{life.vision}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {main.map((d) => (
            <span
              key={d.id}
              className="stat-pill"
              style={{
                background: "var(--accent-soft)",
                color: "var(--c-violet)",
                borderColor: "color-mix(in srgb, var(--accent) 45%, transparent)",
              }}
            >
              {d.name}
            </span>
          ))}
          <Link href="/map" className="btn btn-primary">
            Карта
          </Link>
        </div>
      </header>

      <div className="bento">
        <div className="span-3">
          <div className="kpi-card h-full">
            <p className="kpi-label">Привычки</p>
            <p className="kpi-value">
              {habitsDone}/{habits.length}
            </p>
            <div className="mt-2 flex items-end justify-between">
              <p className="kpi-hint">14 дней</p>
              <Sparkline values={habitSeries.length ? habitSeries : [0]} />
            </div>
          </div>
        </div>
        <div className="span-3">
          <div className="kpi-card h-full">
            <p className="kpi-label">Шаги</p>
            <p className="kpi-value">
              {stepsDone}/{steps.length}
            </p>
            <div className="mt-2 flex items-end justify-between">
              <p className="kpi-hint">14 дней</p>
              <Sparkline values={goalSeries.length ? goalSeries : [0]} />
            </div>
          </div>
        </div>
        <div className="span-3">
          <div className="kpi-card h-full">
            <p className="kpi-label">Серия</p>
            <p className="kpi-value">
              {velocity?.activeStreak ?? 0}
              <span className="text-[1rem] text-[var(--ink-faint)]"> дн</span>
            </p>
            <p className="kpi-hint mt-2">рекорд {velocity?.bestStreak60 ?? 0} дн</p>
          </div>
        </div>
        <div className="span-3">
          <div className="kpi-card h-full">
            <p className="kpi-label">Неделя</p>
            <p className="kpi-value">{data.week?.percent ?? 0}%</p>
            <div className="mt-2 flex items-end justify-between">
              <p className="kpi-hint">
                {data.week?.completed ?? 0}/{data.week?.planned ?? 0}
              </p>
              <Sparkline values={weekPcts.length ? weekPcts : [0]} />
            </div>
          </div>
        </div>

        <div className="span-5">
          <Panel
            title="Главное сегодня"
            action={
              data.tasks.overdue.length ? (
                <Link href="/analytics" className="text-[12px] font-semibold text-[var(--behind)]">
                  просрочено {data.tasks.overdue.length} →
                </Link>
              ) : null
            }
          >
            {mainTasks.length === 0 ? (
              <p className="text-[14px] text-[var(--ink-soft)]">
                {total > 0 && done === total
                  ? "Всё важное на сегодня закрыто."
                  : "Нет шагов из целей — начни с ритма или своего."}
              </p>
            ) : (
              <TaskBlock>
                <ol className="-mx-1 space-y-1">
                  {mainTasks.map((c) => (
                    <li key={c.task.id}>
                      <TaskRow task={c.task} onChanged={() => void load()} />
                      {c.reason ? (
                        <p
                          className="truncate pb-1 pl-9 text-[11px] font-medium"
                          style={{ color: c.behind ? "var(--behind)" : "var(--ink-faint)" }}
                        >
                          {c.reason}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </TaskBlock>
            )}
          </Panel>
        </div>

        <div className="span-4">
          <Panel
            title="Неделя по дням"
            action={<span className="text-[12px] font-medium text-[var(--ink-faint)]">сегодня {pct}%</span>}
          >
            <div className="grid grid-cols-7 gap-1.5">
              {days7.map((d) => {
                const isToday = d.date === data.today;
                const value = isToday ? pct : d.percent;
                const empty = !isToday && d.planned === 0;
                return (
                  <div
                    key={d.date}
                    title={`${d.date}: ${d.completed}/${d.planned}`}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <div
                      className="flex h-16 w-full items-end overflow-hidden rounded-md border"
                      style={{
                        borderColor: isToday ? "var(--accent)" : "var(--line)",
                        background: "rgba(255,255,255,0.03)",
                      }}
                    >
                      <div
                        className="w-full"
                        style={{
                          height: empty ? 0 : `${Math.max(6, value)}%`,
                          background: "linear-gradient(180deg, rgba(192,132,252,0.9), rgba(124,58,237,0.5))",
                        }}
                      />
                    </div>
                    <span
                      className="text-[10px] font-medium"
                      style={{ color: isToday ? "var(--ink)" : "var(--ink-faint)" }}
                    >
                      {weekdayShort(d.date)}
                    </span>
                    <span className="text-[10px] tabular-nums text-[var(--ink-faint)]">
                      {empty ? "—" : `${value}%`}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-auto pt-3 text-[12px] text-[var(--ink-soft)]">
              Сегодня {done} из {total}. Неделя {data.week?.completed ?? 0}/{data.week?.planned ?? 0}.
            </p>
          </Panel>
        </div>

        <div className="span-3">
          <Panel
            title="Сигналы"
            action={
              <Link href="/analytics" className="text-[12px] font-semibold text-[var(--accent)]">
                все →
              </Link>
            }
          >
            {alerts.length === 0 && data.tasks.overdue.length === 0 ? (
              <p className="text-[14px] text-[var(--ink-soft)]">Без критичных сигналов.</p>
            ) : (
              <ul className="space-y-2.5">
                {alerts.slice(0, 4).map((a, i) => (
                  <li key={i}>
                    <Link
                      href={a.href || "/analytics"}
                      className="block rounded-[var(--radius-sm)] border border-[var(--line)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5 text-[13px] font-medium leading-snug"
                    >
                      {a.text}
                    </Link>
                  </li>
                ))}
                {data.tasks.overdue.slice(0, 3).map((t) => (
                  <li
                    key={t.id}
                    className="rounded-[var(--radius-sm)] border bg-[var(--c-orange-soft)] px-3 py-2.5 text-[13px] font-medium"
                    style={{ borderColor: "color-mix(in srgb, var(--behind) 35%, transparent)" }}
                  >
                    Просрочено: {t.title}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="span-6">
          <Panel
            title="Ритм"
            action={
              <Link href="/habits" className="text-[12px] font-semibold text-[var(--accent)]">
                привычки →
              </Link>
            }
          >
            {habits.length === 0 ? (
              <p className="text-[14px] text-[var(--ink-soft)]">Нет привычек.</p>
            ) : (
              <TaskBlock>
                <div className="-mx-1">
                  {habits.map((t) => (
                    <TaskRow key={t.id} task={t} onChanged={() => void load()} />
                  ))}
                </div>
              </TaskBlock>
            )}
          </Panel>
        </div>

        <div className="span-6">
          <Panel
            title="Шаги пути"
            action={
              <Link href="/goals" className="text-[12px] font-semibold text-[var(--accent)]">
                путь →
              </Link>
            }
          >
            {steps.length === 0 ? (
              <p className="text-[14px] text-[var(--ink-soft)]">Нет шагов из фокуса.</p>
            ) : (
              <TaskBlock>
                <div className="-mx-1 max-h-[18rem] overflow-y-auto">
                  {steps.map((t) => (
                    <TaskRow key={t.id} task={t} onChanged={() => void load()} />
                  ))}
                </div>
              </TaskBlock>
            )}
          </Panel>
        </div>

        <div className="span-8">
          <Panel title="Своё">
            <TaskBlock>
              <div className="-mx-1">
                {personal.map((t) => (
                  <TaskRow key={t.id} task={t} onChanged={() => void load()} />
                ))}
                <form onSubmit={addPersonal} className="flex gap-2 py-3">
                  <input
                    value={personalTitle}
                    onChange={(e) => setPersonalTitle(e.target.value)}
                    placeholder="Добавить задачу…"
                    className="field min-w-0 flex-1"
                  />
                  <button type="submit" className="btn btn-primary shrink-0">
                    Добавить
                  </button>
                </form>
              </div>
            </TaskBlock>
          </Panel>
        </div>

        <div className="span-4">
          <Panel title="Следующий шаг">
            {directionSteps.length === 0 ? (
              <p className="text-[14px] text-[var(--ink-soft)]">
                Задай главное на{" "}
                <Link href="/map" className="font-semibold text-[var(--accent)]">
                  карте
                </Link>
                .
              </p>
            ) : (
              <ul className="space-y-2">
                {directionSteps.map(({ direction, goal }) => (
                  <li key={direction.id}>
                    <Link
                      href={goal ? `/goals/${goal.id}` : "/map"}
                      className="block rounded-[var(--radius-sm)] border border-[var(--line)] px-3 py-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-[var(--c-violet)]">
                          {direction.name}
                        </p>
                        {goal ? (
                          <span className="shrink-0 text-[11px] tabular-nums text-[var(--ink-faint)]">
                            {goal.reality.actual}%
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[13px] font-medium leading-snug">
                        {goal?.nextStep?.title ?? (goal ? goal.title : "Нет активной цели")}
                      </p>
                      {goal?.nextStep ? (
                        <p className="mt-0.5 truncate text-[11px] text-[var(--ink-faint)]">
                          {goal.title}
                        </p>
                      ) : null}
                      {goal ? (
                        <div className="quest-bar mt-2" style={{ height: 4 }}>
                          <span style={{ width: `${Math.min(100, goal.reality.actual)}%` }} />
                        </div>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
