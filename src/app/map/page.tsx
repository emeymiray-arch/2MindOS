"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/client-api";
import { EditableText } from "@/components/ui/EditableText";
import { PageHero, WidgetHead } from "@/components/ui/Widgets";
import { toast } from "@/components/ui/Toast";

type FocusLevel = "main" | "support" | "background";
type Filter = "all" | FocusLevel;

type Direction = {
  id: string;
  name: string;
  focus: FocusLevel;
  goals: number;
};

type GoalLite = {
  id: string;
  title: string;
  lifeAreaId?: string;
  progress?: number;
  reality?: { actual?: number };
};

const FOCUS_ORDER: FocusLevel[] = ["main", "support", "background"];
const FOCUS_LABEL: Record<FocusLevel, string> = {
  main: "Главное",
  support: "Поддержка",
  background: "Фон",
};

function goalPct(g: GoalLite) {
  return Math.round(g.progress ?? g.reality?.actual ?? 0);
}

export default function MapPage() {
  const [monthKey, setMonthKey] = useState("");
  const [dirs, setDirs] = useState<Direction[]>([]);
  const [goals, setGoals] = useState<GoalLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");
  const [newFocus, setNewFocus] = useState<FocusLevel>("main");
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [dirRes, goalsRes] = await Promise.all([
      apiGet("/api/directions"),
      apiGet("/api/goals"),
    ]);
    if (dirRes.ok) {
      setMonthKey(String(dirRes.data.monthKey ?? ""));
      setDirs((dirRes.data.directions as Direction[]) ?? []);
    }
    if (goalsRes.ok) setGoals((goalsRes.data.goals as GoalLite[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setFocus(id: string, level: FocusLevel) {
    setBusy(true);
    const res = await apiPost("/api/directions", {
      action: "setFocus",
      id,
      level,
      monthKey,
    });
    setBusy(false);
    if (!res.ok) toast(res.error ?? "Не сохранилось", "warn");
    else await load();
  }

  async function renameDir(id: string, name: string) {
    if (!name.trim()) return;
    const res = await apiPost("/api/directions", { action: "update", id, name: name.trim() });
    if (!res.ok) toast(res.error ?? "Не сохранилось", "warn");
    else await load();
  }

  async function removeDir(id: string, name: string) {
    if (!window.confirm(`Удалить «${name}»?`)) return;
    setBusy(true);
    const res = await apiPost("/api/directions", { action: "update", id, archived: true });
    setBusy(false);
    if (!res.ok) toast(res.error ?? "Не удалось удалить", "warn");
    else {
      toast("Удалила", "ok");
      await load();
    }
  }

  async function createDir(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    const res = await apiPost("/api/directions", { action: "create", name });
    if (!res.ok) {
      setBusy(false);
      toast(res.error ?? "Не создалось", "warn");
      return;
    }
    const list = (res.data.directions as Direction[]) ?? [];
    const created = [...list].reverse().find((d) => d.name === name);
    if (created && newFocus !== "background") {
      await apiPost("/api/directions", {
        action: "setFocus",
        id: created.id,
        level: newFocus,
        monthKey,
      });
    }
    setBusy(false);
    setNewName("");
    if (created) setOpenId(created.id);
    toast("Добавлено", "ok");
    await load();
  }

  const counts = useMemo(() => {
    const c = { all: dirs.length, main: 0, support: 0, background: 0 };
    for (const d of dirs) c[d.focus] += 1;
    return c;
  }, [dirs]);

  const rows = useMemo(() => {
    const list = filter === "all" ? dirs : dirs.filter((d) => d.focus === filter);
    const rank = { main: 0, support: 1, background: 2 } as const;
    return [...list].sort(
      (a, b) => rank[a.focus] - rank[b.focus] || a.name.localeCompare(b.name, "ru")
    );
  }, [dirs, filter]);

  if (loading) {
    return (
      <div className="page-stack">
        <PageHero title="Карта" />
        <section className="panel">
          <p className="text-[var(--ink-faint)]">…</p>
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHero title="Карта" />

      <section className="panel map-filter">
        {(
          [
            ["all", "Все"],
            ["main", "Главное"],
            ["support", "Поддержка"],
            ["background", "Фон"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className="chip-soft"
            data-active={filter === key}
            onClick={() => setFilter(key)}
          >
            {label}
            <span className="ml-1 text-[var(--ink-faint)]">{counts[key]}</span>
          </button>
        ))}
      </section>

      <ul className="map-stack">
        {rows.length === 0 ? (
          <li className="panel py-6 text-center text-[14px] text-[var(--ink-faint)]">Пусто</li>
        ) : (
          rows.map((d) => {
            const linked = goals.filter((g) => g.lifeAreaId === d.id);
            const avg = linked.length
              ? Math.round(linked.reduce((s, g) => s + goalPct(g), 0) / linked.length)
              : 0;
            const open = openId === d.id;
            return (
              <li key={d.id} className="map-lane panel" data-level={d.focus} data-open={open}>
                <button
                  type="button"
                  className="map-lane-head"
                  onClick={() => setOpenId(open ? null : d.id)}
                >
                  <span className="map-lane-mark" data-level={d.focus} aria-hidden />
                  <span className="map-lane-title">{d.name}</span>
                  <span className="map-lane-meta">
                    {linked.length} цел. · {avg}%
                  </span>
                  <span className="map-lane-chev" aria-hidden>
                    {open ? "▾" : "▸"}
                  </span>
                </button>

                <div className="map-lane-track" aria-hidden>
                  <span style={{ width: `${avg}%` }} />
                </div>

                {open ? (
                  <div className="map-lane-body">
                    <div className="map-lane-tools">
                      <EditableText
                        value={d.name}
                        className="min-w-0 flex-1 font-semibold"
                        inputClassName="field py-1 text-[15px] font-semibold"
                        onSave={(name) => renameDir(d.id, name)}
                      />
                      <div className="map-zone-switch" role="group" aria-label="Зона">
                        {FOCUS_ORDER.map((lv) => (
                          <button
                            key={lv}
                            type="button"
                            className="map-zone-dot"
                            data-level={lv}
                            data-active={d.focus === lv}
                            disabled={busy}
                            title={FOCUS_LABEL[lv]}
                            aria-label={FOCUS_LABEL[lv]}
                            onClick={() => {
                              if (d.focus !== lv) void setFocus(d.id, lv);
                            }}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        className="map-x"
                        disabled={busy}
                        onClick={() => void removeDir(d.id, d.name)}
                        aria-label="Удалить"
                      >
                        ×
                      </button>
                    </div>

                    {linked.length === 0 ? (
                      <p className="map-dir-empty">нет целей · добавь в Целях</p>
                    ) : (
                      <ul className="map-goal-grid">
                        {linked.map((g) => {
                          const pct = goalPct(g);
                          return (
                            <li key={g.id}>
                              <Link href={`/goals/${g.id}`} className="map-goal-tile">
                                <span className="map-goal-tile-pct">{pct}%</span>
                                <span className="map-goal-tile-title">{g.title}</span>
                                <span className="map-goal-tile-bar">
                                  <i style={{ width: `${pct}%` }} />
                                </span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })
        )}
      </ul>

      <form onSubmit={createDir} className="panel flex flex-wrap items-end gap-3">
        <div className="min-w-[12rem] flex-1">
          <WidgetHead title="Новое направление" tone="green" />
          <input
            className="field"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Название"
          />
        </div>
        <div className="map-zone-switch map-zone-switch-lg" role="group" aria-label="Зона">
          {FOCUS_ORDER.map((lv) => (
            <button
              key={lv}
              type="button"
              className="map-zone-dot"
              data-level={lv}
              data-active={newFocus === lv}
              title={FOCUS_LABEL[lv]}
              aria-label={FOCUS_LABEL[lv]}
              onClick={() => setNewFocus(lv)}
            />
          ))}
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy || !newName.trim()}>
          Добавить
        </button>
      </form>
    </div>
  );
}
