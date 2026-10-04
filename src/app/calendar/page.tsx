"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/client-api";
import { EmptyState } from "@/components/ui/Progress";

type SidePulse = { planned: number; completed: number; percent: number };
type Sides = { inner: SidePulse; outer: SidePulse; unset: SidePulse };

type GoalLite = {
  id: string;
  title: string;
  progress: number;
  side: "inner" | "outer" | null;
  area?: string;
  deadline?: string | null;
};

type YearData = {
  year: number;
  months: {
    month: number;
    key: string;
    planned: number;
    completed: number;
    percent: number;
    achieved: number;
  }[];
  summary: {
    planned: number;
    completed: number;
    percent: number;
    sides: Sides;
    achieved: GoalLite[];
    active: GoalLite[];
    principles: { inner: number; outer: number };
    habitHits: number;
    outcomes: number;
  };
};

type MonthData = {
  year: number;
  month: number;
  key: string;
  days: {
    date: string;
    day: number;
    weekday: number;
    planned: number;
    completed: number;
    percent: number;
  }[];
  summary: {
    planned: number;
    completed: number;
    percent: number;
    sides: Sides;
    achieved: GoalLite[];
    focusGoals: GoalLite[];
    habitHits: number;
    outcomes: number;
    review: { worked?: string; failed?: string; nextChange?: string } | null;
  };
};

type DayTask = {
  id: string;
  title: string;
  done: boolean;
  goalTitle?: string;
  side: "inner" | "outer" | null;
};

type DayData = {
  date: string;
  prev: string;
  next: string;
  summary: { planned: number; completed: number; percent: number; sides: Sides };
  tasks: { habits: DayTask[]; fromGoals: DayTask[]; personal: DayTask[] };
  goals: GoalLite[];
  principles: { id: string; title: string; layer: "inner" | "outer" }[];
  review: {
    happened?: string;
    worked?: string;
    failed?: string;
    learned?: string;
    nextChange?: string;
  } | null;
};

const MONTH_NAMES = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];
const WD = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

function monthTitle(m: number) {
  return MONTH_NAMES[m - 1] ?? String(m);
}

function formatDay(iso: string) {
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString("ru-RU", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function SideSplit({
  sides,
  achieved,
  active,
}: {
  sides: Sides;
  achieved?: GoalLite[];
  active?: GoalLite[];
}) {
  const columns: { key: "inner" | "outer"; label: string; hint: string }[] = [
    {
      key: "inner",
      label: "Внутреннее",
      hint: "Принципы, понятия, дисциплина",
    },
    {
      key: "outer",
      label: "Внешнее",
      hint: "Стиль, навыки, подача",
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {columns.map((col) => {
        const pulse = sides[col.key];
        const doneGoals = (achieved ?? []).filter((g) => g.side === col.key);
        const openGoals = (active ?? []).filter((g) => g.side === col.key);
        return (
          <section key={col.key} className="panel space-y-3">
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight">{col.label}</h3>
              <p className="mt-0.5 text-[12px] text-[var(--ink-faint)]">{col.hint}</p>
            </div>
            <div className="flex items-end justify-between gap-3">
              <p className="text-[2rem] font-semibold tabular-nums leading-none">
                {pulse.percent}
                <span className="text-[1rem] text-[var(--ink-faint)]">%</span>
              </p>
              <p className="text-[12px] text-[var(--ink-soft)]">
                {pulse.completed}/{pulse.planned} задач
              </p>
            </div>
            <div className="quest-bar" style={{ height: 6 }}>
              <span style={{ width: `${pulse.percent}%` }} />
            </div>
            {doneGoals.length ? (
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
                  Достигнуто
                </p>
                <ul className="space-y-1">
                  {doneGoals.slice(0, 5).map((g) => (
                    <li key={g.id}>
                      <Link
                        href={`/goals/${g.id}`}
                        className="truncate text-[13px] font-medium text-[var(--accent)]"
                      >
                        {g.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {openGoals?.length ? (
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
                  В работе
                </p>
                <ul className="space-y-1">
                  {openGoals.slice(0, 4).map((g) => (
                    <li key={g.id} className="flex justify-between gap-2 text-[13px]">
                      <Link href={`/goals/${g.id}`} className="min-w-0 truncate font-medium">
                        {g.title}
                      </Link>
                      <span className="shrink-0 tabular-nums text-[var(--ink-faint)]">
                        {g.progress}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {!doneGoals.length && !openGoals?.length ? (
              <p className="text-[13px] text-[var(--ink-faint)]">Пока пусто на этой стороне.</p>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function TaskList({ title, items }: { title: string; items: DayTask[] }) {
  if (!items.length) return null;
  return (
    <section className="panel">
      <h3 className="mb-3 text-[15px] font-semibold tracking-tight">{title}</h3>
      <ul className="space-y-2">
        {items.map((t) => (
          <li
            key={t.id}
            className="flex items-start justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--line)] px-3 py-2.5"
          >
            <div className="min-w-0">
              <p
                className="text-[14px] font-medium"
                style={{
                  textDecoration: t.done ? "line-through" : undefined,
                  color: t.done ? "var(--ink-faint)" : undefined,
                }}
              >
                {t.title}
              </p>
              {t.goalTitle ? (
                <p className="mt-0.5 truncate text-[11px] text-[var(--ink-faint)]">{t.goalTitle}</p>
              ) : null}
            </div>
            <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
              {t.side === "inner" ? "внутр" : t.side === "outer" ? "внеш" : "—"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function CalendarPage() {
  const [view, setView] = useState<"year" | "month" | "day">("year");
  const [year, setYear] = useState<number>(() => new Date().getFullYear());
  const [month, setMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [date, setDate] = useState<string | null>(null);
  const [today, setToday] = useState("");
  const [yearData, setYearData] = useState<YearData | null>(null);
  const [monthData, setMonthData] = useState<MonthData | null>(null);
  const [dayData, setDayData] = useState<DayData | null>(null);
  const [loading, setLoading] = useState(true);

  const query = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.search;
  }, []);

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const d = sp.get("date");
      const y = sp.get("year");
      const m = sp.get("month");
      if (d) {
        setView("day");
        setDate(d);
        setYear(Number(d.slice(0, 4)));
        setMonth(Number(d.slice(5, 7)));
      } else if (y && m) {
        setView("month");
        setYear(Number(y));
        setMonth(Number(m));
        setDate(null);
      } else if (y) {
        setView("year");
        setYear(Number(y));
        setDate(null);
      }
    } catch {
      /* ignore */
    }
  }, [query]);

  const pushUrl = useCallback((next: { view: "year" | "month" | "day"; year: number; month?: number; date?: string }) => {
    const sp = new URLSearchParams();
    if (next.view === "day" && next.date) sp.set("date", next.date);
    else if (next.view === "month" && next.month) {
      sp.set("year", String(next.year));
      sp.set("month", String(next.month));
    } else sp.set("year", String(next.year));
    const url = `/calendar?${sp.toString()}`;
    window.history.pushState({}, "", url);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    let path = `/api/calendar?year=${year}`;
    if (view === "month") path = `/api/calendar?year=${year}&month=${month}`;
    if (view === "day" && date) path = `/api/calendar?date=${date}`;
    const res = await apiGet(path);
    if (res.ok) {
      setToday(String(res.data.today ?? ""));
      if (res.data.view === "year") {
        setYearData(res.data.year as YearData);
        setMonthData(null);
        setDayData(null);
      } else if (res.data.view === "month") {
        setMonthData(res.data.month as MonthData);
        setDayData(null);
      } else if (res.data.view === "day") {
        setDayData(res.data.day as DayData);
      }
    }
    setLoading(false);
  }, [view, year, month, date]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function onPop() {
      const sp = new URLSearchParams(window.location.search);
      const d = sp.get("date");
      const y = sp.get("year");
      const m = sp.get("month");
      if (d) {
        setView("day");
        setDate(d);
        setYear(Number(d.slice(0, 4)));
        setMonth(Number(d.slice(5, 7)));
      } else if (y && m) {
        setView("month");
        setYear(Number(y));
        setMonth(Number(m));
        setDate(null);
      } else {
        setView("year");
        if (y) setYear(Number(y));
        setDate(null);
      }
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function openYear(y: number) {
    setView("year");
    setYear(y);
    setDate(null);
    pushUrl({ view: "year", year: y });
  }

  function openMonth(y: number, m: number) {
    setView("month");
    setYear(y);
    setMonth(m);
    setDate(null);
    pushUrl({ view: "month", year: y, month: m });
  }

  function openDay(d: string) {
    setView("day");
    setDate(d);
    setYear(Number(d.slice(0, 4)));
    setMonth(Number(d.slice(5, 7)));
    pushUrl({ view: "day", year: Number(d.slice(0, 4)), date: d });
  }

  if (loading && !yearData && !monthData && !dayData) {
    return <p className="text-[var(--ink-faint)]">Загрузка календаря…</p>;
  }

  return (
    <div className="space-y-4">
      <header className="dash-header">
        <div>
          <p className="page-kicker">Календарь</p>
          <h1 className="page-title text-[2.2rem] md:text-[2.6rem]">
            {view === "year" && year}
            {view === "month" && `${monthTitle(month)} ${year}`}
            {view === "day" && date && formatDay(date)}
          </h1>
          <p className="page-lede">
            Год → месяц → день. Сводки разделены на внутреннее и внешнее.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/api/export" className="btn" download>
            Экспорт в Excel
          </a>
          {view !== "year" ? (
            <button type="button" className="btn" onClick={() => openYear(year)}>
              ← Год
            </button>
          ) : null}
          {view === "day" ? (
            <button type="button" className="btn" onClick={() => openMonth(year, month)}>
              ← Месяц
            </button>
          ) : null}
          {today ? (
            <button type="button" className="btn btn-primary" onClick={() => openDay(today)}>
              Сегодня
            </button>
          ) : null}
        </div>
      </header>

      {view === "year" && yearData ? (
        <>
          <div className="mb-2 flex items-center justify-between">
            <button type="button" className="btn" onClick={() => openYear(year - 1)}>
              ← {year - 1}
            </button>
            <button type="button" className="btn" onClick={() => openYear(year + 1)}>
              {year + 1} →
            </button>
          </div>
          <div className="bento">
            {yearData.months.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => openMonth(year, m.month)}
                className="span-3 panel text-left transition hover:border-[var(--accent)]"
              >
                <p className="text-[13px] font-semibold">{monthTitle(m.month)}</p>
                <p className="mt-2 text-[1.75rem] font-semibold tabular-nums">
                  {m.percent}
                  <span className="text-[0.95rem] text-[var(--ink-faint)]">%</span>
                </p>
                <p className="mt-1 text-[12px] text-[var(--ink-soft)]">
                  {m.completed}/{m.planned} · целей {m.achieved}
                </p>
                <div className="quest-bar mt-3" style={{ height: 5 }}>
                  <span style={{ width: `${m.percent}%` }} />
                </div>
              </button>
            ))}
          </div>

          <section className="panel space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-semibold tracking-tight">Сводка за {year}</h2>
                <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
                  {yearData.summary.completed}/{yearData.summary.planned} задач ·{" "}
                  {yearData.summary.achieved.length} целей достигнуто · привычки{" "}
                  {yearData.summary.habitHits} · исходы {yearData.summary.outcomes}
                </p>
              </div>
              <p className="text-[12px] text-[var(--ink-faint)]">
                принципы: внутр {yearData.summary.principles.inner} · внеш{" "}
                {yearData.summary.principles.outer}
              </p>
            </div>
          </section>
          <SideSplit
            sides={yearData.summary.sides}
            achieved={yearData.summary.achieved}
            active={yearData.summary.active}
          />
        </>
      ) : null}

      {view === "month" && monthData ? (
        <>
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              className="btn"
              onClick={() => {
                const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
                openMonth(prev.y, prev.m);
              }}
            >
              ←
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
                openMonth(next.y, next.m);
              }}
            >
              →
            </button>
          </div>
          <div className="panel">
            <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
              {WD.map((w) => (
                <span key={w}>{w}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({
                length: (monthData.days[0]?.weekday + 6) % 7,
              }).map((_, i) => (
                <div key={`pad-${i}`} />
              ))}
              {monthData.days.map((d) => {
                const isToday = d.date === today;
                return (
                  <button
                    key={d.date}
                    type="button"
                    onClick={() => openDay(d.date)}
                    className="min-h-[4.5rem] rounded-[var(--radius-sm)] border px-1.5 py-1.5 text-left transition"
                    style={{
                      borderColor: isToday ? "var(--accent)" : "var(--line)",
                      background: d.planned
                        ? `linear-gradient(180deg, rgba(168,85,247,${0.08 + (d.percent / 100) * 0.35}) 0%, rgba(0,0,0,0.12) 100%)`
                        : "rgba(255,255,255,0.02)",
                    }}
                  >
                    <p className="text-[12px] font-semibold tabular-nums">{d.day}</p>
                    <p className="mt-1 text-[10px] tabular-nums text-[var(--ink-soft)]">
                      {d.planned ? `${d.percent}%` : "—"}
                    </p>
                    {d.planned ? (
                      <p className="text-[10px] tabular-nums text-[var(--ink-faint)]">
                        {d.completed}/{d.planned}
                      </p>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <section className="panel space-y-2">
            <h2 className="text-[15px] font-semibold tracking-tight">
              Сводка за {monthTitle(month).toLowerCase()}
            </h2>
            <p className="text-[13px] text-[var(--ink-soft)]">
              {monthData.summary.completed}/{monthData.summary.planned} задач ·{" "}
              {monthData.summary.percent}% · привычки {monthData.summary.habitHits} · исходы{" "}
              {monthData.summary.outcomes}
              {monthData.summary.achieved.length
                ? ` · достигнуто ${monthData.summary.achieved.length}`
                : ""}
            </p>
            {monthData.summary.review ? (
              <p className="text-[13px] text-[var(--ink-soft)]">
                Итог месяца: {monthData.summary.review.worked || "—"}
              </p>
            ) : null}
          </section>
          <SideSplit
            sides={monthData.summary.sides}
            achieved={monthData.summary.achieved}
            active={monthData.summary.focusGoals}
          />
        </>
      ) : null}

      {view === "day" && dayData ? (
        <>
          <div className="mb-2 flex items-center justify-between">
            <button type="button" className="btn" onClick={() => openDay(dayData.prev)}>
              ← {dayData.prev.slice(8)}
            </button>
            <button type="button" className="btn" onClick={() => openDay(dayData.next)}>
              {dayData.next.slice(8)} →
            </button>
          </div>

          <div className="bento">
            <div className="span-4">
              <div className="kpi-card h-full">
                <p className="kpi-label">День</p>
                <p className="kpi-value">{dayData.summary.percent}%</p>
                <p className="kpi-hint mt-2">
                  {dayData.summary.completed}/{dayData.summary.planned} задач
                </p>
              </div>
            </div>
            <div className="span-4">
              <div className="kpi-card h-full">
                <p className="kpi-label">Внутреннее</p>
                <p className="kpi-value">{dayData.summary.sides.inner.percent}%</p>
                <p className="kpi-hint mt-2">
                  {dayData.summary.sides.inner.completed}/{dayData.summary.sides.inner.planned}
                </p>
              </div>
            </div>
            <div className="span-4">
              <div className="kpi-card h-full">
                <p className="kpi-label">Внешнее</p>
                <p className="kpi-value">{dayData.summary.sides.outer.percent}%</p>
                <p className="kpi-hint mt-2">
                  {dayData.summary.sides.outer.completed}/{dayData.summary.sides.outer.planned}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-3">
              <TaskList title="Ритм" items={dayData.tasks.habits} />
              <TaskList title="Шаги пути" items={dayData.tasks.fromGoals} />
              <TaskList title="Своё" items={dayData.tasks.personal} />
              {!dayData.tasks.habits.length &&
              !dayData.tasks.fromGoals.length &&
              !dayData.tasks.personal.length ? (
                <EmptyState title="Пустой день" body="Задач на эту дату нет." />
              ) : null}
            </div>
            <div className="space-y-3">
              <section className="panel">
                <h3 className="mb-3 text-[15px] font-semibold tracking-tight">Цели дня</h3>
                {dayData.goals.length === 0 ? (
                  <p className="text-[13px] text-[var(--ink-faint)]">Нет связанных целей.</p>
                ) : (
                  <ul className="space-y-2">
                    {dayData.goals.map((g) => (
                      <li key={g.id}>
                        <Link
                          href={`/goals/${g.id}`}
                          className="block rounded-[var(--radius-sm)] border border-[var(--line)] px-3 py-2.5"
                        >
                          <div className="flex justify-between gap-2">
                            <p className="truncate text-[13px] font-semibold">{g.title}</p>
                            <span className="shrink-0 text-[11px] text-[var(--ink-faint)]">
                              {g.side === "inner" ? "внутр" : g.side === "outer" ? "внеш" : "—"}
                            </span>
                          </div>
                          <div className="quest-bar mt-2" style={{ height: 5 }}>
                            <span style={{ width: `${g.progress}%` }} />
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section className="panel">
                <h3 className="mb-3 text-[15px] font-semibold tracking-tight">Принципы</h3>
                {dayData.principles.length === 0 ? (
                  <p className="text-[13px] text-[var(--ink-faint)]">
                    <Link href="/principles" className="text-[var(--accent)]">
                      Добавить принципы →
                    </Link>
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {dayData.principles.map((p) => (
                      <li
                        key={p.id}
                        className="rounded-[var(--radius-sm)] border border-[var(--line)] px-3 py-2 text-[13px]"
                      >
                        <span className="font-medium">{p.title}</span>
                        <span className="ml-2 text-[11px] text-[var(--ink-faint)]">
                          {p.layer === "inner" ? "внутр" : "внеш"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              {dayData.review ? (
                <section className="panel space-y-2 text-[13px] text-[var(--ink-soft)]">
                  <h3 className="text-[15px] font-semibold tracking-tight text-[var(--ink)]">
                    Итог дня
                  </h3>
                  {dayData.review.worked ? <p>Получилось: {dayData.review.worked}</p> : null}
                  {dayData.review.failed ? <p>Не получилось: {dayData.review.failed}</p> : null}
                  {dayData.review.nextChange ? <p>Меняю: {dayData.review.nextChange}</p> : null}
                </section>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
