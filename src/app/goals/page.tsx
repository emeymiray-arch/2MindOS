"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/client-api";
import { EmptyState } from "@/components/ui/Progress";
import { PageHero, ViewAllLink } from "@/components/ui/Widgets";
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
  };
};

type Area = { id: string; name: string; layerBias?: "inner" | "outer" | "both" };
type FocusMap = Record<string, "main" | "support" | "background">;
type Side = "inner" | "outer";

const STATUS_SHORT: Record<NonNullable<GoalCard["reality"]>["status"], string> = {
  ahead: "впереди",
  on_track: "в графике",
  behind: "отстаёт",
  no_plan: "нужен план",
};

export default function GoalsPage() {
  const router = useRouter();
  const [goals, setGoals] = useState<GoalCard[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [focus, setFocus] = useState<FocusMap>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [lifeAreaId, setLifeAreaId] = useState("");
  const [layer, setLayer] = useState<Side | "">("");
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
    if (dirRes.ok) {
      const levels: FocusMap = {};
      for (const d of (dirRes.data.directions as { id: string; focus: FocusMap[string] }[]) ?? []) {
        levels[d.id] = d.focus;
      }
      setFocus(levels);
      if (!lifeAreaId) {
        const main = (dirRes.data.directions as { id: string; focus: string }[])?.find(
          (d) => d.focus === "main"
        );
        if (main) setLifeAreaId(main.id);
      }
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

  const bySide = useMemo(() => {
    const inner: GoalCard[] = [];
    const outer: GoalCard[] = [];
    const unset: GoalCard[] = [];
    for (const g of goals) {
      const side = g.side ?? g.layer ?? null;
      if (side === "inner") inner.push(g);
      else if (side === "outer") outer.push(g);
      else unset.push(g);
    }
    return { inner, outer, unset };
  }, [goals]);

  const stats = useMemo(() => {
    const behind = goals.filter((g) => g.reality?.status === "behind").length;
    const onTrack = goals.filter(
      (g) => g.reality?.status === "on_track" || g.reality?.status === "ahead"
    ).length;
    const noPlan = goals.filter((g) => !g.hasPlan || g.reality?.status === "no_plan").length;
    return { total: goals.length, behind, onTrack, noPlan };
  }, [goals]);

  async function createGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || busy) return;
    if (!layer) {
      toast("Выбери: внутреннее или внешнее", "warn");
      return;
    }
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
    setLayer("");
    if (created?.id) router.push(`/goals/${created.id}`);
    else await load();
  }

  if (loading) {
    return (
      <div className="page-stack">
        <PageHero title="Цели" />
        <section className="panel">
          <p className="text-[var(--ink-faint)]">Собираю…</p>
        </section>
      </div>
    );
  }

  function GoalRow({ g }: { g: GoalCard }) {
    const status = g.reality?.status;
    const statusText =
      !g.hasPlan || status === "no_plan"
        ? "нужен план"
        : status
          ? STATUS_SHORT[status]
          : "";
    return (
      <Link href={`/goals/${g.id}`} className="sheet-goal">
        <span className="sheet-goal-title">{g.title}</span>
        <span className="sheet-goal-area">{g.area?.name || "—"}</span>
        <span className="sheet-goal-status">{statusText}</span>
      </Link>
    );
  }

  function SideList({ label, items }: { label: string; items: GoalCard[] }) {
    return (
      <section className="sheet-block">
        <header className="sheet-block-head">
          <h2>{label}</h2>
          <span className="sheet-block-aside">{items.length}</span>
        </header>
        {items.length === 0 ? (
          <p className="sheet-empty">Пусто</p>
        ) : (
          <ul className="sheet-goal-list">
            {items.map((g) => (
              <li key={g.id}>
                <GoalRow g={g} />
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  return (
    <div className="page-stack sheet-page">
      <PageHero
        title="Цели"
        action={
          <button type="button" className="btn btn-primary" onClick={() => setCreating((v) => !v)}>
            {creating ? "Закрыть" : "Новая цель"}
          </button>
        }
      />

      <section className="panel">
        <p className="sheet-metrics" style={{ margin: 0 }}>
          <span>
            всего <b>{stats.total}</b>
          </span>
          <span>
            в графике <b>{stats.onTrack}</b>
          </span>
          <span>
            отстаёт <b>{stats.behind}</b>
          </span>
          <span>
            без плана <b>{stats.noPlan}</b>
          </span>
        </p>
      </section>

      {creating ? (
        <form onSubmit={createGoal} className="sheet-block sheet-form">
          <header className="sheet-block-head">
            <h2>Новая цель</h2>
          </header>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Название"
            className="field"
            autoFocus
          />
          <div className="sheet-form-row">
            <select
              className="field"
              value={lifeAreaId}
              onChange={(e) => setLifeAreaId(e.target.value)}
            >
              <option value="">Направление…</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {focus[a.id] === "main" ? " · главное" : ""}
                </option>
              ))}
            </select>
            <select
              className="field"
              value={layer}
              onChange={(e) => setLayer(e.target.value as Side | "")}
            >
              <option value="">Внутр. / внеш.…</option>
              <option value="inner">Внутреннее</option>
              <option value="outer">Внешнее</option>
            </select>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              Создать
            </button>
          </div>
        </form>
      ) : null}

      {goals.length === 0 ? (
        <EmptyState
          title="Целей нет"
          body="Создай цель и выбери сторону."
          action={
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              Создать
            </button>
          }
        />
      ) : (
        <div className="sheet-grid sheet-grid-path">
          <SideList label="Внутренние" items={bySide.inner} />
          <SideList label="Внешние" items={bySide.outer} />
          {bySide.unset.length ? (
            <section className="sheet-block sheet-span-full">
              <header className="sheet-block-head">
                <h2>Без категории</h2>
                <span className="sheet-block-aside">{bySide.unset.length}</span>
              </header>
              <p className="sheet-empty" style={{ marginBottom: "0.75rem" }}>
                Открой цель и назначь внутреннее или внешнее.
              </p>
              <ul className="sheet-goal-list sheet-goal-list-2">
                {bySide.unset.map((g) => (
                  <li key={g.id}>
                    <GoalRow g={g} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}

      <p className="sheet-foot">
        <ViewAllLink href="/map" label="← К карте" />
      </p>
    </div>
  );
}
