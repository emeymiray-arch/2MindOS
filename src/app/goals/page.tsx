"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/client-api";
import { EmptyState } from "@/components/ui/Progress";
import { PageHero, WidgetHead } from "@/components/ui/Widgets";
import { toast } from "@/components/ui/Toast";

type GoalCard = {
  id: string;
  title: string;
  lifeAreaId?: string;
  area?: { id?: string; name?: string } | null;
  hasPlan?: boolean;
  layer?: "inner" | "outer";
  side?: "inner" | "outer" | null;
  reality?: {
    status: "ahead" | "on_track" | "behind" | "no_plan";
    label: string;
    actual?: number;
  };
  progress?: number;
};

type Area = { id: string; name: string };
type Side = "inner" | "outer";
type Tab = "all" | Side;

function planPercent(g: GoalCard) {
  if (typeof g.progress === "number") return Math.round(g.progress);
  if (typeof g.reality?.actual === "number") return Math.round(g.reality.actual);
  return 0;
}

export default function GoalsPage() {
  const router = useRouter();
  const [goals, setGoals] = useState<GoalCard[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [lifeAreaId, setLifeAreaId] = useState("");
  const [layer, setLayer] = useState<Side>("outer");
  const [tab, setTab] = useState<Tab>("all");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [goalsRes, dirRes] = await Promise.all([
      apiGet("/api/goals"),
      apiGet("/api/directions"),
    ]);
    if (goalsRes.ok) {
      setGoals((goalsRes.data.goals as GoalCard[]) ?? []);
      setAreas((goalsRes.data.areas as Area[]) ?? []);
    }
    if (dirRes.ok && !lifeAreaId) {
      const main = (dirRes.data.directions as { id: string; focus: string }[])?.find(
        (d) => d.focus === "main"
      );
      if (main) setLifeAreaId(main.id);
    }
    setLoading(false);
  }, [lifeAreaId]);

  useEffect(() => {
    try {
      const id = new URLSearchParams(window.location.search).get("id");
      if (id) router.replace(`/goals/${id}`);
    } catch {
      /* ignore */
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (tab === "all") return goals;
    return goals.filter((g) => (g.side ?? g.layer) === tab);
  }, [goals, tab]);

  const avgPct = useMemo(() => {
    if (!filtered.length) return 0;
    return Math.round(filtered.reduce((s, g) => s + planPercent(g), 0) / filtered.length);
  }, [filtered]);

  async function createGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    const res = await apiPost("/api/goals", {
      action: "create",
      title: title.trim(),
      lifeAreaId: lifeAreaId || undefined,
      layer,
    });
    setBusy(false);
    if (!res.ok) {
      toast(res.error ?? "Не удалось создать", "warn");
      return;
    }
    const created = ((res.data.goals as GoalCard[]) ?? []).find((g) => g.title === title.trim());
    setCreating(false);
    setTitle("");
    if (created?.id) router.push(`/goals/${created.id}`);
    else await load();
  }

  if (loading) {
    return (
      <div className="page-stack">
        <PageHero title="Цели" />
        <section className="panel">
          <p className="text-[var(--ink-faint)]">…</p>
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHero title="Цели" />

      <section className="panel flex flex-wrap items-center gap-2">
        {(
          [
            ["all", "Все"],
            ["inner", "Внутренние"],
            ["outer", "Внешние"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className="chip-soft"
            data-active={tab === key}
            onClick={() => setTab(key)}
          >
            {label}
            <span className="ml-1 text-[var(--ink-faint)]">
              {key === "all"
                ? goals.length
                : goals.filter((g) => (g.side ?? g.layer) === key).length}
            </span>
          </button>
        ))}
        <div className="goals-avg-pill ml-auto">
          <span className="goals-avg-value">{avgPct}%</span>
          <span className="goals-avg-label">средний</span>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setCreating((v) => !v)}
        >
          {creating ? "Закрыть" : "Новая"}
        </button>
      </section>

      {creating ? (
        <form onSubmit={createGoal} className="panel space-y-3">
          <WidgetHead title="Новая цель" tone="violet" />
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Название"
            className="field"
            autoFocus
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <select
              className="field"
              value={lifeAreaId}
              onChange={(e) => setLifeAreaId(e.target.value)}
            >
              <option value="">Направление…</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <div className="flex gap-2 sm:col-span-2">
              <button
                type="button"
                className="chip-soft flex-1"
                data-active={layer === "inner"}
                onClick={() => setLayer("inner")}
              >
                Внутреннее
              </button>
              <button
                type="button"
                className="chip-soft flex-1"
                data-active={layer === "outer"}
                onClick={() => setLayer("outer")}
              >
                Внешнее
              </button>
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            Создать
          </button>
        </form>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          title="Пока пусто"
          action={
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              Создать
            </button>
          }
        />
      ) : (
        <ul className="goal-list panel">
          {filtered.map((g) => {
            const pct = planPercent(g);
            const area = g.area?.name;
            return (
              <li key={g.id}>
                <Link href={`/goals/${g.id}`} className="goal-row">
                  <div className="goal-row-main">
                    <p className="goal-row-title">{g.title}</p>
                    {area ? <p className="goal-row-sub">{area}</p> : null}
                  </div>
                  <div className="goal-row-track" aria-hidden>
                    <span style={{ width: `${pct}%` }} />
                  </div>
                  <p className="goal-row-pct">{pct}%</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
