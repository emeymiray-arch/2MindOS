"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/client-api";
import { queryKeys } from "@/lib/query-keys";
import { EditableText } from "@/components/ui/EditableText";
import { IconFlame, IconHabits, IconSteps, IconTarget } from "@/components/ui/Icons";
import { KpiTile, PageHero, WidgetHead } from "@/components/ui/Widgets";
import { toast } from "@/components/ui/Toast";

type HabitRow = {
  id: string;
  title: string;
  frequency?: string;
  streak: number;
  todayDone: boolean;
  completionRate: number;
};

const COLORS = ["#34d399", "#38bdf8", "#fb923c", "#a855f7", "#f472b6"];

async function fetchHabits(): Promise<HabitRow[]> {
  const res = await apiGet("/api/habits");
  if (!res.ok) throw new Error("Не удалось загрузить привычки");
  return (res.data.habits as HabitRow[]) ?? [];
}

export default function HabitsPage() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const { data: habits = [] } = useQuery({
    queryKey: queryKeys.habits,
    queryFn: fetchHabits,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.habits });

  const createMut = useMutation({
    mutationFn: async (t: string) => {
      const res = await apiPost("/api/habits", { action: "create", title: t });
      if (!res.ok) throw new Error(res.error ?? "Ошибка");
    },
    onSuccess: async () => {
      setTitle("");
      toast("Привычка добавлена", "ok");
      await invalidate();
    },
    onError: (e: Error) => toast(e.message, "warn"),
  });

  const toggleMut = useMutation({
    mutationFn: async (h: HabitRow) => {
      await apiPost("/api/habits", {
        action: "log",
        habitId: h.id,
        value: h.todayDone ? 0 : 1,
      });
    },
    onSuccess: () => invalidate(),
  });

  const removeMut = useMutation({
    mutationFn: async (h: HabitRow) => {
      const res = await apiPost("/api/habits", { action: "delete", id: h.id });
      if (!res.ok) throw new Error(res.error ?? "Не удалось удалить");
    },
    onSuccess: async () => {
      toast("Удалила", "ok");
      await invalidate();
    },
    onError: (e: Error) => toast(e.message, "warn"),
  });

  const renameMut = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: string }) => {
      const res = await apiPost("/api/habits", { action: "update", id, title: next });
      if (!res.ok) throw new Error(res.error ?? "Не сохранилось");
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast(e.message, "warn"),
  });

  const stats = useMemo(() => {
    const done = habits.filter((h) => h.todayDone).length;
    const best = habits.reduce((m, h) => Math.max(m, h.streak), 0);
    const avg =
      habits.length > 0
        ? Math.round(
            (habits.reduce((s, h) => s + h.completionRate, 0) / habits.length) * 100
          )
        : 0;
    return { done, best, avg, total: habits.length };
  }, [habits]);

  return (
    <div className="page-stack">
      <PageHero
        title="Привычки"
        action={
          <div className="text-right">
            <p className="home-clock-time" style={{ fontSize: "1.6rem" }}>
              {stats.done}/{stats.total}
            </p>
            <p className="home-clock-meta">сегодня</p>
          </div>
        }
      />

      <div className="bento">
        <div className="span-3">
          <KpiTile
            label="Активных"
            value={stats.total}
            color="#34d399"
            icon={<IconHabits size={16} />}
          />
        </div>
        <div className="span-3">
          <KpiTile
            label="Сегодня"
            value={
              <>
                {stats.done}
                <span className="kpi-den">/{stats.total}</span>
              </>
            }
            color="#38bdf8"
            icon={<IconTarget size={16} />}
          />
        </div>
        <div className="span-3">
          <KpiTile
            label="Лучшая серия"
            value={
              <>
                {stats.best}
                <span className="kpi-den"> дн</span>
              </>
            }
            color="#fb923c"
            icon={<IconFlame size={16} />}
          />
        </div>
        <div className="span-3">
          <KpiTile
            label="Средний %"
            value={<>{stats.avg}%</>}
            color="#a855f7"
            icon={<IconSteps size={16} />}
          />
        </div>

        <div className="span-12">
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
              <WidgetHead title="Новая привычка" tone="green" />
              <input
                className="field"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Например: вода / спорт / чтение"
              />
            </div>
            <button type="submit" className="btn btn-primary shrink-0" disabled={createMut.isPending}>
              Добавить
            </button>
          </form>
        </div>

        <div className="span-12">
          <section className="panel">
            <WidgetHead
              title="Сегодня"
              tone="violet"
              action={
                <span className="text-[12px] text-[var(--ink-faint)]">
                  {stats.done} из {stats.total}
                </span>
              }
            />
            {habits.length === 0 ? (
              <p className="text-[14px] text-[var(--ink-soft)]">Пока пусто — добавь первую.</p>
            ) : (
              <ul className="space-y-2">
                {habits.map((h, i) => {
                  const c = COLORS[i % COLORS.length];
                  return (
                    <li key={h.id} className="signal-row" data-done={h.todayDone}>
                      <button
                        type="button"
                        onClick={() => toggleMut.mutate(h)}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[14px] font-black text-white"
                        style={{
                          background: h.todayDone ? c : `${c}55`,
                          boxShadow: h.todayDone ? `0 0 16px ${c}55` : undefined,
                        }}
                        aria-label={h.todayDone ? "Снять отметку" : "Отметить"}
                      >
                        {h.todayDone ? "✓" : "◇"}
                      </button>
                      <div className="min-w-0 flex-1">
                        <EditableText
                          value={h.title}
                          className="font-semibold"
                          inputClassName="field py-1 text-[15px] font-semibold"
                          onSave={(next) => {
                            if (!next.trim()) return;
                            renameMut.mutate({ id: h.id, next: next.trim() });
                          }}
                        />
                        <p className="text-[12px] font-semibold" style={{ color: c }}>
                          серия {h.streak} · {Math.round(h.completionRate * 100)}%
                        </p>
                      </div>
                      <div className="habit-mini-bar" title={`${Math.round(h.completionRate * 100)}%`}>
                        <span style={{ width: `${Math.round(h.completionRate * 100)}%`, background: c }} />
                      </div>
                      <button
                        type="button"
                        className="shrink-0 px-2 text-[18px] font-bold text-[var(--ink-soft)] hover:text-[var(--behind)]"
                        onClick={() => {
                          if (!window.confirm(`Удалить привычку «${h.title}»?`)) return;
                          removeMut.mutate(h);
                        }}
                        aria-label="Удалить"
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
