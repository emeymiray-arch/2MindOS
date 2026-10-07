"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/client-api";
import { EmptyState, StatusChip } from "@/components/ui/Progress";
import { PageHero } from "@/components/ui/Widgets";
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

type Area = { id: string; name: string };
type FocusMap = Record<string, "main" | "support" | "background">;
type Side = "inner" | "outer";

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

  const groups = useMemo(() => {
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

  async function createGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    const res = await apiPost("/api/goals", {
      action: "create",
      title: title.trim(),
      lifeAreaId: lifeAreaId || undefined,
      layer: layer || undefined,
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

  if (loading) return <p className="text-[var(--ink-faint)]">…</p>;

  function Row({ g }: { g: GoalCard }) {
    const areaId = g.lifeAreaId || g.area?.id;
    const lv = areaId ? focus[areaId] : undefined;
    return (
      <Link href={`/goals/${g.id}`} className="calm-row">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{g.title}</span>
          <span className="calm-muted block truncate text-[12px]">
            {[g.area?.name, lv === "main" ? "главное" : null, !g.hasPlan ? "нет плана" : null]
              .filter(Boolean)
              .join(" · ") || "—"}
          </span>
        </span>
        {g.reality ? <StatusChip status={g.reality.status} label={g.reality.label} /> : null}
      </Link>
    );
  }

  function Group({ label, items }: { label: string; items: GoalCard[] }) {
    if (!items.length) return null;
    return (
      <section className="calm-section">
        <h2 className="calm-h">
          {label}
          <span className="calm-muted font-normal"> · {items.length}</span>
        </h2>
        <ul className="calm-list">
          {items.map((g) => (
            <li key={g.id}>
              <Row g={g} />
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <div className="page-stack calm-page">
      <PageHero
        title="Путь"
        action={
          <button type="button" className="btn btn-primary" onClick={() => setCreating((v) => !v)}>
            {creating ? "Закрыть" : "Новая цель"}
          </button>
        }
      />

      {creating ? (
        <form onSubmit={createGoal} className="calm-section space-y-3">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Название цели"
            className="field"
            autoFocus
          />
          <div className="grid gap-2 sm:grid-cols-2">
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
            <select
              className="field"
              value={layer}
              onChange={(e) => setLayer(e.target.value as Side | "")}
            >
              <option value="">Сторона…</option>
              <option value="inner">Внутреннее</option>
              <option value="outer">Внешнее</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            Создать
          </button>
        </form>
      ) : null}

      {goals.length === 0 ? (
        <EmptyState
          title="Целей нет"
          body="Добавь первую — она появится в пути."
          action={
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              Создать
            </button>
          }
        />
      ) : (
        <>
          <Group label="Внутреннее" items={groups.inner} />
          <Group label="Внешнее" items={groups.outer} />
          <Group label="Без стороны" items={groups.unset} />
        </>
      )}

      <p className="calm-muted text-[13px]">
        <Link href="/map" className="underline">
          ← Карта
        </Link>
      </p>
    </div>
  );
}
