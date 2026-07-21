"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Reorder, motion } from "framer-motion";
import { ActionMode, ActionOption, PageToolbar } from "@/components/ui/PageToolbar";
import { MonthCard } from "@/components/roadmap/MonthCard";
import { ProgressRing } from "@/components/roadmap/ProgressRing";
import { activeMonths, type RoadmapStats } from "@/lib/roadmap";
import type { RoadmapStage } from "@/lib/types";

export default function RoadmapPage() {
  const [stages, setStages] = useState<RoadmapStage[]>([]);
  const [stats, setStats] = useState<RoadmapStats | null>(null);
  const [mode, setMode] = useState<ActionMode>(null);
  const [edit, setEdit] = useState<{ id: string; title: string; subtitle: string } | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newSubtitle, setNewSubtitle] = useState("");
  const [monthDraft, setMonthDraft] = useState<{ stageId: string; ym: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const apply = useCallback((data: Record<string, unknown>) => {
    const rm = data.roadmap as { stages?: RoadmapStage[] } | undefined;
    if (rm?.stages) setStages(rm.stages);
    if (data.stats) setStats(data.stats as RoadmapStats);
  }, []);

  const load = useCallback(async () => {
    const res = await fetch("/api/roadmap");
    const data = await res.json();
    apply(data);
  }, [apply]);

  useEffect(() => {
    load();
  }, [load]);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const { apiPost } = await import("@/lib/client-api");
      const result = await apiPost("/api/roadmap", body);
      if (!result.ok && result.error) setError(result.error);
      else apply(result.data);
    } catch {
      setError("Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  }

  const options: ActionOption[] = useMemo(() => {
    const list: ActionOption[] = [];
    for (const s of stages) {
      list.push({ id: `stage:${s.id}`, label: s.title, group: "Stage" });
      for (const m of activeMonths(s)) {
        list.push({
          id: `month:${s.id}:${m.id}`,
          label: `${String(m.month).padStart(2, "0")}/${m.year}`,
          group: s.title,
        });
      }
    }
    return list;
  }, [stages]);

  async function onPick(id: string, action: Exclude<ActionMode, null>) {
    if (id.startsWith("stage:")) {
      const stageId = id.slice(6);
      const s = stages.find((x) => x.id === stageId);
      if (!s) return;
      if (action === "edit") {
        setEdit({ id: stageId, title: s.title, subtitle: s.subtitle });
        setMode(null);
        return;
      }
      if (action === "archive") await post({ action: "archiveStage", stageId });
      else await post({ action: "deleteStage", stageId });
      setMode(null);
      return;
    }
    if (id.startsWith("month:")) {
      const [, stageId, monthId] = id.split(":");
      if (action === "edit") {
        setMode(null);
        return;
      }
      if (action === "archive") await post({ action: "archiveMonth", stageId, monthId });
      else await post({ action: "deleteMonth", stageId, monthId });
      setMode(null);
    }
  }

  async function onReorder(next: RoadmapStage[]) {
    setStages(next);
    await post({ action: "reorderStages", order: next.map((s) => s.id) });
  }

  function parseYm(ym: string): { year: number; month: number } | null {
    const m = /^(\d{4})-(\d{2})$/.exec(ym);
    if (!m) return null;
    return { year: Number(m[1]), month: Number(m[2]) };
  }

  return (
    <div className="fade-in mx-auto max-w-5xl space-y-14 pb-16">
      <header className="space-y-3">
        <h1 className="font-display text-4xl md:text-5xl">Roadmap</h1>
        <p className="max-w-md text-[15px] text-[var(--ink-soft)]">Либо добейся либо сдохни.</p>
      </header>

      <section className="card flex flex-col items-start gap-8 p-6 sm:flex-row sm:items-center sm:gap-12 sm:p-8">
        <div>
          <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--ink-faint)]">
            Overall Progress
          </p>
          <ProgressRing value={stats?.overallProgress ?? 0} size={140} stroke={11} />
        </div>
        <div className="grid w-full flex-1 grid-cols-1 gap-6 sm:grid-cols-3">
          <div>
            <p className="text-[12px] font-semibold text-[var(--ink-faint)]">Completed Goals</p>
            <p className="mt-1 font-display text-[28px] tabular-nums">{stats?.completedGoals ?? 0}</p>
          </div>
          <div>
            <p className="text-[12px] font-semibold text-[var(--ink-faint)]">Completed Months</p>
            <p className="mt-1 font-display text-[28px] tabular-nums">
              {stats?.completedMonths ?? 0} / {stats?.totalMonths ?? 0}
            </p>
          </div>
          <div>
            <p className="text-[12px] font-semibold text-[var(--ink-faint)]">Current Stage</p>
            <p className="mt-1 font-display text-[28px]">{stats?.currentStageTitle ?? "—"}</p>
          </div>
        </div>
      </section>

      <PageToolbar mode={mode} onMode={setMode} options={options} onPick={onPick} />

      {error ? <p className="text-[13px] text-[var(--bad)]">{error}</p> : null}

      {edit ? (
        <div className="card flex flex-wrap gap-2 p-4">
          <input
            className="min-w-[120px] flex-1"
            value={edit.title}
            onChange={(e) => setEdit({ ...edit, title: e.target.value })}
            placeholder="Stage"
          />
          <input
            className="min-w-[160px] flex-1"
            value={edit.subtitle}
            onChange={(e) => setEdit({ ...edit, subtitle: e.target.value })}
            placeholder="Subtitle"
          />
          <button
            type="button"
            className="btn btn-ink"
            disabled={busy}
            onClick={async () => {
              await post({
                action: "updateStage",
                stageId: edit.id,
                title: edit.title,
                subtitle: edit.subtitle,
              });
              setEdit(null);
            }}
          >
            Save
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setEdit(null)}>
            ×
          </button>
        </div>
      ) : null}

      <Reorder.Group
        axis="y"
        values={stages}
        onReorder={onReorder}
        className="space-y-14"
      >
        {stages.map((stage) => {
          const months = activeMonths(stage);
          return (
            <Reorder.Item
              key={stage.id}
              value={stage}
              className="list-none"
              whileDrag={{ scale: 1.01, boxShadow: "var(--shadow)" }}
            >
              <motion.section
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="font-display text-2xl">{stage.title}</h2>
                    {stage.subtitle ? (
                      <p className="mt-1 text-[15px] text-[var(--ink-soft)]">{stage.subtitle}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="btn btn-soft"
                    disabled={busy}
                    onClick={() => {
                      const now = new Date();
                      const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
                      setMonthDraft({ stageId: stage.id, ym });
                    }}
                  >
                    +
                  </button>
                </div>

                {monthDraft?.stageId === stage.id ? (
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="month"
                      value={monthDraft.ym}
                      onChange={(e) => setMonthDraft({ ...monthDraft, ym: e.target.value })}
                    />
                    <button
                      type="button"
                      className="btn btn-ink"
                      disabled={busy}
                      onClick={async () => {
                        const parsed = parseYm(monthDraft.ym);
                        if (!parsed) return;
                        await post({
                          action: "createMonth",
                          stageId: stage.id,
                          year: parsed.year,
                          month: parsed.month,
                        });
                        setMonthDraft(null);
                      }}
                    >
                      Add month
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => setMonthDraft(null)}>
                      ×
                    </button>
                  </div>
                ) : null}

                {months.length === 0 ? (
                  <p className="text-[13px] text-[var(--ink-faint)]">No months yet</p>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {months.map((m) => (
                      <MonthCard key={m.id} stageId={stage.id} month={m} />
                    ))}
                  </div>
                )}
              </motion.section>
            </Reorder.Item>
          );
        })}
      </Reorder.Group>

      <div className="card flex flex-wrap gap-2 p-4">
        <input
          className="min-w-[120px] flex-1"
          value={newTitle}
          disabled={busy}
          placeholder="Stage"
          onChange={(e) => setNewTitle(e.target.value)}
        />
        <input
          className="min-w-[160px] flex-1"
          value={newSubtitle}
          disabled={busy}
          placeholder="Subtitle"
          onChange={(e) => setNewSubtitle(e.target.value)}
        />
        <button
          type="button"
          className="btn btn-ink"
          disabled={busy || !newTitle.trim()}
          onClick={async () => {
            await post({
              action: "createStage",
              title: newTitle.trim(),
              subtitle: newSubtitle.trim(),
            });
            setNewTitle("");
            setNewSubtitle("");
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}
