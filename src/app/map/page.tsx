"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/client-api";
import { EditableText } from "@/components/ui/EditableText";
import { IconMap, IconPath, IconTarget, IconWish } from "@/components/ui/Icons";
import { KpiTile, PageHero, WidgetHead } from "@/components/ui/Widgets";
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
const FOCUS_LABEL: Record<FocusLevel, string> = {
  main: "Главное",
  support: "Поддерживает",
  background: "На фоне",
};

export default function MapPage() {
  const [monthKey, setMonthKey] = useState("");
  const [dirs, setDirs] = useState<Direction[]>([]);
  const [goals, setGoals] = useState<GoalLite[]>([]);
  const [vision, setVision] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editingVision, setEditingVision] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

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

  async function saveVision() {
    setBusy(true);
    const res = await apiPost("/api/life", { action: "setVision", visionNote: vision.trim() });
    setBusy(false);
    if (!res.ok) toast(res.error ?? "Не сохранилось", "warn");
    else {
      setEditingVision(false);
      toast("Сохранила", "ok");
    }
  }

  async function renameDir(id: string, name: string) {
    if (!name.trim()) return;
    const res = await apiPost("/api/directions", { action: "update", id, name: name.trim() });
    if (!res.ok) toast(res.error ?? "Не сохранилось", "warn");
    else await load();
  }

  async function setDesc(id: string, description: string) {
    const res = await apiPost("/api/directions", { action: "update", id, description });
    if (!res.ok) toast(res.error ?? "Не сохранилось", "warn");
    else await load();
  }

  async function removeDir(id: string, name: string) {
    if (!window.confirm(`Удалить направление «${name}»? Цели останутся, но отвяжутся от него.`)) {
      return;
    }
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
    const res = await apiPost("/api/directions", {
      action: "create",
      name,
      description: newDesc.trim() || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      toast(res.error ?? "Не создалось", "warn");
      return;
    }
    setNewName("");
    setNewDesc("");
    toast("Направление добавлено", "ok");
    await load();
  }

  const stats = useMemo(() => {
    const main = dirs.filter((d) => d.focus === "main").length;
    const support = dirs.filter((d) => d.focus === "support").length;
    const bg = dirs.filter((d) => d.focus === "background").length;
    const linked = dirs.reduce((s, d) => s + d.goals, 0);
    return { main, support, bg, linked, total: dirs.length };
  }, [dirs]);

  if (loading) return <p className="text-[var(--ink-faint)]">Загрузка…</p>;

  return (
    <div className="space-y-4">
      <PageHero
        kicker={`Карта · ${monthKey}`}
        title="Карта"
        lede="Направления можно добавлять, менять и удалять."
        action={
          <Link href="/" className="btn btn-primary">
            Сегодня
          </Link>
        }
      />

      <div className="bento">
        <div className="span-3">
          <KpiTile
            label="Направления"
            value={stats.total}
            hint={`${stats.main} главных`}
            color="#a855f7"
            icon={<IconMap size={18} />}
          />
        </div>
        <div className="span-3">
          <KpiTile
            label="Главное"
            value={stats.main}
            hint="фокус месяца"
            color="#f472b6"
            icon={<IconTarget size={18} />}
          />
        </div>
        <div className="span-3">
          <KpiTile
            label="Поддержка"
            value={stats.support}
            hint={`${stats.bg} на фоне`}
            color="#38bdf8"
            icon={<IconWish size={18} />}
          />
        </div>
        <div className="span-3">
          <KpiTile
            label="Цели"
            value={stats.linked}
            hint="привязано"
            color="#34d399"
            icon={<IconPath size={18} />}
          />
        </div>

        <div className="span-12">
          <section className="panel space-y-3">
            <WidgetHead title="Фокус периода" tone="violet" />
            {editingVision ? (
              <div className="space-y-3">
                <textarea
                  className="field resize-none text-[1.15rem] font-semibold tracking-tight"
                  rows={2}
                  value={vision}
                  onChange={(e) => setVision(e.target.value)}
                  placeholder="Кратко: цель на период"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => void saveVision()}
                  >
                    Сохранить
                  </button>
                  <button type="button" className="btn" onClick={() => setEditingVision(false)}>
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-[1.35rem] font-semibold leading-snug tracking-tight md:text-[1.55rem]">
                  {vision.trim() || "Не задано."}
                </p>
                <button type="button" className="btn" onClick={() => setEditingVision(true)}>
                  Изменить
                </button>
              </>
            )}
          </section>
        </div>

        <div className="span-12">
          <form onSubmit={createDir} className="panel flex flex-wrap items-end gap-3">
            <div className="min-w-[12rem] flex-1">
              <WidgetHead title="Новое направление" tone="blue" />
              <input
                className="field"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Название"
              />
            </div>
            <div className="min-w-[12rem] flex-1">
              <input
                className="field"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Описание (необязательно)"
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy || !newName.trim()}>
              Добавить
            </button>
          </form>
        </div>

        {FOCUS_ORDER.map((level) => {
          const items = dirs.filter((d) => d.focus === level);
          if (!items.length) return null;
          const tone =
            level === "main" ? "pink" : level === "support" ? "violet" : "blue";
          return (
            <div key={level} className="span-12 space-y-3">
              <WidgetHead
                title={FOCUS_LABEL[level]}
                tone={tone}
                action={
                  <span className="text-[12px] text-[var(--ink-faint)]">{items.length}</span>
                }
              />
              <div className="bento">
                {items.map((d) => {
                  const linked = goals.filter((g) => g.lifeAreaId === d.id);
                  return (
                    <div key={d.id} className="span-6 panel space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-1">
                          <EditableText
                            value={d.name}
                            className="text-[1.2rem] font-semibold tracking-tight"
                            inputClassName="field text-[1.1rem] font-semibold"
                            onSave={(name) => renameDir(d.id, name)}
                          />
                          <EditableText
                            value={d.description ?? ""}
                            className="block text-[13px] text-[var(--ink-soft)]"
                            inputClassName="field text-[13px]"
                            placeholder="Добавить описание…"
                            onSave={(description) => setDesc(d.id, description)}
                          />
                          <p className="mt-2">
                            <span
                              className="stat-pill"
                              style={{
                                background: "var(--accent-soft)",
                                color: "var(--c-violet)",
                                borderColor: "color-mix(in srgb, var(--accent) 45%, transparent)",
                              }}
                            >
                              {linked.length} целей
                            </span>
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {FOCUS_ORDER.map((lv) => (
                            <button
                              key={lv}
                              type="button"
                              disabled={busy}
                              className={`btn ${d.focus === lv ? "btn-primary" : ""}`}
                              onClick={() => void setFocus(d.id, lv)}
                            >
                              {lv === "main" ? "Главное" : lv === "support" ? "Поддержка" : "Фон"}
                            </button>
                          ))}
                          <button
                            type="button"
                            className="btn"
                            style={{ color: "var(--behind)" }}
                            disabled={busy}
                            onClick={() => void removeDir(d.id, d.name)}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                      {linked.length > 0 ? (
                        <ul className="space-y-2 border-t border-[var(--line)] pt-3">
                          {linked.map((g) => (
                            <li key={g.id}>
                              <Link
                                href={`/goals/${g.id}`}
                                className="flex items-center justify-between gap-3 text-[14px] font-medium hover:text-[var(--accent)]"
                              >
                                <span className="truncate">{g.title}</span>
                                <span className="shrink-0 text-[12px] text-[var(--ink-faint)]">
                                  {g.reality?.label || "открыть"}
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[13px] text-[var(--ink-faint)]">
                          Нет целей.{" "}
                          <Link href="/goals" className="font-semibold text-[var(--accent)]">
                            Добавить
                          </Link>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
