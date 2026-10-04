"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/client-api";
import { Onboarding } from "@/components/shell/Onboarding";
import { EmptyState } from "@/components/ui/Progress";
import { TaskBlock, TaskRow, type TaskRowData } from "@/components/tasks/TaskRow";
import { DualRing } from "@/components/ui/Charts";
import {
  IconAlert,
  IconFlame,
  IconHabits,
  IconNote,
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

function formatClock() {
  try {
    return new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
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
  const [clock, setClock] = useState(formatClock);

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

  useEffect(() => {
    const t = window.setInterval(() => setClock(formatClock()), 30_000);
    return () => window.clearInterval(t);
  }, []);

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
  const greet =
    new Date().getHours() < 12 ? "Доброе утро" : new Date().getHours() < 18 ? "Добрый день" : "Добрый вечер";

  return (
    <div className="space-y-4">
      <header className="home-hero">
        <div className="min-w-0">
          <p className="home-greet">
            {greet}
            {life?.vision?.trim() ? (
              <span className="home-greet-sub"> · {life.vision}</span>
            ) : null}
          </p>
          <h1 className="page-title text-[2rem] md:text-[2.4rem]">{formatDay(data.today)}</h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {main.map((d) => (
              <span key={d.id} className="chip-soft">
                {d.name}
              </span>
            ))}
          </div>
        </div>
        <div className="home-clock">
          <p className="home-clock-time">{clock}</p>
          <p className="home-clock-meta">сегодня {pct}% · серия {velocity?.activeStreak ?? 0}д</p>
          <Link href="/map" className="btn btn-primary mt-2">
            Карта
          </Link>
        </div>
      </header>

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
            hint="за 14 дней"
            color="#34d399"
            icon={<IconHabits size={18} />}
            series={habitSeries.length ? habitSeries : [0]}
          />
        </div>
        <div className="span-3">
          <KpiTile
            label="Шаги пути"
            value={
              <>
                {stepsDone}
                <span className="kpi-den">/{steps.length}</span>
              </>
            }
            hint="за 14 дней"
            color="#a855f7"
            icon={<IconSteps size={18} />}
            series={goalSeries.length ? goalSeries : [0]}
          />
        </div>
        <div className="span-3">
          <KpiTile
            label="Серия"
            value={
              <>
                {velocity?.activeStreak ?? 0}
                <span className="kpi-den"> дн</span>
              </>
            }
            hint={`рекорд ${velocity?.bestStreak60 ?? 0} дн`}
            color="#fb923c"
            icon={<IconFlame size={18} />}
          />
        </div>
        <div className="span-3">
          <KpiTile
            label="Неделя"
            value={<>{data.week?.percent ?? 0}%</>}
            hint={`${data.week?.completed ?? 0}/${data.week?.planned ?? 0} задач`}
            color="#38bdf8"
            icon={<IconTarget size={18} />}
            series={weekPcts.length ? weekPcts : [0]}
          />
        </div>

        <div className="span-5">
          <section className="panel h-full">
            <WidgetHead
              title="Главное сегодня"
              tone="violet"
              action={
                data.tasks.overdue.length ? (
                  <Link href="/analytics" className="text-[12px] font-semibold text-[var(--behind)]">
                    просрочено {data.tasks.overdue.length}
                  </Link>
                ) : null
              }
            />
            {mainTasks.length === 0 ? (
              <p className="text-[14px] text-[var(--ink-soft)]">
                {total > 0 && done === total
                  ? "Всё важное закрыто."
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
          </section>
        </div>

        <div className="span-3">
          <section className="panel flex h-full flex-col items-center justify-center gap-3">
            <WidgetHead title="Фокус дня" tone="pink" />
            <DualRing
              size={148}
              outer={{ percent: pct, color: "#c084fc", label: "сегодня" }}
              inner={{ percent: data.week?.percent ?? 0, color: "#38bdf8", label: "неделя" }}
            />
            <p className="text-center text-[12px] text-[var(--ink-soft)]">
              {done}/{total} закрыто
            </p>
          </section>
        </div>

        <div className="span-4">
          <section className="panel h-full">
            <WidgetHead
              title="Неделя"
              tone="blue"
              action={<span className="text-[12px] text-[var(--ink-faint)]">{pct}% сегодня</span>}
            />
            <div className="grid grid-cols-7 gap-1.5">
              {days7.map((d) => {
                const isToday = d.date === data.today;
                const value = isToday ? pct : d.percent;
                const empty = !isToday && d.planned === 0;
                return (
                  <div key={d.date} className="flex flex-col items-center gap-1">
                    <div
                      className="week-bar"
                      data-today={isToday}
                      title={`${d.date}: ${d.completed}/${d.planned}`}
                    >
                      <span
                        style={{
                          height: empty ? "6%" : `${Math.max(10, value)}%`,
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-[var(--ink-faint)]">
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
              title="Ритм"
              tone="green"
              action={
                <Link href="/habits" className="text-[12px] font-semibold text-[var(--accent)]">
                  все →
                </Link>
              }
            />
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
          </section>
        </div>

        <div className="span-6">
          <section className="panel h-full">
            <WidgetHead
              title="Шаги пути"
              tone="violet"
              action={
                <Link href="/goals" className="text-[12px] font-semibold text-[var(--accent)]">
                  путь →
                </Link>
              }
            />
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
          </section>
        </div>

        <div className="span-4">
          <section className="panel h-full">
            <WidgetHead
              title="Сигналы"
              tone="orange"
              action={
                <Link href="/analytics" className="text-[12px] font-semibold text-[var(--accent)]">
                  аналитика →
                </Link>
              }
            />
            {alerts.length === 0 && data.tasks.overdue.length === 0 ? (
              <p className="text-[14px] text-[var(--ink-soft)]">Без критичных сигналов.</p>
            ) : (
              <ul className="space-y-2">
                {alerts.slice(0, 4).map((a, i) => (
                  <li key={i}>
                    <Link href={a.href || "/analytics"} className="signal-row">
                      <span className="signal-ico" style={{ color: "#fbbf24" }}>
                        <IconAlert size={16} />
                      </span>
                      <span className="min-w-0 truncate text-[13px] font-medium">{a.text}</span>
                    </Link>
                  </li>
                ))}
                {data.tasks.overdue.slice(0, 3).map((t) => (
                  <li key={t.id} className="signal-row is-bad">
                    <span className="signal-ico" style={{ color: "var(--behind)" }}>
                      <IconAlert size={16} />
                    </span>
                    <span className="min-w-0 truncate text-[13px] font-medium">
                      Просрочено: {t.title}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="span-4">
          <section className="panel h-full">
            <WidgetHead title="Следующий шаг" tone="pink" />
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
                    <Link href={goal ? `/goals/${goal.id}` : "/map"} className="next-card">
                      <span className="next-ico">
                        <IconTarget size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-bold uppercase tracking-wide text-[var(--c-violet)]">
                          {direction.name}
                        </span>
                        <span className="mt-0.5 block text-[13px] font-medium leading-snug">
                          {goal?.nextStep?.title ?? (goal ? goal.title : "Нет активной цели")}
                        </span>
                      </span>
                      {goal ? (
                        <span className="shrink-0 text-[12px] tabular-nums text-[var(--ink-faint)]">
                          {goal.reality.actual}%
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="span-4">
          <section className="panel h-full">
            <WidgetHead
              title="Своё"
              tone="blue"
              action={
                <span className="text-[12px] text-[var(--ink-faint)]">
                  <IconNote size={14} />
                </span>
              }
            />
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
