"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/client-api";
import { EditableText } from "@/components/ui/EditableText";
import { PageHero } from "@/components/ui/Widgets";
import { toast } from "@/components/ui/Toast";

type FocusLevel = "main" | "support" | "background";

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
};

const FOCUS_ORDER: FocusLevel[] = ["main", "support", "background"];
const FOCUS_LABEL: Record<FocusLevel, string> = {
  main: "Главное",
  support: "Поддержка",
  background: "Фон",
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

  const sorted = useMemo(() => {
    return [...dirs].sort(
      (a, b) => FOCUS_ORDER.indexOf(a.focus) - FOCUS_ORDER.indexOf(b.focus)
    );
  }, [dirs]);

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

  if (loading) return <p className="text-[var(--ink-faint)]">…</p>;

  return (
    <div className="page-stack calm-page">
      <PageHero
        title="Карта"
        meta={monthKey ? <span className="chip-soft">{monthKey}</span> : null}
      />

      <section className="calm-section">
        <p className="calm-h">Фокус</p>
        <EditableText
          value={vision}
          className="mt-1 block text-[1.1rem] font-medium tracking-tight"
          inputClassName="field text-[1.05rem] font-medium"
          placeholder="Куда идёшь сейчас — одна фраза"
          onSave={(next) => void saveVision(next)}
        />
      </section>

      {/* One list instead of three giant columns */}
      <section className="calm-section">
        <h2 className="calm-h">Направления</h2>
        {sorted.length === 0 ? (
          <p className="calm-empty">Добавь первое направление ниже.</p>
        ) : (
          <ul className="calm-list">
            {sorted.map((d) => {
              const linked = goals.filter((g) => g.lifeAreaId === d.id);
              return (
                <li key={d.id} className="calm-row items-start">
                  <div className="min-w-0 flex-1">
                    <EditableText
                      value={d.name}
                      className="font-medium"
                      inputClassName="field py-1 text-[15px] font-medium"
                      onSave={(name) => renameDir(d.id, name)}
                    />
                    <p className="calm-muted mt-0.5 text-[12px]">
                      {FOCUS_LABEL[d.focus]}
                      {linked.length
                        ? ` · ${linked
                            .slice(0, 2)
                            .map((g) => g.title)
                            .join(", ")}${linked.length > 2 ? ` +${linked.length - 2}` : ""}`
                        : " · без целей"}
                    </p>
                    {linked.length ? (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {linked.slice(0, 4).map((g) => (
                          <Link key={g.id} href={`/goals/${g.id}`} className="map-goal-chip">
                            {g.title}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <select
                      className="map-focus-select"
                      value={d.focus}
                      disabled={busy}
                      onChange={(e) => void setFocus(d.id, e.target.value as FocusLevel)}
                      aria-label="Фокус"
                    >
                      {FOCUS_ORDER.map((lv) => (
                        <option key={lv} value={lv}>
                          {FOCUS_LABEL[lv]}
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
            })}
          </ul>
        )}
      </section>

      <form onSubmit={createDir} className="flex flex-wrap items-center gap-2">
        <input
          className="field min-w-[12rem] flex-1"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Новое направление"
        />
        <button type="submit" className="btn btn-primary" disabled={busy || !newName.trim()}>
          Добавить
        </button>
      </form>
    </div>
  );
}
