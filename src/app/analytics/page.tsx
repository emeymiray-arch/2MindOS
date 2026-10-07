"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/client-api";
import { EmptyState, StatusChip } from "@/components/ui/Progress";
import { PageHero } from "@/components/ui/Widgets";
import { toast } from "@/components/ui/Toast";

type GoalRow = {
  id: string;
  title: string;
  reality: {
    status: "ahead" | "on_track" | "behind" | "no_plan";
    label: string;
  };
  nextStep: { title: string; stageTitle: string } | null;
  week?: { percent: number; completed: number; planned: number };
};

type OverdueItem = {
  id: string;
  title: string;
  date: string;
  ageDays: number;
  goalId?: string;
};

type Analytics = {
  asOf: string;
  week: { planned: number; completed: number; percent: number };
  goals: GoalRow[];
  byStatus: { ahead: number; on_track: number; behind: number; no_plan: number };
  tasks: {
    overdue: number;
    overdueItems: OverdueItem[];
  };
  velocity?: {
    activeStreak: number;
    percent14: number;
  };
  alerts?: {
    needPlan: { id: string; title: string }[];
  };
};

function mondayOf(iso: string) {
  const d = new Date(iso + "T12:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
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

  const attention = useMemo(() => {
    if (!data) return { behind: [] as GoalRow[], noPlan: [] as GoalRow[], overdue: [] as OverdueItem[] };
    return {
      behind: data.goals.filter((g) => g.reality.status === "behind"),
      noPlan: data.goals.filter((g) => g.reality.status === "no_plan"),
      overdue: (data.tasks.overdueItems ?? []).slice(0, 5),
    };
  }, [data]);

  async function saveNote(e: React.FormEvent) {
    e.preventDefault();
    if (!data || !note.trim() || busy) return;
    setBusy(true);
    const res = await apiPost("/api/life", {
      action: "upsertReview",
      cadence: "week",
      periodKey: mondayOf(data.asOf),
      worked: note.trim(),
      failed: "",
      nextChange: "",
    });
    setBusy(false);
    if (!res.ok) toast(res.error ?? "Не сохранилось", "warn");
    else {
      toast("Сохранено", "ok");
      setNote("");
    }
  }

  async function moveToToday(id: string) {
    if (!data) return;
    setTaskBusy(id);
    const res = await apiPost("/api/tasks", { action: "update", id, date: data.asOf });
    setTaskBusy(null);
    if (!res.ok) toast(res.error ?? "Не удалось", "warn");
    else await load();
  }

  if (loading) return <p className="text-[var(--ink-faint)]">…</p>;
  if (!data) return <EmptyState title="Нет данных" body="Открой Сегодня." />;

  const onTrack = data.byStatus.ahead + data.byStatus.on_track;
  const streak = data.velocity?.activeStreak ?? 0;

  return (
    <div className="page-stack calm-page">
      <PageHero title="Аналитика" />

      {/* One pulse row — not four giant KPI cards */}
      <p className="calm-pulse">
        <span>
          Неделя <b>{data.week.percent}%</b>
          <span className="calm-muted">
            {" "}
            · {data.week.completed}/{data.week.planned}
          </span>
        </span>
        <span>
          В графике <b>{onTrack}</b>
          <span className="calm-muted"> / {data.goals.length}</span>
        </span>
        {streak > 0 ? (
          <span>
            Серия <b>{streak}</b>
            <span className="calm-muted"> дн</span>
          </span>
        ) : null}
      </p>

      {/* Attention only — what needs eyes */}
      <section className="calm-section">
        <h2 className="calm-h">Внимание</h2>
        {attention.behind.length === 0 &&
        attention.noPlan.length === 0 &&
        attention.overdue.length === 0 ? (
          <p className="calm-empty">Сейчас всё спокойно.</p>
        ) : (
          <ul className="calm-list">
            {attention.behind.map((g) => (
              <li key={g.id}>
                <Link href={`/goals/${g.id}`} className="calm-row">
                  <span className="min-w-0 flex-1 truncate font-medium">{g.title}</span>
                  <StatusChip status="behind" label={g.reality.label} />
                </Link>
              </li>
            ))}
            {attention.noPlan.map((g) => (
              <li key={g.id}>
                <Link href={`/goals/${g.id}`} className="calm-row">
                  <span className="min-w-0 flex-1 truncate font-medium">{g.title}</span>
                  <span className="calm-tag">нет плана</span>
                </Link>
              </li>
            ))}
            {attention.overdue.map((t) => (
              <li key={t.id} className="calm-row">
                <span className="min-w-0 flex-1 truncate">
                  {t.title}
                  <span className="calm-muted"> · {t.ageDays} дн</span>
                </span>
                <button
                  type="button"
                  className="btn btn-ghost text-[12px]"
                  disabled={taskBusy === t.id}
                  onClick={() => void moveToToday(t.id)}
                >
                  В сегодня
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Compact goals — one list, no charts */}
      <section className="calm-section">
        <h2 className="calm-h">Цели</h2>
        {data.goals.length === 0 ? (
          <p className="calm-empty">
            Пока пусто.{" "}
            <Link href="/goals" className="underline">
              Путь
            </Link>
          </p>
        ) : (
          <ul className="calm-list">
            {data.goals.map((g) => (
              <li key={g.id}>
                <Link href={`/goals/${g.id}`} className="calm-row">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{g.title}</span>
                    {g.nextStep ? (
                      <span className="calm-muted block truncate text-[12px]">
                        дальше: {g.nextStep.title}
                      </span>
                    ) : null}
                  </span>
                  <StatusChip status={g.reality.status} label={g.reality.label} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* One short note, not three fields */}
      <section className="calm-section">
        <h2 className="calm-h">Заметка недели</h2>
        <form onSubmit={saveNote} className="space-y-2">
          <textarea
            className="field"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Что важно запомнить с этой недели…"
          />
          <button type="submit" className="btn btn-primary" disabled={busy || !note.trim()}>
            Сохранить
          </button>
        </form>
      </section>
    </div>
  );
}
