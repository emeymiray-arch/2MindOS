"use client";

import { useCallback, useEffect, useState } from "react";

type Module = {
  id: string;
  title: string;
  done: boolean;
  order: number;
  deadlineStart?: string;
  deadlineEnd?: string;
  understanding?: 0 | 1 | 2;
};

type Stage = {
  id: string;
  title: string;
  order: number;
  deadlineStart?: string;
  deadlineEnd?: string;
  modules: Module[];
};

type PlanLite = {
  id: string;
  title: string;
  progress: number;
  phases: Stage[];
};

type Props = {
  planId: string;
  initial?: PlanLite | null;
  onProgress?: (progress: number) => void;
};

function DateRange({
  start,
  end,
  disabled,
  onChange,
}: {
  start?: string;
  end?: string;
  disabled?: boolean;
  onChange: (next: { deadlineStart?: string; deadlineEnd?: string }) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px] tabular-nums tracking-tight text-[var(--ink-faint)]">
      <span className="opacity-60">с</span>
      <input
        type="date"
        className="date-range-input"
        value={start ?? ""}
        disabled={disabled}
        onChange={(e) => onChange({ deadlineStart: e.target.value || undefined, deadlineEnd: end })}
      />
      <span className="opacity-60">по</span>
      <input
        type="date"
        className="date-range-input"
        value={end ?? ""}
        disabled={disabled}
        onChange={(e) => onChange({ deadlineStart: start, deadlineEnd: e.target.value || undefined })}
      />
    </div>
  );
}

export function PlanScheme({ planId, initial = null, onProgress }: Props) {
  const [plan, setPlan] = useState<PlanLite | null>(initial);
  const [busy, setBusy] = useState(false);
  const [topicDraft, setTopicDraft] = useState<Record<string, string>>({});
  const [stageTitle, setStageTitle] = useState("");

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
    if (!res.ok) return;
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
    try {
      const { apiPost } = await import("@/lib/client-api");
      const result = await apiPost("/api/work-plans", { ...body, lite: true });
      const next = result.data.plan as PlanLite | undefined;
      if (next) applyPlan(next);
      else await load();
    } finally {
      setBusy(false);
    }
  }

  if (!plan) {
    return <p className="text-[12px] text-[var(--ink-faint)]">…</p>;
  }

  const stages = [...(plan.phases ?? [])].sort((a, b) => a.order - b.order);

  return (
    <div className="plan-scheme space-y-7">
      {stages.map((stage, stageIndex) => {
        const modules = [...(stage.modules ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        const draft = topicDraft[stage.id] ?? "";
        return (
          <section key={stage.id} className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
              <div className="flex min-w-0 flex-1 items-baseline gap-2">
                <span className="shrink-0 text-[12px] text-[var(--ink-faint)]">{stageIndex + 1}.</span>
                <input
                  className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[16px] font-medium outline-none"
                  value={stage.title}
                  disabled={busy}
                  onChange={(e) =>
                    setPlan({
                      ...plan,
                      phases: plan.phases.map((p) =>
                        p.id === stage.id ? { ...p, title: e.target.value } : p
                      ),
                    })
                  }
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
              <DateRange
                start={stage.deadlineStart}
                end={stage.deadlineEnd}
                disabled={busy}
                onChange={(dates) =>
                  post({
                    action: "updatePhase",
                    planId: plan.id,
                    phaseId: stage.id,
                    ...dates,
                  })
                }
              />
            </div>

            <ul className="space-y-2 pl-4">
              {modules.map((m, i) => (
                <li key={m.id} className="space-y-1.5">
                  <div className="flex items-center gap-2">
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
                    <span className="w-4 shrink-0 text-[12px] text-[var(--ink-faint)]">{i + 1}</span>
                    <input
                      className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[14px] outline-none"
                      value={m.title}
                      disabled={busy}
                      onChange={(e) =>
                        setPlan({
                          ...plan,
                          phases: plan.phases.map((p) =>
                            p.id === stage.id
                              ? {
                                  ...p,
                                  modules: p.modules.map((x) =>
                                    x.id === m.id ? { ...x, title: e.target.value } : x
                                  ),
                                }
                              : p
                          ),
                        })
                      }
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
                    <div className="flex gap-0.5">
                      {([0, 1, 2] as const).map((v) => (
                        <button
                          key={v}
                          type="button"
                          disabled={busy}
                          className={`h-6 w-6 rounded-md text-[11px] ${
                            m.understanding === v
                              ? "bg-[var(--ink)] text-[var(--bg)]"
                              : "text-[var(--ink-faint)] hover:bg-[var(--bg)]"
                          }`}
                          onClick={() =>
                            post({
                              action: "updateModule",
                              planId: plan.id,
                              phaseId: stage.id,
                              moduleId: m.id,
                              understanding: v,
                            })
                          }
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="pl-12">
                    <DateRange
                      start={m.deadlineStart}
                      end={m.deadlineEnd}
                      disabled={busy}
                      onChange={(dates) =>
                        post({
                          action: "updateModule",
                          planId: plan.id,
                          phaseId: stage.id,
                          moduleId: m.id,
                          ...dates,
                        })
                      }
                    />
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex gap-2 pl-4">
              <input
                className="min-w-0 flex-1"
                placeholder="Тема"
                value={draft}
                disabled={busy}
                onChange={(e) => setTopicDraft({ ...topicDraft, [stage.id]: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || !draft.trim()) return;
                  post({
                    action: "addModule",
                    planId: plan.id,
                    phaseId: stage.id,
                    title: draft.trim(),
                  });
                  setTopicDraft({ ...topicDraft, [stage.id]: "" });
                }}
              />
              <button
                type="button"
                className="btn btn-soft"
                disabled={busy || !draft.trim()}
                onClick={() => {
                  post({
                    action: "addModule",
                    planId: plan.id,
                    phaseId: stage.id,
                    title: draft.trim(),
                  });
                  setTopicDraft({ ...topicDraft, [stage.id]: "" });
                }}
              >
                +
              </button>
            </div>
          </section>
        );
      })}

      <div className="flex gap-2 border-t border-[var(--line)] pt-4">
        <input
          className="min-w-0 flex-1"
          placeholder="Этап"
          value={stageTitle}
          disabled={busy}
          onChange={(e) => setStageTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || !stageTitle.trim()) return;
            post({
              action: "addPhase",
              planId: plan.id,
              title: stageTitle.trim(),
            });
            setStageTitle("");
          }}
        />
        <button
          type="button"
          className="btn btn-soft"
          disabled={busy || !stageTitle.trim()}
          onClick={() => {
            post({
              action: "addPhase",
              planId: plan.id,
              title: stageTitle.trim(),
            });
            setStageTitle("");
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}
