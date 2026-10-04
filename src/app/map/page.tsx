"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/client-api";
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

  if (loading) return <p className="text-[var(--ink-faint)]">Загрузка…</p>;

  return (
    <div className="space-y-4">
      <header className="dash-header">
        <div>
          <p className="page-kicker">Карта · {monthKey}</p>
          <h1 className="page-title text-[2.2rem] md:text-[2.6rem]">Карта</h1>
          <p className="page-lede">Направления, фокус и цели.</p>
        </div>
        <Link href="/" className="btn btn-primary">
          Сегодня
        </Link>
      </header>

      <div className="bento">
        <div className="span-12">
          <section className="panel space-y-3">
            <p className="section-label" style={{ color: "var(--accent)" }}>
              Фокус периода
            </p>
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

        {FOCUS_ORDER.map((level) => {
          const items = dirs.filter((d) => d.focus === level);
          if (!items.length) return null;
          const labelColor =
            level === "main"
              ? "var(--accent)"
              : level === "support"
                ? "var(--c-violet)"
                : "var(--ink-faint)";
          return (
            <div key={level} className="span-12 space-y-3">
              <p className="section-label mb-0" style={{ color: labelColor }}>
                {FOCUS_LABEL[level]}
              </p>
              <div className="bento">
                {items.map((d) => {
                  const linked = goals.filter((g) => g.lifeAreaId === d.id);
                  return (
                    <div key={d.id} className="span-6 panel space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-[1.2rem] font-semibold tracking-tight">{d.name}</p>
                          {d.description ? (
                            <p className="mt-1 text-[13px] text-[var(--ink-soft)]">{d.description}</p>
                          ) : null}
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
