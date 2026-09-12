"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/client-api";
import { EmptyState, ProgressRing, StatusChip } from "@/components/ui/Progress";
import { toast } from "@/components/ui/Toast";

type GoalCard = {
  id: string;
  title: string;
  deadline?: string;
  description?: string;
  progress: number;
  horizonStage?: number;
  horizonStageLabel?: string;
  horizonStageShort?: string;
  area?: { name?: string } | null;
  workPlan?: { id: string; title: string; progress: number } | null;
  hasPlan?: boolean;
};

type StageGroup = {
  order: number;
  label: string;
  short: string;
  start: string;
  end: string;
  current: boolean;
  goals: GoalCard[];
};

const ACCENTS = [
  "var(--c-blue)",
  "var(--c-green)",
  "var(--c-orange)",
  "var(--c-violet)",
  "var(--c-pink)",
];

export default function GoalsPage() {
  const router = useRouter();
  const [stageGroups, setStageGroups] = useState<StageGroup[]>([]);
  const [areas, setAreas] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [description, setDescription] = useState("");
  const [lifeAreaId, setLifeAreaId] = useState("");
  const [horizonStage, setHorizonStage] = useState(1);
  const [currentStage, setCurrentStage] = useState(1);
  const [realityMap, setRealityMap] = useState<
    Record<
      string,
      { actual: number; expected: number | null; status: string; label: string; detail: string }
    >
  >({});

  const load = useCallback(async () => {
    const [goalsRes, osRes] = await Promise.all([apiGet("/api/goals"), apiGet("/api/os")]);
    if (goalsRes.ok) {
      setStageGroups((goalsRes.data.stageGroups as StageGroup[]) ?? []);
      setAreas((goalsRes.data.areas as { id: string; name: string }[]) ?? []);
      const cur = Number(goalsRes.data.currentStage);
      if (Number.isFinite(cur) && cur >= 1) {
        setCurrentStage(cur);
        setHorizonStage(cur);
      }
    }
    if (osRes.ok) {
      const map: typeof realityMap = {};
      for (const g of (osRes.data.goals as { id: string; reality: (typeof realityMap)[string] }[]) ??
        []) {
        map[g.id] = g.reality;
      }
      setRealityMap(map);
    }
    setLoading(false);
  }, []);

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

  async function createGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const res = await apiPost("/api/goals", {
      action: "create",
      title: title.trim(),
      deadline: deadline || undefined,
      description: description || undefined,
      lifeAreaId: lifeAreaId || undefined,
      horizonStage,
    });
    if (!res.ok) {
      toast(res.error ?? "Не удалось создать", "warn");
      return;
    }
    const created = ((res.data.goals as GoalCard[]) ?? []).find(
      (g) => g.title === title.trim()
    );
    toast(`Цель в этапе ${horizonStage}`, "ok");
    setCreating(false);
    setTitle("");
    setDeadline("");
    setDescription("");
    if (created?.id) router.push(`/goals/${created.id}`);
    else await load();
  }

  if (loading) return <p className="text-[var(--ink-faint)]">Загружаю цели…</p>;

  const totalGoals = stageGroups.reduce((n, g) => n + g.goals.length, 0);
  const maxFromGroups = stageGroups.reduce((m, g) => Math.max(m, g.order), 0);
  const stageOptions = Array.from(
    { length: Math.max(6, currentStage + 2, maxFromGroups, horizonStage) },
    (_, i) => i + 1
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[34px]">Цели</h1>
          <p className="mt-2 max-w-xl text-[14px] font-semibold text-[var(--ink-soft)]">
            Открой цель → внутри план: <strong>фаза</strong> (6 мес) → <strong>этап</strong>{" "}
            (2 мес) → <strong>шаг</strong>. Шаги выходят на Главную.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setCreating((v) => !v)}>
          {creating ? "Отмена" : "+ Цель"}
        </button>
      </header>

      {creating ? (
        <form onSubmit={createGoal} className="surface space-y-4 p-5">
          <div>
            <label className="text-[13px] font-bold text-[var(--accent)]">Название</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: English B2 к декабрю"
              className="field mt-2"
            />
          </div>
          <div>
            <label className="text-[13px] font-bold text-[var(--accent)]">Этап горизонта</label>
            <select
              value={horizonStage}
              onChange={(e) => setHorizonStage(Number(e.target.value))}
              className="field mt-2"
            >
              {stageOptions.map((n) => (
                <option key={n} value={n}>
                  Этап {n}
                  {n === currentStage ? " · сейчас" : ""}
                </option>
              ))}
            </select>
            <p className="mt-2 text-[12px] font-semibold text-[var(--ink-faint)]">
              Шаги дня на Главной — только у текущего этапа ({currentStage})
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-[13px] font-bold text-[var(--accent)]">Дедлайн</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="field mt-2"
              />
            </div>
            <div>
              <label className="text-[13px] font-bold text-[var(--accent)]">Сфера</label>
              <select
                value={lifeAreaId}
                onChange={(e) => setLifeAreaId(e.target.value)}
                className="field mt-2"
              >
                <option value="">Не выбрана</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[13px] font-bold text-[var(--accent)]">Описание</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Коротко — зачем тебе это"
              className="field mt-2 resize-none"
            />
          </div>
          <button type="submit" className="btn btn-primary">
            Создать и открыть
          </button>
        </form>
      ) : null}

      {totalGoals === 0 ? (
        <EmptyState
          title="Пока нет целей"
          body="Создай первую и выбери этап."
          action={
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              Создать цель
            </button>
          }
        />
      ) : (
        <div className="space-y-8">
          {stageGroups.map((grp, gi) => {
            const accent = ACCENTS[gi % ACCENTS.length];
            return (
              <section key={grp.order}>
                <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                  <p className="text-[15px] font-bold" style={{ color: accent }}>
                    {grp.label}
                    {grp.current ? " · сейчас" : ""}
                  </p>
                  {grp.goals.length > 0 ? (
                    <span className="text-[13px] font-bold" style={{ color: accent }}>
                      {grp.goals.length}
                    </span>
                  ) : null}
                </div>

                {grp.goals.length === 0 ? (
                  <div
                    className="rounded-[18px] border border-dashed border-[var(--line)] px-4 py-5 text-[13px] font-semibold"
                    style={{ color: accent, background: grp.current ? `${accent}14` : undefined }}
                  >
                    Нет целей
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {grp.goals.map((g) => {
                      const r = realityMap[g.id];
                      return (
                        <Link
                          key={g.id}
                          href={`/goals/${g.id}`}
                          className="surface flex items-center gap-4 p-4 transition hover:shadow-[var(--shadow)]"
                          style={{
                            borderLeft: `4px solid ${accent}`,
                            outline: grp.current ? `1px solid ${accent}55` : undefined,
                          }}
                        >
                          <ProgressRing
                            value={r?.actual ?? g.progress}
                            expected={r?.expected}
                            size={58}
                            stroke={5}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[16px] font-bold">{g.title}</p>
                          </div>
                          {r ? (
                            <StatusChip
                              status={r.status as "ahead" | "on_track" | "behind" | "no_plan"}
                              label={r.label}
                            />
                          ) : null}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
