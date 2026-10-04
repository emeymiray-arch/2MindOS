"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/client-api";
import { EmptyState } from "@/components/ui/Progress";
import { HBar, LineChart, Sparkline } from "@/components/ui/Charts";
import { toast } from "@/components/ui/Toast";

type AnalyticsGoal = {
  id: string;
  title: string;
  area?: string;
  reality: {
    status: "ahead" | "on_track" | "behind" | "no_plan";
    label: string;
    detail: string;
    actual: number;
    deadlineRisk: boolean;
    daysLeft: number | null;
  };
  nextStep: { title: string; stageTitle: string } | null;
  week?: { percent: number; completed: number; planned: number };
  hasPlan?: boolean;
};

type WeekPulse = {
  weekStart: string;
  planned: number;
  completed: number;
  percent: number;
};

type DayPulse = { date: string; planned: number; completed: number; percent: number };

type FocusRow = {
  id: string;
  name: string;
  focus: "main" | "support" | "background";
  done: number;
  share: number;
};

type ForecastRow = {
  id: string;
  title: string;
  progress: number;
  eta: string | null;
  deadline: string | null;
  lateDays: number | null;
};

type Analytics = {
  asOf: string;
  week: WeekPulse;
  weeks: WeekPulse[];
  days14: DayPulse[];
  goals: AnalyticsGoal[];
  topGoals: {
    id: string;
    title: string;
    area?: string;
    status: string;
    progress: number;
    weekPercent: number;
    hasPlan: boolean;
    nextStep: string | null;
    side?: "inner" | "outer" | null;
  }[];
  byStatus: { ahead: number; on_track: number; behind: number; no_plan: number };
  byWeekday: { day: number; label: string; planned: number; completed: number; percent: number }[];
  focusVsReality?: FocusRow[];
  forecast?: ForecastRow[];
  stageDetail: {
    goalId: string;
    goalTitle: string;
    stageId: string;
    title: string;
    progress: number;
    status: string;
    modulesDone: number;
    modulesTotal: number;
    deadlineEnd?: string;
  }[];
  velocity: {
    activeStreak: number;
    bestStreak60: number;
    daysWithPlan14: number;
    daysFullyDone14: number;
    avgTasksDay14: number;
    planned14: number;
    done14: number;
    percent14: number;
  };
  tasks: {
    done30: number;
    created30: number;
    completionRate: number;
    overdue: number;
    bySource: {
      goals: { total: number; done: number };
      personal: { total: number; done: number };
      habits: { total: number; done: number };
    };
    overdueItems: { id: string; title: string; date: string; ageDays: number; goalId?: string }[];
  };
  habits: {
    active: number;
    logs30: number;
    list: { id: string; title: string; logs30: number; daysHit: number; rate: number }[];
  };
  alerts: {
    needPlan: { id: string; title: string }[];
  };
  system: {
    pendingInbox: number;
  };
  finance: {
    income: number;
    expenses: number;
    salary: number;
    cushion: number;
    currency: string;
  } | null;
};

const FOCUS_LABEL: Record<FocusRow["focus"], string> = {
  main: "главное",
  support: "поддержка",
  background: "фон",
};

function mondayOf(iso: string) {
  const d = new Date(iso + "T12:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function shortDate(iso: string) {
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return iso.slice(5);
  }
}

function dayShort(iso: string) {
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString("ru-RU", { weekday: "short" });
  } catch {
    return iso.slice(8);
  }
}

function money(n: number, currency: string) {
  try {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: currency === "RUB" ? "RUB" : currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${Math.round(n)} ${currency}`;
  }
}

function PanelTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-2">
      <h2 className="text-[15px] font-semibold tracking-tight">{children}</h2>
      {aside}
    </div>
  );
}

function forecastBadge(f: ForecastRow) {
  if (!f.eta) return { text: "мало данных", color: "var(--ink-faint)" };
  if (f.lateDays == null) return { text: "без дедлайна", color: "var(--ink-faint)" };
  if (f.lateDays > 0) return { text: `опоздание ${f.lateDays} дн`, color: "var(--behind)" };
  return { text: `запас ${-f.lateDays} дн`, color: "var(--ahead)" };
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [worked, setWorked] = useState("");
  const [failed, setFailed] = useState("");
  const [nextChange, setNextChange] = useState("");
  const [busy, setBusy] = useState(false);
  const [taskBusy, setTaskBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await apiGet("/api/os?compose=0");
    if (res.ok && res.data.analytics) setData(res.data.analytics as Analytics);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveReview(e: React.FormEvent) {
    e.preventDefault();
    if (!data || busy) return;
    if (!worked.trim() && !failed.trim() && !nextChange.trim()) return;
    setBusy(true);
    const res = await apiPost("/api/life", {
      action: "upsertReview",
      cadence: "week",
      periodKey: mondayOf(data.asOf),
      worked: worked.trim(),
      failed: failed.trim(),
      nextChange: nextChange.trim(),
    });
    setBusy(false);
    if (!res.ok) toast(res.error ?? "Не сохранилось", "warn");
    else {
      toast("Сохранено", "ok");
      setWorked("");
      setFailed("");
      setNextChange("");
    }
  }

  async function moveToToday(id: string) {
    if (!data) return;
    setTaskBusy(id);
    const res = await apiPost("/api/tasks", { action: "update", id, date: data.asOf });
    setTaskBusy(null);
    if (!res.ok) toast(res.error ?? "Не удалось перенести", "warn");
    else await load();
  }

  async function removeTask(id: string, date: string, title: string) {
    if (!window.confirm(`Удалить «${title}»?`)) return;
    setTaskBusy(id);
    const res = await apiPost("/api/tasks", { action: "delete", id, date });
    setTaskBusy(null);
    if (!res.ok) toast(res.error ?? "Не удалось удалить", "warn");
    else await load();
  }

  if (loading) return <p className="text-[var(--ink-faint)]">Загрузка…</p>;
  if (!data) return <EmptyState title="Нет данных" body="Открой Сегодня." />;

  const behind = data.goals.filter((g) => g.reality.status === "behind");
  const onTrack = data.byStatus.ahead + data.byStatus.on_track;
  const weeksChrono = [...data.weeks].reverse();
  const lineValues = weeksChrono.map((w) => w.percent);
  const lineLabels = weeksChrono.map((w) => shortDate(w.weekStart));
  const violetSteps = ["#7c3aed", "#a855f7", "#c084fc", "#d8b4fe", "#6d28d9", "#9333ea"];

  const v = data.velocity ?? {
    activeStreak: 0,
    bestStreak60: 0,
    daysWithPlan14: 0,
    daysFullyDone14: 0,
    avgTasksDay14: 0,
    planned14: 0,
    done14: 0,
    percent14: 0,
  };

  const planned14 = data.days14.filter((d) => d.planned > 0);
  const bestDay = [...planned14].sort((a, b) => b.percent - a.percent)[0];
  const worstDay = [...planned14].sort((a, b) => a.percent - b.percent)[0];

  const byWeekday = data.byWeekday ?? [];
  const weekdayOrdered =
    byWeekday.length === 7 ? [...byWeekday.slice(1), byWeekday[0]] : byWeekday;
  const weekdayBars = weekdayOrdered.map((w, i) => ({
    label: `${w.label} · ${w.completed}/${w.planned}`,
    value: w.percent,
    max: 100,
    color: violetSteps[i % violetSteps.length],
  }));
  const weekdaysWithPlan = weekdayOrdered.filter((w) => w.planned > 0);
  const strongWd = [...weekdaysWithPlan].sort((a, b) => b.percent - a.percent)[0];
  const weakWd = [...weekdaysWithPlan].sort((a, b) => a.percent - b.percent)[0];
  const heavyWd = [...weekdaysWithPlan].sort((a, b) => b.planned - a.planned)[0];

  const focusRows = data.focusVsReality ?? [];
  const starvedMain = focusRows.filter((r) => r.focus === "main" && r.share < 15);
  const offFocus = focusRows
    .filter((r) => r.focus === "background" && r.share >= 25)
    .map((r) => r.name);

  const forecast = data.forecast ?? [];
  const lateCount = forecast.filter((f) => (f.lateDays ?? 0) > 0).length;

  const src = data.tasks.bySource;
  const sourceMax = Math.max(src.goals.total, src.personal.total, src.habits.total, 1);
  const sourceBars = [
    { label: `Цели ${src.goals.done}/${src.goals.total}`, value: src.goals.done, max: sourceMax, color: "#a855f7" },
    { label: `Личное ${src.personal.done}/${src.personal.total}`, value: src.personal.done, max: sourceMax, color: "#c084fc" },
    { label: `Привычки ${src.habits.done}/${src.habits.total}`, value: src.habits.done, max: sourceMax, color: "#7c3aed" },
  ];

  const finNet = data.finance
    ? data.finance.income + data.finance.salary - data.finance.expenses
    : 0;
  const stageDetail = data.stageDetail ?? [];
  const sideGoals = {
    inner: data.topGoals.filter((g) => g.side === "inner"),
    outer: data.topGoals.filter((g) => g.side === "outer"),
  };
  const avgSide = (list: typeof data.topGoals) =>
    list.length
      ? Math.round(list.reduce((s, g) => s + g.progress, 0) / list.length)
      : 0;

  return (
    <div className="space-y-4 analytics-wide">
      <header className="dash-header">
        <div>
          <p className="page-kicker">Аналитика</p>
          <h1 className="page-title text-[2.2rem] md:text-[2.6rem]">Аналитика</h1>
          <p className="page-lede">
            {data.asOf} · неделя {data.week.percent}% · 14д {v.percent14}% · серия {v.activeStreak}д
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/api/export" className="btn btn-primary" download>
            Экспорт в Excel
          </a>
          <Link href="/goals" className="btn">
            Цели
          </Link>
          <Link href="/map" className="btn">
            Карта
          </Link>
        </div>
      </header>

      <div className="bento">
        <div className="span-3">
          <div className="kpi-card h-full">
            <p className="kpi-label">Цели</p>
            <p className="kpi-value">{data.goals.length}</p>
            <div className="mt-2 flex items-end justify-between">
              <p className="kpi-hint">
                {onTrack} в графике · {data.byStatus.behind} отстаёт
              </p>
            </div>
          </div>
        </div>
        <div className="span-3">
          <div className="kpi-card h-full">
            <p className="kpi-label">Неделя</p>
            <p className="kpi-value">{data.week.percent}%</p>
            <div className="mt-2 flex items-end justify-between">
              <p className="kpi-hint">
                {data.week.completed}/{data.week.planned} задач
              </p>
              <Sparkline values={lineValues} />
            </div>
          </div>
        </div>
        <div className="span-3">
          <div className="kpi-card h-full">
            <p className="kpi-label">Серия</p>
            <p className="kpi-value">
              {v.activeStreak}
              <span className="text-[1rem] text-[var(--ink-faint)]"> дн</span>
            </p>
            <p className="kpi-hint mt-2">рекорд 60д: {v.bestStreak60}</p>
          </div>
        </div>
        <div className="span-3">
          <div className="kpi-card h-full">
            <p className="kpi-label">Закрытые дни · 14д</p>
            <p className="kpi-value">
              {v.daysFullyDone14}
              <span className="text-[1rem] text-[var(--ink-faint)]">/{v.daysWithPlan14}</span>
            </p>
            <p className="kpi-hint mt-2">
              {v.percent14}% задач · ~{v.avgTasksDay14} в день
            </p>
          </div>
        </div>

        <div className="span-6">
          <section className="panel h-full space-y-3">
            <PanelTitle>Сводка · две стороны</PanelTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  {
                    key: "inner" as const,
                    label: "Внутреннее",
                    hint: "Принципы, понятия",
                    list: sideGoals.inner,
                  },
                  {
                    key: "outer" as const,
                    label: "Внешнее",
                    hint: "Стиль, навыки, подача",
                    list: sideGoals.outer,
                  },
                ] as const
              ).map((col) => (
                <div
                  key={col.key}
                  className="rounded-[var(--radius-sm)] border border-[var(--line)] px-3 py-3"
                >
                  <p className="text-[13px] font-semibold">{col.label}</p>
                  <p className="mt-0.5 text-[11px] text-[var(--ink-faint)]">{col.hint}</p>
                  <p className="mt-2 text-[1.6rem] font-semibold tabular-nums">
                    {avgSide(col.list)}
                    <span className="text-[0.9rem] text-[var(--ink-faint)]">%</span>
                  </p>
                  <p className="text-[12px] text-[var(--ink-soft)]">{col.list.length} целей</p>
                  <ul className="mt-2 space-y-1">
                    {col.list.slice(0, 3).map((g) => (
                      <li key={g.id} className="flex justify-between gap-2 text-[12px]">
                        <Link href={`/goals/${g.id}`} className="min-w-0 truncate text-[var(--accent)]">
                          {g.title}
                        </Link>
                        <span className="shrink-0 tabular-nums text-[var(--ink-faint)]">
                          {g.progress}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </div>
        <div className="span-6">
          <section className="panel h-full">
            <PanelTitle aside={<span className="text-[12px] text-[var(--ink-faint)]">% закрытия</span>}>
              Темп 6 недель
            </PanelTitle>
            <LineChart values={lineValues} labels={lineLabels} />
          </section>
        </div>
        <div className="span-8">
          <section className="panel h-full">
            <PanelTitle>День за днём · 14д</PanelTitle>
            <div className="day-heat">
              {data.days14.map((d) => (
                <div
                  key={d.date}
                  title={`${d.date}: ${d.completed}/${d.planned}`}
                  className="flex flex-col items-center gap-1"
                >
                  <div
                    className="w-full rounded-md border border-[var(--line)]"
                    style={{
                      height: 36,
                      background:
                        d.planned === 0
                          ? "rgba(255,255,255,0.02)"
                          : `linear-gradient(180deg, rgba(168,85,247,${0.15 + (d.percent / 100) * 0.55}) 0%, rgba(12,8,22,0.2) 100%)`,
                      boxShadow: d.percent >= 80 ? "0 0 12px rgba(168,85,247,0.35)" : undefined,
                    }}
                  />
                  <span className="text-[9px] text-[var(--ink-faint)]">{dayShort(d.date)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
              <p className="text-[var(--ink-soft)]">
                Лучший:{" "}
                <span className="font-semibold text-[var(--ink)]">
                  {bestDay ? `${shortDate(bestDay.date)} · ${bestDay.percent}%` : "—"}
                </span>
              </p>
              <p className="text-[var(--ink-soft)]">
                Слабый:{" "}
                <span className="font-semibold text-[var(--ink)]">
                  {worstDay ? `${shortDate(worstDay.date)} · ${worstDay.percent}%` : "—"}
                </span>
              </p>
            </div>
          </section>
        </div>
        <div className="span-4">
          <section className="panel h-full space-y-3">
            <PanelTitle>Лучшее время</PanelTitle>
            {weekdaysWithPlan.length < 2 ? (
              <p className="text-[13px] text-[var(--ink-faint)]">Нужно больше дней с задачами.</p>
            ) : (
              <>
                <p className="text-[13px] leading-snug text-[var(--ink-soft)]">
                  Сильный день — <b className="text-[var(--ink)]">{strongWd?.label}</b> ({strongWd?.percent}
                  %). Слабый — <b className="text-[var(--behind)]">{weakWd?.label}</b> ({weakWd?.percent}%)
                  {weakWd && heavyWd && weakWd.day === heavyWd.day
                    ? ": он же самый загруженный, ставь на него меньше."
                    : ": ставь на него меньше задач."}
                </p>
                <HBar items={weekdayBars} />
              </>
            )}
          </section>
        </div>

        <div className="span-6">
          <section className="panel h-full">
            <PanelTitle aside={<span className="text-[12px] text-[var(--ink-faint)]">задачи 30д</span>}>
              Фокус и реальность
            </PanelTitle>
            {focusRows.length === 0 ? (
              <p className="text-[13px] text-[var(--ink-faint)]">
                Задай фокус месяца на{" "}
                <Link href="/map" className="font-semibold text-[var(--accent)]">
                  карте
                </Link>
                .
              </p>
            ) : (
              <>
                <ul className="space-y-3">
                  {focusRows.map((r) => {
                    const starved = r.focus === "main" && r.share < 15;
                    return (
                      <li key={r.id}>
                        <div className="mb-1 flex items-center justify-between gap-2 text-[12px]">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate font-medium">{r.name}</span>
                            <span
                              className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                              style={{
                                borderColor: r.focus === "main" ? "var(--accent)" : "var(--line)",
                                color: r.focus === "main" ? "var(--c-violet)" : "var(--ink-faint)",
                              }}
                            >
                              {FOCUS_LABEL[r.focus]}
                            </span>
                          </span>
                          <span
                            className="shrink-0 tabular-nums"
                            style={{ color: starved ? "var(--behind)" : "var(--ink-soft)" }}
                          >
                            {r.share}% · {r.done}
                          </span>
                        </div>
                        <div className="quest-bar" style={{ height: 6 }}>
                          <span
                            style={{
                              width: `${r.share}%`,
                              background: starved ? "var(--behind)" : undefined,
                            }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-4 text-[12px] leading-snug text-[var(--ink-soft)]">
                  {starvedMain.length
                    ? `Главное недополучает: ${starvedMain.map((r) => r.name).join(", ")} — меньше 15% выполненных задач.`
                    : "Главные направления получают заметную долю работы."}
                  {offFocus.length ? ` Много уходит в фон: ${offFocus.join(", ")}.` : ""}
                </p>
              </>
            )}
          </section>
        </div>
        <div className="span-6">
          <section className="panel h-full">
            <PanelTitle
              aside={
                <span
                  className="text-[12px] font-medium"
                  style={{ color: lateCount ? "var(--behind)" : "var(--ink-faint)" }}
                >
                  {lateCount ? `не успевают: ${lateCount}` : "при текущем темпе"}
                </span>
              }
            >
              Прогноз по целям
            </PanelTitle>
            {forecast.length === 0 ? (
              <p className="text-[14px] text-[var(--ink-soft)]">Нет незакрытых целей.</p>
            ) : (
              <ul className="space-y-2">
                {forecast.slice(0, 7).map((f) => {
                  const badge = forecastBadge(f);
                  return (
                    <li key={f.id}>
                      <Link
                        href={`/goals/${f.id}`}
                        className="block rounded-[var(--radius-sm)] border border-[var(--line)] bg-[rgba(0,0,0,0.15)] px-3 py-2.5"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="min-w-0 truncate text-[13px] font-semibold">{f.title}</p>
                          <span
                            className="shrink-0 text-[11px] font-semibold tabular-nums"
                            style={{ color: badge.color }}
                          >
                            {badge.text}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-[var(--ink-faint)]">
                          {f.progress}% ·{" "}
                          {f.eta ? `финиш ~${shortDate(f.eta)}` : "темп не определён"}
                          {f.deadline ? ` · дедлайн ${shortDate(f.deadline)}` : ""}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-3 text-[11px] text-[var(--ink-faint)]">
              Финиш считается по среднему темпу с момента создания цели.
            </p>
          </section>
        </div>

        <div className="span-7">
          <section className="panel h-full">
            <PanelTitle
              aside={
                <Link href="/goals" className="text-[12px] font-semibold text-[var(--accent)]">
                  все →
                </Link>
              }
            >
              Цели по прогрессу
            </PanelTitle>
            <div className="space-y-2">
              {data.topGoals.slice(0, 8).map((g) => (
                <Link
                  key={g.id}
                  href={`/goals/${g.id}`}
                  className="block rounded-[var(--radius-sm)] border border-[var(--line)] bg-[rgba(0,0,0,0.15)] px-3 py-2.5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold">{g.title}</p>
                      <p className="truncate text-[11px] text-[var(--ink-faint)]">
                        {g.area || "без направления"}
                        {g.nextStep ? ` · ${g.nextStep}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[13px] font-semibold tabular-nums">{g.progress}%</p>
                      <p className="text-[11px] text-[var(--ink-faint)]">нед {g.weekPercent}%</p>
                    </div>
                  </div>
                  <div className="quest-bar mt-2" style={{ height: 6 }}>
                    <span style={{ width: `${Math.min(100, g.progress)}%` }} />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>
        <div className="span-5">
          <section className="panel h-full">
            <PanelTitle aside={<span className="text-[12px] text-[var(--ink-faint)]">{behind.length}</span>}>
              Отстаёт
            </PanelTitle>
            {behind.length === 0 ? (
              <p className="text-[14px] text-[var(--ink-soft)]">Критических нет.</p>
            ) : (
              <div className="space-y-2">
                {behind.slice(0, 8).map((g) => (
                  <Link
                    key={g.id}
                    href={`/goals/${g.id}`}
                    className="block rounded-[var(--radius-sm)] border border-[var(--line)] bg-[rgba(0,0,0,0.15)] px-3 py-2.5"
                  >
                    <p className="truncate text-[13px] font-semibold">{g.title}</p>
                    <p className="mt-0.5 text-[12px] text-[var(--behind)]">
                      {g.reality.detail || g.reality.label}
                    </p>
                    {g.nextStep ? (
                      <p className="mt-0.5 truncate text-[11px] text-[var(--ink-faint)]">
                        дальше: {g.nextStep.title}
                      </p>
                    ) : null}
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="span-6">
          <section className="panel h-full">
            <PanelTitle
              aside={<span className="text-[12px] text-[var(--ink-faint)]">{data.tasks.overdue}</span>}
            >
              Застрявшие задачи
            </PanelTitle>
            {data.tasks.overdueItems.length === 0 ? (
              <p className="text-[14px] text-[var(--ink-soft)]">Ничего не висит.</p>
            ) : (
              <ul className="space-y-2">
                {data.tasks.overdueItems.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--line)] px-3 py-2 text-[13px]"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{t.title}</span>
                    <span className="shrink-0 tabular-nums text-[12px] text-[var(--behind)]">
                      {t.ageDays} дн
                    </span>
                    <button
                      type="button"
                      disabled={taskBusy === t.id}
                      onClick={() => void moveToToday(t.id)}
                      className="shrink-0 rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent)] disabled:opacity-50"
                    >
                      на сегодня
                    </button>
                    <button
                      type="button"
                      aria-label="Удалить"
                      disabled={taskBusy === t.id}
                      onClick={() => void removeTask(t.id, t.date, t.title)}
                      className="shrink-0 rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] font-semibold text-[var(--ink-faint)] hover:text-[var(--behind)] disabled:opacity-50"
                    >
                      удалить
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <div className="span-6">
          <section className="panel h-full">
            <PanelTitle
              aside={
                <span className="text-[12px] text-[var(--ink-faint)]">
                  {data.habits.active} акт · {data.habits.logs30} отметок
                </span>
              }
            >
              Привычки · 30д
            </PanelTitle>
            {data.habits.list.length === 0 ? (
              <p className="text-[14px] text-[var(--ink-soft)]">Нет активных привычек.</p>
            ) : (
              <div className="space-y-3">
                {data.habits.list.slice(0, 8).map((h) => (
                  <div key={h.id}>
                    <div className="mb-1 flex justify-between text-[12px]">
                      <span className="truncate font-medium">{h.title}</span>
                      <span className="tabular-nums text-[var(--ink-soft)]">
                        {h.daysHit}/30 · {h.rate}%
                      </span>
                    </div>
                    <div className="quest-bar" style={{ height: 6 }}>
                      <span style={{ width: `${h.rate}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="span-6">
          <section className="panel h-full">
            <PanelTitle>Этапы в работе · слабые сверху</PanelTitle>
            {stageDetail.length === 0 ? (
              <p className="text-[14px] text-[var(--ink-soft)]">Нет активных этапов.</p>
            ) : (
              <ul className="space-y-2">
                {stageDetail.map((st) => (
                  <li key={st.stageId}>
                    <Link
                      href={`/goals/${st.goalId}`}
                      className="block rounded-[var(--radius-sm)] border border-[var(--line)] bg-[rgba(0,0,0,0.12)] px-3 py-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold">{st.title}</p>
                          <p className="truncate text-[11px] text-[var(--ink-faint)]">
                            {st.goalTitle}
                            {st.deadlineEnd ? ` · до ${shortDate(st.deadlineEnd)}` : ""}
                          </p>
                        </div>
                        <span className="shrink-0 text-[13px] font-semibold tabular-nums">
                          {st.progress}%
                        </span>
                      </div>
                      <div className="quest-bar mt-2" style={{ height: 5 }}>
                        <span style={{ width: `${Math.min(100, st.progress)}%` }} />
                      </div>
                      <p className="mt-1 text-[11px] text-[var(--ink-faint)]">
                        модули {st.modulesDone}/{st.modulesTotal}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <div className="span-6">
          <section className="panel h-full space-y-4">
            <PanelTitle
              aside={
                <span className="text-[12px] text-[var(--ink-faint)]">
                  закрыто {data.tasks.done30}/{data.tasks.created30} · {data.tasks.completionRate}%
                </span>
              }
            >
              Задачи · 30д
            </PanelTitle>
            <HBar items={sourceBars} />
          </section>
        </div>

        <div className="span-6">
          <section className="panel h-full">
            <PanelTitle
              aside={
                <span className="text-[12px] text-[var(--ink-faint)]">{data.alerts.needPlan.length}</span>
              }
            >
              Нужен план
            </PanelTitle>
            {data.alerts.needPlan.length === 0 ? (
              <p className="text-[14px] text-[var(--ink-soft)]">У всех целей есть план.</p>
            ) : (
              <ul className="space-y-2">
                {data.alerts.needPlan.slice(0, 6).map((g) => (
                  <li key={g.id}>
                    <Link
                      href={`/goals/${g.id}`}
                      className="block truncate text-[13px] font-medium text-[var(--accent)]"
                    >
                      {g.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <div className="span-6">
          <section className="panel h-full space-y-3">
            <PanelTitle>Требует внимания</PanelTitle>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Link
                href="/inbox"
                className="rounded-[var(--radius-sm)] border border-[var(--line)] px-3 py-2.5"
              >
                <p className="text-[11px] text-[var(--ink-faint)]">Входящие</p>
                <p className="text-[1.25rem] font-semibold tabular-nums">
                  {data.system.pendingInbox}
                </p>
                <p className="text-[11px] text-[var(--accent)]">
                  {data.system.pendingInbox ? "разобрать →" : "всё разобрано"}
                </p>
              </Link>
              {data.finance ? (
                <Link
                  href="/finance"
                  className="rounded-[var(--radius-sm)] border border-[var(--line)] px-3 py-2.5"
                >
                  <p className="text-[11px] text-[var(--ink-faint)]">Баланс месяца</p>
                  <p
                    className="text-[1.25rem] font-semibold tabular-nums"
                    style={{ color: finNet >= 0 ? "var(--ahead)" : "var(--behind)" }}
                  >
                    {money(finNet, data.finance.currency)}
                  </p>
                  <p className="text-[11px] text-[var(--accent)]">деньги →</p>
                </Link>
              ) : null}
            </div>
          </section>
        </div>

        <div className="span-12">
          <form onSubmit={saveReview} className="panel h-full space-y-3">
            <PanelTitle>Недельный итог</PanelTitle>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="block space-y-1">
                <span className="text-[12px] text-[var(--ink-faint)]">Получилось</span>
                <textarea
                  className="field resize-none"
                  rows={3}
                  value={worked}
                  onChange={(e) => setWorked(e.target.value)}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[12px] text-[var(--ink-faint)]">Не получилось</span>
                <textarea
                  className="field resize-none"
                  rows={3}
                  value={failed}
                  onChange={(e) => setFailed(e.target.value)}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[12px] text-[var(--ink-faint)]">Меняю</span>
                <textarea
                  className="field resize-none"
                  rows={3}
                  value={nextChange}
                  onChange={(e) => setNextChange(e.target.value)}
                />
              </label>
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              Сохранить
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
