"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/client-api";
import { EmptyState, StatusChip } from "@/components/ui/Progress";
import { IconInner, IconOuter, IconPath, IconAlert, IconTarget } from "@/components/ui/Icons";
import { KpiTile, PageHero, ViewAllLink, WidgetHead } from "@/components/ui/Widgets";
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

const SIDE_META: Record<Side, { label: string; hint: string; tone: "pink" | "blue" }> = {
  inner: {
    label: "Внутреннее",
    hint: "Принципы, понятия, дисциплина — то, что формируешь в себе",
    tone: "pink",
  },
  outer: {
    label: "Внешнее",
    hint: "Стиль, навыки, подача — то, как тебя читают снаружи",
    tone: "blue",
  },
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

  if (loading) return <p className="text-[var(--ink-faint)]">Собираю путь…</p>;

  function GoalTile({ g }: { g: GoalCard }) {
    const areaId = g.lifeAreaId || g.area?.id;
    const lv = areaId ? focus[areaId] : undefined;
    return (
      <Link href={`/goals/${g.id}`} className="next-card">
        <span className="next-ico" style={{ color: "#c084fc", background: "rgba(192,132,252,0.14)" }}>
          <IconTarget size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold">{g.title}</span>
          <span className="mt-0.5 block truncate text-[11px] text-[var(--ink-faint)]">
            {g.area?.name || "Без направления"}
            {lv === "main" ? " · главное" : ""}
            {g.hasPlan ? "" : " · план ещё не открыт"}
          </span>
        </span>
        {g.reality ? <StatusChip status={g.reality.status} label={g.reality.label} /> : null}
      </Link>
    );
  }

  function SideColumn({ side, items }: { side: Side; items: GoalCard[] }) {
    const meta = SIDE_META[side];
    return (
      <section className="panel flex h-full flex-col">
        <WidgetHead
          title={meta.label}
          tone={meta.tone}
          action={<span className="text-[12px] text-[var(--ink-faint)]">{items.length}</span>}
        />
        <p className="mb-3 text-[13px] text-[var(--ink-soft)]">{meta.hint}</p>
        {items.length === 0 ? (
          <p className="text-[14px] text-[var(--ink-faint)]">Пока пусто.</p>
        ) : (
          <div className="space-y-2">
            {items.map((g) => (
              <GoalTile key={g.id} g={g} />
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <PageHero
        kicker="Путь"
        title="Цели"
        lede="Две стороны: внутреннее (в себе) и внешнее (стиль, навыки, подача)."
        action={
          <button type="button" className="btn btn-primary" onClick={() => setCreating((v) => !v)}>
            {creating ? "Закрыть" : "Новое намерение"}
          </button>
        }
      />

      <div className="bento">
        <div className="span-3">
          <KpiTile
            label="Всего"
            value={stats.total}
            hint="активных целей"
            color="#a855f7"
            icon={<IconPath size={18} />}
          />
        </div>
        <div className="span-3">
          <KpiTile
            label="В графике"
            value={stats.onTrack}
            hint="ahead + on track"
            color="#34d399"
            icon={<IconTarget size={18} />}
          />
        </div>
        <div className="span-3">
          <KpiTile
            label="Отстаёт"
            value={stats.behind}
            hint="нужно внимание"
            color="#f87171"
            icon={<IconAlert size={18} />}
          />
        </div>
        <div className="span-3">
          <KpiTile
            label="Без плана"
            value={stats.noPlan}
            hint="открой план"
            color="#fbbf24"
            icon={<IconOuter size={18} />}
          />
        </div>

        {creating ? (
          <div className="span-12">
            <form onSubmit={createGoal} className="panel space-y-3">
              <WidgetHead title="Новое намерение" tone="violet" />
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Например: восстановить силу тела"
                className="field font-display text-[1.15rem]"
                autoFocus
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  className="field"
                  value={lifeAreaId}
                  onChange={(e) => setLifeAreaId(e.target.value)}
                >
                  <option value="">Направление с карты…</option>
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
                  <option value="">Сторона…</option>
                  <option value="inner">Внутреннее</option>
                  <option value="outer">Внешнее</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                Создать и открыть план
              </button>
            </form>
          </div>
        ) : null}

        {goals.length === 0 ? (
          <div className="span-12">
            <EmptyState
              title="Целей нет"
              body="Создай цель и выбери сторону: внутреннее или внешнее."
              action={
                <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
                  Создать
                </button>
              }
            />
          </div>
        ) : (
          <>
            <div className="span-6">
              <SideColumn side="inner" items={bySide.inner} />
            </div>
            <div className="span-6">
              <SideColumn side="outer" items={bySide.outer} />
            </div>
          </>
        )}

        {bySide.unset.length ? (
          <div className="span-12">
            <section className="panel space-y-3">
              <WidgetHead
                title="Без стороны"
                tone="orange"
                action={<span className="text-[12px] text-[var(--ink-faint)]">{bySide.unset.length}</span>}
              />
              <p className="text-[13px] text-[var(--ink-soft)]">
                Открой цель и назначь внутреннее или внешнее — или выбери направление с явной
                стороной.
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                {bySide.unset.map((g) => (
                  <GoalTile key={g.id} g={g} />
                ))}
              </div>
            </section>
          </div>
        ) : null}

        <div className="span-12">
          <p className="flex items-center gap-2 text-[14px] text-[var(--ink-faint)]">
            <IconInner size={14} />
            <ViewAllLink href="/map" label="← К карте жизни" />
          </p>
        </div>
      </div>
    </div>
  );
}
