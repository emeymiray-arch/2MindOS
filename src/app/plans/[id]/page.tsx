"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Module = {
  id: string;
  title: string;
  done: boolean;
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
  status?: string;
  modules: Module[];
  progress?: number;
};

type PlanPayload = {
  plan: {
    id: string;
    title: string;
    desiredResult?: string;
    why?: string;
    startingPoint?: string;
    strategy?: string;
    deadline?: string;
    status: string;
    progress: number;
    ownerType: "goal" | "project";
    ownerId: string;
    phases: Stage[];
  };
  owner: { title: string };
  today: { id: string; title: string; done: boolean; date: string; milestoneId?: string }[];
};

const UNDERSTANDING = [
  { value: 0 as const, label: "0", hint: "Не поняла" },
  { value: 1 as const, label: "1", hint: "Частично" },
  { value: 2 as const, label: "2", hint: "Поняла" },
];

function fmtDeadline(end?: string, start?: string) {
  if (end) return `до ${end}`;
  if (start) return `с ${start}`;
  return "без дедлайна";
}

export default function PlanDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const planId = String(params.id ?? "");

  const [data, setData] = useState<PlanPayload | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [stageDraft, setStageDraft] = useState({ title: "", deadlineEnd: "" });
  const [moduleDrafts, setModuleDrafts] = useState<
    Record<string, { title: string; deadlineEnd: string }>
  >({});

  const load = useCallback(async () => {
    const res = await fetch(`/api/work-plans?id=${encodeURIComponent(planId)}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      setError("План не найден");
      setData(null);
      return;
    }
    const json = await res.json();
    setData(json);
  }, [planId]);

  useEffect(() => {
    load();
  }, [load]);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const { apiPost } = await import("@/lib/client-api");
      const result = await apiPost("/api/work-plans", body);
      if (!result.ok && result.error) setError(String(result.error));
      await load();
    } catch {
      setError("Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  }

  function modDraft(stageId: string) {
    return moduleDrafts[stageId] ?? { title: "", deadlineEnd: "" };
  }

  if (!data && !error) return <div className="text-[var(--ink-faint)]">…</div>;
  if (!data) {
    return (
      <div className="fade-in mx-auto max-w-2xl space-y-4">
        <p className="text-[var(--ink-soft)]">{error}</p>
        <button type="button" className="btn btn-soft" onClick={() => router.back()}>
          ← Назад
        </button>
      </div>
    );
  }

  const { plan, owner } = data;
  const backHref =
    plan.ownerType === "goal" ? `/goals?id=${plan.ownerId}` : `/projects/${plan.ownerId}`;
  const stages = [...(plan.phases ?? [])].sort((a, b) => a.order - b.order);

  return (
    <div className="fade-in mx-auto max-w-2xl space-y-8 pb-16">
      <div className="flex items-center justify-between gap-3">
        <Link href={backHref} className="text-[13px] font-medium text-[var(--ink-faint)]">
          ← {owner.title}
        </Link>
        <p className="text-[12px] text-[var(--ink-faint)]">{plan.progress}%</p>
      </div>

      <header className="space-y-2">
        <h1 className="font-display text-3xl tracking-[-0.03em]">{plan.title}</h1>
        <p className="text-[14px] text-[var(--ink-soft)]">
          Этапный план · темы с дедлайнами · оценка понимания 0–2
        </p>
        <div className="meter">
          <span style={{ width: `${plan.progress}%` }} />
        </div>
      </header>

      {error ? <p className="text-[13px] text-[var(--ink-soft)]">{error}</p> : null}

      <p className="text-[12px] text-[var(--ink-faint)]">
        Шкала: <strong>0</strong> не поняла · <strong>1</strong> частично · <strong>2</strong> поняла
      </p>

      <section className="space-y-8">
        {stages.map((stage, stageIndex) => {
          const d = modDraft(stage.id);
          const modules = [...(stage.modules ?? [])].sort((a, b) => a.order - b.order);
          return (
            <article key={stage.id} className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--line)] pb-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ink-faint)]">
                    Этап {stageIndex + 1}
                  </p>
                  <input
                    className="w-full border-0 bg-transparent p-0 text-[20px] font-semibold tracking-[-0.02em] outline-none"
                    value={stage.title}
                    disabled={busy}
                    onChange={(e) => {
                      const title = e.target.value;
                      setData({
                        ...data,
                        plan: {
                          ...plan,
                          phases: plan.phases.map((p) =>
                            p.id === stage.id ? { ...p, title } : p
                          ),
                        },
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
                <label className="flex items-center gap-2 text-[12px] text-[var(--ink-faint)]">
                  Дедлайн этапа
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

              <ol className="space-y-3">
                {modules.map((m, i) => (
                  <li
                    key={m.id}
                    className="grid gap-3 rounded-[16px] bg-[var(--bg-panel)] px-3 py-3 sm:grid-cols-[auto_1fr_auto] sm:items-center"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 text-[13px] text-[var(--ink-faint)]">{i + 1}.</span>
                      <button
                        type="button"
                        className={`check ${m.done ? "check-on" : "check-off"}`}
                        disabled={busy}
                        aria-label={m.done ? "Снять отметку" : "Отметить"}
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

                    <div className="min-w-0 space-y-2">
                      <input
                        className="w-full border-0 bg-transparent p-0 text-[15px] font-medium outline-none"
                        value={m.title}
                        disabled={busy}
                        onChange={(e) => {
                          const title = e.target.value;
                          setData({
                            ...data,
                            plan: {
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
                            },
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
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] text-[var(--ink-faint)]">Поняла</span>
                        {UNDERSTANDING.map((opt) => {
                          const active = m.understanding === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              title={opt.hint}
                              disabled={busy}
                              className={`min-w-9 rounded-[10px] px-2.5 py-1 text-[13px] font-semibold ${
                                active
                                  ? "bg-[var(--ink)] text-[var(--bg)]"
                                  : "bg-[var(--bg)] text-[var(--ink-soft)]"
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
                        <span className="text-[11px] text-[var(--ink-faint)]">
                          {m.understanding === 0
                            ? "не поняла"
                            : m.understanding === 1
                              ? "частично"
                              : m.understanding === 2
                                ? "поняла"
                                : "ещё не оценила"}
                        </span>
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
                      <span className="text-[11px]">{fmtDeadline(m.deadlineEnd, m.deadlineStart)}</span>
                    </label>
                  </li>
                ))}
              </ol>

              <div className="flex flex-wrap items-end gap-2">
                <input
                  className="min-w-[160px] flex-1"
                  placeholder="Тема / термин (например: Python)"
                  value={d.title}
                  disabled={busy}
                  onChange={(e) =>
                    setModuleDrafts({
                      ...moduleDrafts,
                      [stage.id]: { ...d, title: e.target.value },
                    })
                  }
                />
                <label className="flex flex-col gap-1 text-[11px] text-[var(--ink-faint)]">
                  Дедлайн
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
                </label>
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

        <div className="flex flex-wrap items-end gap-2 border-t border-[var(--line)] pt-6">
          <input
            className="min-w-[160px] flex-1"
            placeholder="Новый этап (например: Фундамент)"
            value={stageDraft.title}
            disabled={busy}
            onChange={(e) => setStageDraft({ ...stageDraft, title: e.target.value })}
          />
          <label className="flex flex-col gap-1 text-[11px] text-[var(--ink-faint)]">
            Дедлайн этапа
            <input
              type="date"
              value={stageDraft.deadlineEnd}
              disabled={busy}
              onChange={(e) => setStageDraft({ ...stageDraft, deadlineEnd: e.target.value })}
            />
          </label>
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
      </section>
    </div>
  );
}
