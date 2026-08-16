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

export default function PlanDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const planId = String(params.id ?? "");

  const [data, setData] = useState<PlanPayload | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    title: "",
    desiredResult: "",
    why: "",
    strategy: "",
    deadline: "",
  });
  const [stageDraft, setStageDraft] = useState({ title: "", deadlineStart: "", deadlineEnd: "" });
  const [moduleDrafts, setModuleDrafts] = useState<
    Record<string, { title: string; deadlineStart: string; deadlineEnd: string; taskDate: string }>
  >({});

  const load = useCallback(async () => {
    const res = await fetch(`/api/work-plans?id=${encodeURIComponent(planId)}`);
    if (!res.ok) {
      setError("План не найден");
      setData(null);
      return;
    }
    const json = await res.json();
    setData(json);
    setDraft({
      title: json.plan.title ?? "",
      desiredResult: json.plan.desiredResult ?? "",
      why: json.plan.why ?? "",
      strategy: json.plan.strategy ?? "",
      deadline: json.plan.deadline ?? "",
    });
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
    return (
      moduleDrafts[stageId] ?? {
        title: "",
        deadlineStart: "",
        deadlineEnd: "",
        taskDate: new Date().toISOString().slice(0, 10),
      }
    );
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

  const { plan, owner, today } = data;
  const backHref =
    plan.ownerType === "goal" ? `/goals?id=${plan.ownerId}` : `/projects/${plan.ownerId}`;

  return (
    <div className="fade-in mx-auto max-w-2xl space-y-10 pb-16">
      <div className="flex items-center justify-between gap-3">
        <Link href={backHref} className="text-[13px] font-medium text-[var(--ink-faint)]">
          ← {owner.title}
        </Link>
        <button
          type="button"
          className="btn btn-soft"
          disabled={busy}
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? "Готово" : "Изменить"}
        </button>
      </div>

      <header className="space-y-3">
        <h1 className="font-display text-3xl tracking-[-0.03em]">{plan.title}</h1>
        <p className="text-[14px] text-[var(--ink-soft)]">
          {owner.title}
          {plan.deadline ? ` · до ${plan.deadline}` : ""}
          {` · ${plan.progress}%`}
        </p>
        <div className="meter">
          <span style={{ width: `${plan.progress}%` }} />
        </div>
      </header>

      {error ? <p className="text-[13px] text-[var(--ink-soft)]">{error}</p> : null}

      {editing ? (
        <section className="card space-y-3 p-6">
          {(
            [
              ["title", "Название"],
              ["desiredResult", "Результат"],
              ["why", "Зачем"],
              ["strategy", "Как двигаюсь"],
              ["deadline", "Дедлайн плана"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block space-y-1">
              <span className="text-[12px] text-[var(--ink-faint)]">{label}</span>
              {key === "deadline" ? (
                <input
                  type="date"
                  value={draft[key]}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                />
              ) : key === "title" ? (
                <input
                  value={draft[key]}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                />
              ) : (
                <textarea
                  rows={2}
                  value={draft[key]}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                />
              )}
            </label>
          ))}
          <button
            type="button"
            className="btn btn-ink"
            disabled={busy}
            onClick={async () => {
              await post({ action: "update", id: plan.id, ...draft });
              setEditing(false);
            }}
          >
            Сохранить
          </button>
        </section>
      ) : (
        <section className="space-y-3">
          {plan.desiredResult ? (
            <div>
              <p className="text-[12px] text-[var(--ink-faint)]">Результат</p>
              <p className="text-[15px]">{plan.desiredResult}</p>
            </div>
          ) : null}
          {plan.why ? (
            <div>
              <p className="text-[12px] text-[var(--ink-faint)]">Зачем</p>
              <p className="text-[15px]">{plan.why}</p>
            </div>
          ) : null}
          {plan.strategy ? (
            <div>
              <p className="text-[12px] text-[var(--ink-faint)]">Как двигаюсь</p>
              <p className="text-[15px]">{plan.strategy}</p>
            </div>
          ) : null}
        </section>
      )}

      <section className="space-y-5">
        <p className="text-[12px] font-medium text-[var(--ink-faint)]">Этапы</p>

        {plan.phases.map((stage) => {
          const d = modDraft(stage.id);
          const modules = stage.modules ?? [];
          return (
            <div key={stage.id} className="card space-y-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-semibold">{stage.title}</p>
                  <p className="text-[12px] text-[var(--ink-faint)]">
                    {[
                      stage.deadlineStart && stage.deadlineEnd
                        ? `${stage.deadlineStart} — ${stage.deadlineEnd}`
                        : stage.deadlineEnd
                          ? `до ${stage.deadlineEnd}`
                          : stage.deadlineStart
                            ? `с ${stage.deadlineStart}`
                            : null,
                      `${stage.progress ?? 0}%`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                {stage.status !== "active" ? (
                  <button
                    type="button"
                    className="btn btn-soft text-[12px]"
                    disabled={busy}
                    onClick={() =>
                      post({ action: "activatePhase", planId: plan.id, phaseId: stage.id })
                    }
                  >
                    Сделать текущим
                  </button>
                ) : (
                  <span className="text-[12px] text-[var(--ink-faint)]">текущий</span>
                )}
              </div>

              <div className="meter">
                <span style={{ width: `${stage.progress ?? 0}%` }} />
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <label className="space-y-1 text-[12px] text-[var(--ink-faint)]">
                  Начало этапа
                  <input
                    type="date"
                    value={stage.deadlineStart ?? ""}
                    onChange={(e) =>
                      post({
                        action: "updatePhase",
                        planId: plan.id,
                        phaseId: stage.id,
                        deadlineStart: e.target.value,
                      })
                    }
                  />
                </label>
                <label className="space-y-1 text-[12px] text-[var(--ink-faint)]">
                  Конец этапа
                  <input
                    type="date"
                    value={stage.deadlineEnd ?? ""}
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

              <div className="space-y-3">
                <p className="text-[12px] text-[var(--ink-faint)]">Модули</p>
                {modules.map((m) => (
                  <div key={m.id} className="space-y-2 rounded-[14px] bg-[var(--bg)] p-3">
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
                      <span className="min-w-0 flex-1 text-[14px] font-medium">{m.title}</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        type="date"
                        value={m.deadlineStart ?? ""}
                        onChange={(e) =>
                          post({
                            action: "updateModule",
                            planId: plan.id,
                            phaseId: stage.id,
                            moduleId: m.id,
                            deadlineStart: e.target.value,
                          })
                        }
                      />
                      <input
                        type="date"
                        value={m.deadlineEnd ?? ""}
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
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="date"
                        value={d.taskDate}
                        onChange={(e) =>
                          setModuleDrafts({
                            ...moduleDrafts,
                            [stage.id]: { ...d, taskDate: e.target.value },
                          })
                        }
                      />
                      <button
                        type="button"
                        className="btn btn-soft text-[12px]"
                        disabled={busy}
                        onClick={() =>
                          post({
                            action: "addTaskFromModule",
                            planId: plan.id,
                            phaseId: stage.id,
                            moduleId: m.id,
                            date: d.taskDate,
                            title: m.title,
                          })
                        }
                      >
                        В день
                      </button>
                    </div>
                  </div>
                ))}

                <div className="space-y-2">
                  <input
                    placeholder="Название модуля"
                    value={d.title}
                    onChange={(e) =>
                      setModuleDrafts({
                        ...moduleDrafts,
                        [stage.id]: { ...d, title: e.target.value },
                      })
                    }
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      type="date"
                      value={d.deadlineStart}
                      onChange={(e) =>
                        setModuleDrafts({
                          ...moduleDrafts,
                          [stage.id]: { ...d, deadlineStart: e.target.value },
                        })
                      }
                    />
                    <input
                      type="date"
                      value={d.deadlineEnd}
                      onChange={(e) =>
                        setModuleDrafts({
                          ...moduleDrafts,
                          [stage.id]: { ...d, deadlineEnd: e.target.value },
                        })
                      }
                    />
                  </div>
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
                        deadlineStart: d.deadlineStart || undefined,
                        deadlineEnd: d.deadlineEnd || undefined,
                      });
                      setModuleDrafts({
                        ...moduleDrafts,
                        [stage.id]: {
                          title: "",
                          deadlineStart: "",
                          deadlineEnd: "",
                          taskDate: d.taskDate,
                        },
                      });
                    }}
                  >
                    + Модуль
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        <div className="card space-y-3 p-4">
          <input
            placeholder="Название этапа"
            value={stageDraft.title}
            onChange={(e) => setStageDraft({ ...stageDraft, title: e.target.value })}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              type="date"
              value={stageDraft.deadlineStart}
              onChange={(e) => setStageDraft({ ...stageDraft, deadlineStart: e.target.value })}
            />
            <input
              type="date"
              value={stageDraft.deadlineEnd}
              onChange={(e) => setStageDraft({ ...stageDraft, deadlineEnd: e.target.value })}
            />
          </div>
          <button
            type="button"
            className="btn btn-ink"
            disabled={busy || !stageDraft.title.trim()}
            onClick={() => {
              post({
                action: "addPhase",
                planId: plan.id,
                title: stageDraft.title.trim(),
                deadlineStart: stageDraft.deadlineStart || undefined,
                deadlineEnd: stageDraft.deadlineEnd || undefined,
              });
              setStageDraft({ title: "", deadlineStart: "", deadlineEnd: "" });
            }}
          >
            + Этап
          </button>
        </div>
      </section>

      {today.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-medium text-[var(--ink-faint)]">Сегодня</p>
            <Link href="/today" className="text-[13px] font-medium text-[var(--ink-faint)]">
              Сегодня →
            </Link>
          </div>
          <ul className="space-y-2">
            {today.map((t) => (
              <li key={t.id} className="text-[15px]">
                {t.done ? "✓ " : "○ "}
                {t.title}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
