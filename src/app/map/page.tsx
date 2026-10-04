"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/client-api";
import { EditableText } from "@/components/ui/EditableText";
import { PageHero, WidgetHead } from "@/components/ui/Widgets";
import { toast } from "@/components/ui/Toast";

type FocusLevel = "main" | "support" | "background";

type Direction = {
  id: string;
  name: string;
  description?: string;
  focus: FocusLevel;
  goals: number;
};

type GoalLite = {
  id: string;
  title: string;
  lifeAreaId?: string;
  reality?: { status: string; label: string };
};

const FOCUS_ORDER: FocusLevel[] = ["main", "support", "background"];
const FOCUS_META: Record<
  FocusLevel,
  { label: string; tone: "pink" | "violet" | "blue"; hint: string }
> = {
  main: { label: "Главное", tone: "pink", hint: "в центре внимания" },
  support: { label: "Поддержка", tone: "violet", hint: "держит курс" },
  background: { label: "Фон", tone: "blue", hint: "на периферии" },
};

export default function MapPage() {
  const [monthKey, setMonthKey] = useState("");
  const [dirs, setDirs] = useState<Direction[]>([]);
  const [goals, setGoals] = useState<GoalLite[]>([]);
  const [vision, setVision] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");

  const load = useCallback(async () => {
    const [dirRes, goalsRes, stateRes] = await Promise.all([
      apiGet("/api/directions"),
      apiGet("/api/goals"),
      apiGet("/api/state"),
    ]);
    if (dirRes.ok) {
      setMonthKey(String(dirRes.data.monthKey ?? ""));
      setDirs((dirRes.data.directions as Direction[]) ?? []);
    }
    if (goalsRes.ok) setGoals((goalsRes.data.goals as GoalLite[]) ?? []);
    if (stateRes.ok) {
      const s = stateRes.data.settings as { visionNote?: string } | undefined;
      setVision(s?.visionNote ?? "");
    }
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

  async function saveVision(next: string) {
    const res = await apiPost("/api/life", { action: "setVision", visionNote: next.trim() });
    if (!res.ok) toast(res.error ?? "Не сохранилось", "warn");
    else setVision(next.trim());
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
    setBusy(false);
    if (!res.ok) {
      toast(res.error ?? "Не создалось", "warn");
      return;
    }
    setNewName("");
    toast("Добавлено", "ok");
    await load();
  }

  const byFocus = useMemo(() => {
    const map: Record<FocusLevel, Direction[]> = { main: [], support: [], background: [] };
    for (const d of dirs) map[d.focus].push(d);
    return map;
  }, [dirs]);

  if (loading) return <p className="text-[var(--ink-faint)]">Загрузка…</p>;

  return (
    <div className="page-stack">
      <PageHero
        title="Карта"
        meta={monthKey ? <span className="chip-soft">{monthKey}</span> : null}
      />

      <section className="panel map-vision rise-in">
        <p className="text-[12px] font-semibold text-[var(--ink-faint)]">Фокус периода</p>
        <EditableText
          value={vision}
          className="mt-2 block text-[1.35rem] font-semibold tracking-tight md:text-[1.55rem]"
          inputClassName="field text-[1.25rem] font-semibold"
          placeholder="Кратко: куда идёшь сейчас"
          onSave={(next) => void saveVision(next)}
        />
      </section>

      <div className="map-board">
        {FOCUS_ORDER.map((level) => {
          const items = byFocus[level];
          const meta = FOCUS_META[level];
          return (
            <section key={level} className="map-zone panel" data-level={level}>
              <WidgetHead
                title={meta.label}
                tone={meta.tone}
                action={<span className="text-[12px] text-[var(--ink-faint)]">{items.length}</span>}
              />
              <ul className="stack-tight">
                {items.length === 0 ? (
                  <li className="py-2 text-[13px] text-[var(--ink-faint)]">Пусто</li>
                ) : (
                  items.map((d) => {
                    const linked = goals.filter((g) => g.lifeAreaId === d.id);
                    return (
                      <li key={d.id} className="map-node row-in">
                        <div className="min-w-0 flex-1">
                          <EditableText
                            value={d.name}
                            className="font-semibold"
                            inputClassName="field py-1 text-[15px] font-semibold"
                            onSave={(name) => renameDir(d.id, name)}
                          />
                          {linked.length ? (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {linked.slice(0, 3).map((g) => (
                                <Link key={g.id} href={`/goals/${g.id}`} className="map-goal-chip">
                                  {g.title}
                                </Link>
                              ))}
                              {linked.length > 3 ? (
                                <span className="map-goal-chip is-more">+{linked.length - 3}</span>
                              ) : null}
                            </div>
                          ) : (
                            <p className="mt-1 text-[11px] text-[var(--ink-faint)]">без целей</p>
                          )}
                        </div>
                        <div className="map-node-actions">
                          <select
                            className="map-focus-select"
                            value={d.focus}
                            disabled={busy}
                            onChange={(e) => void setFocus(d.id, e.target.value as FocusLevel)}
                            aria-label="Фокус"
                          >
                            {FOCUS_ORDER.map((lv) => (
                              <option key={lv} value={lv}>
                                {FOCUS_META[lv].label}
                              </option>
                            ))}
                          </select>
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
                      </li>
                    );
                  })
                )}
              </ul>
            </section>
          );
        })}
      </div>

      <form onSubmit={createDir} className="panel flex flex-wrap items-end gap-3 rise-in">
        <div className="min-w-[12rem] flex-1">
          <WidgetHead title="Новое направление" tone="green" />
          <input
            className="field"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Название"
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy || !newName.trim()}>
          Добавить
        </button>
      </form>
    </div>
  );
}
