"use client";

import { useCallback, useEffect, useState } from "react";

type Module = {
  id: string;
  title: string;
  done: boolean;
  order: number;
  deadlineEnd?: string;
  understanding?: 0 | 1 | 2;
};

type Stage = {
  id: string;
  title: string;
  order: number;
  deadlineEnd?: string;
  modules: Module[];
  progress?: number;
};

type PlanLite = {
  id: string;
  title: string;
  progress: number;
  phases: Stage[];
};

const UNDERSTANDING = [
  { value: 0 as const, label: "0", hint: "Не поняла" },
  { value: 1 as const, label: "1", hint: "Частично" },
  { value: 2 as const, label: "2", hint: "Поняла" },
];

type Props = {
  planId: string;
  /** Optional seed from create response — skips first empty flash */
  initial?: PlanLite | null;
  onProgress?: (progress: number) => void;
};

export function PlanScheme({ planId, initial = null, onProgress }: Props) {
  const [plan, setPlan] = useState<PlanLite | null>(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [stageDraft, setStageDraft] = useState({ title: "", deadlineEnd: "" });
  const [moduleDrafts, setModuleDrafts] = useState<
    Record<string, { title: string; deadlineEnd: string }>
  >({});

  const applyPlan = useCallback(
    (next: PlanLite) => {
      setPlan(next);
      onProgress?.(next.progress);
    },
    [onProgress]
  );

  const load = useCallback(async () => {
    const res = await fetch(`/api/work-plans?id=${encodeURIComponent(planId)}&lite=1`, {
      cache: "no-store",
    });
    if (!res.ok) {
      setError("Не удалось загрузить план");
      return;
    }
    const json = await res.json();
    if (json.plan) applyPlan(json.plan as PlanLite);
  }, [planId, applyPlan]);

  useEffect(() => {
    if (initial?.id === planId) {
      setPlan(initial);
      return;
    }
    void load();
  }, [planId, initial, load]);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const { apiPost } = await import("@/lib/client-api");
      const result = await apiPost("/api/work-plans", { ...body, lite: true });
      if (!result.ok && result.error) {
        setError(String(result.error));
        return;
      }
      const next = result.data.plan as PlanLite | undefined;
      if (next) applyPlan(next);
      else await load();
    } catch {
      setError("Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  }

  function modDraft(stageId: string) {
    return moduleDrafts[stageId] ?? { title: "", deadlineEnd: "" };
  }

  if (!plan && !error) {
    return <p className="text-[13px] text-[var(--ink-faint)]">Загрузка плана…</p>;
  }
  if (!plan) {
    return <p className="text-[13px] text-[var(--ink-soft)]">{error}</p>;
  }

  const stages = [...(plan.phases ?? [])].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-[var(--ink-faint)]">
          Этапы · темы · дедлайны · оценка 0–2
        </p>
        <p className="text-[12px] text-[var(--ink-faint)]">{plan.progress}%</p>
      </div>
      <div className="meter">
        <span style={{ width: `${plan.progress}%` }} />
      </div>
      <p className="text-[12px] text-[var(--ink-faint)]">
        <strong>0</strong> не поняла · <strong>1</strong> частично · <strong>2</strong> поняла
      </p>
      {error ? <p className="text-[13px] text-[var(--ink-soft)]">{error}</p> : null}

      {stages.map((stage, stageIndex) => {
        const d = modDraft(stage.id);
        const modules = [...(stage.modules ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        return (
          <article key={stage.id} className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--line)] pb-2">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ink-faint)]">
                  Этап {stageIndex + 1}
                </p>
                <input
                  className="w-full border-0 bg-transparent p-0 text-[17px] font-semibold outline-none"
                  value={stage.title}
                  disabled={busy}
                  onChange={(e) => {
                    const title = e.target.value;
                    setPlan({
                      ...plan,
                      phases: plan.phases.map((p) => (p.id === stage.id ? { ...p, title } : p)),
                    });
                  }}
                  onBlur={(e) =>
                    post({
                      action: "updatePhase",
                      planId: plan.id,
                      phaseId: stage.id,
                      title: e.target.value.trim() || stage.title,
                    })
                  }
                />
              </div>
              <label className="flex items-center gap-2 text-[11px] text-[var(--ink-faint)]">
                Дедлайн
                <input
                  type="date"
                  className="w-auto"
                  value={stage.deadlineEnd ?? ""}
                  disabled={busy}
                  onChange={(e) =>
                    post({
                      action: "updatePhase",
                      planId: plan.id,
                      phaseId: stage.id,
                      deadlineEnd: e.target.value,
                    })
                  }
                />
              </label>
            </div>

            <ol className="space-y-2">
              {modules.map((m, i) => (
                <li
                  key={m.id}
                  className="grid gap-2 rounded-[14px] bg-[var(--bg)] px-3 py-2.5 sm:grid-cols-[auto_1fr_auto] sm:items-center"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 text-[12px] text-[var(--ink-faint)]">{i + 1}.</span>
                    <button
                      type="button"
                      className={`check ${m.done ? "check-on" : "check-off"}`}
                      disabled={busy}
                      onClick={() =>
                        post({
                          action: "toggleModule",
                          planId: plan.id,
                          phaseId: stage.id,
                          moduleId: m.id,
                          done: !m.done,
                        })
                      }
                    >
                      {m.done ? "✓" : ""}
                    </button>
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <input
                      className="w-full border-0 bg-transparent p-0 text-[14px] font-medium outline-none"
                      value={m.title}
                      disabled={busy}
                      onChange={(e) => {
                        const title = e.target.value;
                        setPlan({
                          ...plan,
                          phases: plan.phases.map((p) =>
                            p.id === stage.id
                              ? {
                                  ...p,
                                  modules: p.modules.map((x) =>
                                    x.id === m.id ? { ...x, title } : x
                                  ),
                                }
                              : p
                          ),
                        });
                      }}
                      onBlur={(e) =>
                        post({
                          action: "updateModule",
                          planId: plan.id,
                          phaseId: stage.id,
                          moduleId: m.id,
                          title: e.target.value.trim() || m.title,
                        })
                      }
                    />
                    <div className="flex flex-wrap items-center gap-1.5">
                      {UNDERSTANDING.map((opt) => {
                        const active = m.understanding === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            title={opt.hint}
                            disabled={busy}
                            className={`min-w-8 rounded-[8px] px-2 py-0.5 text-[12px] font-semibold ${
                              active
                                ? "bg-[var(--ink)] text-[var(--bg)]"
                                : "bg-[var(--bg-panel)] text-[var(--ink-soft)]"
                            }`}
                            onClick={() =>
                              post({
                                action: "updateModule",
                                planId: plan.id,
                                phaseId: stage.id,
                                moduleId: m.id,
                                understanding: opt.value,
                              })
                            }
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <label className="flex flex-col gap-1 text-[11px] text-[var(--ink-faint)] sm:items-end">
                    Дедлайн
                    <input
                      type="date"
                      className="w-auto"
                      value={m.deadlineEnd ?? ""}
                      disabled={busy}
                      onChange={(e) =>
                        post({
                          action: "updateModule",
                          planId: plan.id,
                          phaseId: stage.id,
                          moduleId: m.id,
                          deadlineEnd: e.target.value,
                        })
                      }
                    />
                  </label>
                </li>
              ))}
            </ol>

            <div className="flex flex-wrap items-end gap-2">
              <input
                className="min-w-[140px] flex-1"
                placeholder="Тема (например: Python)"
                value={d.title}
                disabled={busy}
                onChange={(e) =>
                  setModuleDrafts({
                    ...moduleDrafts,
                    [stage.id]: { ...d, title: e.target.value },
                  })
                }
              />
              <input
                type="date"
                value={d.deadlineEnd}
                disabled={busy}
                onChange={(e) =>
                  setModuleDrafts({
                    ...moduleDrafts,
                    [stage.id]: { ...d, deadlineEnd: e.target.value },
                  })
                }
              />
              <button
                type="button"
                className="btn btn-ink"
                disabled={busy || !d.title.trim()}
                onClick={() => {
                  post({
                    action: "addModule",
                    planId: plan.id,
                    phaseId: stage.id,
                    title: d.title.trim(),
                    deadlineEnd: d.deadlineEnd || undefined,
                  });
                  setModuleDrafts({
                    ...moduleDrafts,
                    [stage.id]: { title: "", deadlineEnd: "" },
                  });
                }}
              >
                + Тема
              </button>
            </div>
          </article>
        );
      })}

      <div className="flex flex-wrap items-end gap-2 border-t border-[var(--line)] pt-4">
        <input
          className="min-w-[140px] flex-1"
          placeholder="Новый этап"
          value={stageDraft.title}
          disabled={busy}
          onChange={(e) => setStageDraft({ ...stageDraft, title: e.target.value })}
        />
        <input
          type="date"
          value={stageDraft.deadlineEnd}
          disabled={busy}
          onChange={(e) => setStageDraft({ ...stageDraft, deadlineEnd: e.target.value })}
        />
        <button
          type="button"
          className="btn btn-ink"
          disabled={busy || !stageDraft.title.trim()}
          onClick={() => {
            post({
              action: "addPhase",
              planId: plan.id,
              title: stageDraft.title.trim(),
              deadlineEnd: stageDraft.deadlineEnd || undefined,
            });
            setStageDraft({ title: "", deadlineEnd: "" });
          }}
        >
          + Этап
        </button>
      </div>
    </div>
  );
}
