"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/client-api";
import { queryKeys } from "@/lib/query-keys";
import { PageHero, WidgetHead } from "@/components/ui/Widgets";
import { toast } from "@/components/ui/Toast";

type HabitRow = {
  id: string;
  title: string;
  streak: number;
  todayDone: boolean;
  targetPerDay: number;
  weekHits?: number;
};

type WeekDay = { iso: string; label: string; short: string; isToday: boolean };

type WeekPayload = {
  anchor: string;
  label: string;
  days: WeekDay[];
  logs: Record<string, Record<string, number>>;
};

function shiftWeek(iso: string, delta: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + delta * 7);
  return d.toISOString().slice(0, 10);
}

async function fetchWeek(week: string) {
  const res = await apiGet(`/api/habits?week=${encodeURIComponent(week)}`);
  if (!res.ok) throw new Error("Не удалось загрузить");
  return {
    habits: (res.data.habits as HabitRow[]) ?? [],
    today: String(res.data.today ?? ""),
    week: res.data.week as WeekPayload,
  };
}

export default function HabitsPage() {
  const qc = useQueryClient();
  const [week, setWeek] = useState(() => new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: [...queryKeys.habits, week],
    queryFn: () => fetchWeek(week),
  });

  const habits = data?.habits ?? [];
  const days = data?.week?.days ?? [];
  const logs = data?.week?.logs ?? {};

  const weekScore = useMemo(() => {
    const total = habits.length * Math.max(days.length, 1);
    if (!total) return 0;
    let done = 0;
    for (const h of habits) {
      for (const d of days) {
        if ((logs[h.id]?.[d.iso] ?? 0) > 0) done += 1;
      }
    }
    return Math.round((done / total) * 100);
  }, [habits, days, logs]);

  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.habits });

  const toggleMut = useMutation({
    mutationFn: async ({
      habitId,
      date,
      value,
    }: {
      habitId: string;
      date: string;
      value: number;
    }) => {
      const res = await apiPost("/api/habits", { action: "log", habitId, date, value });
      if (!res.ok) throw new Error(res.error ?? "Ошибка");
    },
    onSuccess: () => invalidate(),
  });

  const createMut = useMutation({
    mutationFn: async (t: string) => {
      const res = await apiPost("/api/habits", { action: "create", title: t });
      if (!res.ok) throw new Error(res.error ?? "Ошибка");
    },
    onSuccess: async () => {
      setTitle("");
      toast("Добавлена", "ok");
      await invalidate();
    },
    onError: (e: Error) => toast(e.message, "warn"),
  });

  const removeMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiPost("/api/habits", { action: "delete", id });
      if (!res.ok) throw new Error(res.error ?? "Не удалось");
    },
    onSuccess: async () => {
      toast("Удалила", "ok");
      await invalidate();
    },
  });

  return (
    <div className="page-stack">
      <PageHero
        title="Привычки"
        action={
          <div className="text-right">
            <p className="home-clock-time" style={{ fontSize: "1.6rem" }}>
              {weekScore}%
            </p>
            <p className="home-clock-meta">неделя</p>
          </div>
        }
      />

      <section className="panel flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn"
            onClick={() => setWeek((w) => shiftWeek(w, -1))}
            aria-label="Прошлая неделя"
          >
            ←
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setWeek(new Date().toISOString().slice(0, 10))}
          >
            Сегодня
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setWeek((w) => shiftWeek(w, 1))}
            aria-label="Следующая неделя"
          >
            →
          </button>
        </div>
        <p className="text-[13px] font-semibold text-[var(--ink-soft)]">
          {data?.week?.label ? `неделя ${data.week.label}` : "…"}
        </p>
      </section>

      <section className="panel habit-tracker">
        <WidgetHead title="Трекер" tone="green" />
        {isLoading ? (
          <p className="py-6 text-[var(--ink-faint)]">Загрузка…</p>
        ) : (
          <div className="habit-tracker-scroll">
            <table className="habit-tracker-table">
              <thead>
                <tr>
                  <th className="habit-tracker-name">Привычка</th>
                  {days.map((d) => (
                    <th key={d.iso} data-today={d.isToday || undefined}>
                      <span className="habit-day-label">{d.label}</span>
                      <span className="habit-day-num">{d.short}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {habits.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="habit-tracker-empty">
                      Добавь первую привычку ниже
                    </td>
                  </tr>
                ) : (
                  habits.map((h) => (
                    <tr key={h.id}>
                      <td className="habit-tracker-name">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{h.title}</p>
                            {h.streak > 0 ? (
                              <p className="text-[11px] text-[var(--ink-faint)]">
                                серия {h.streak}д
                              </p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            className="plan-icon-btn"
                            data-danger="true"
                            aria-label="Удалить"
                            onClick={() => {
                              if (!window.confirm(`Удалить «${h.title}»?`)) return;
                              removeMut.mutate(h.id);
                            }}
                          >
                            ×
                          </button>
                        </div>
                      </td>
                      {days.map((d) => {
                        const done = (logs[h.id]?.[d.iso] ?? 0) > 0;
                        return (
                          <td key={d.iso}>
                            <button
                              type="button"
                              className="habit-cell"
                              data-done={done}
                              data-today={d.isToday || undefined}
                              aria-label={done ? "Снять отметку" : "Отметить"}
                              disabled={toggleMut.isPending}
                              onClick={() =>
                                toggleMut.mutate({
                                  habitId: h.id,
                                  date: d.iso,
                                  value: done ? 0 : 1,
                                })
                              }
                            >
                              <span className="habit-check" aria-hidden>
                                {done ? "✓" : ""}
                              </span>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const t = title.trim();
          if (!t) return;
          createMut.mutate(t);
        }}
        className="panel flex flex-wrap items-end gap-3"
      >
        <div className="min-w-[12rem] flex-1">
          <WidgetHead title="Новая привычка" tone="violet" />
          <input
            className="field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Вода / спорт / чтение"
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={createMut.isPending}>
          Добавить
        </button>
      </form>
    </div>
  );
}
