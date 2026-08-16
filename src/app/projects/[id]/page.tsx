"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { LifeNode, Project, ProjectDiaryEntry } from "@/lib/types";

interface Payload {
  project: Project;
  node?: LifeNode;
  relatedNodes: LifeNode[];
  workPlan?: {
    id: string;
    title: string;
    progress: number;
    desiredResult?: string;
  } | null;
  error?: string;
}

export default function ProjectCompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<Payload | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"company" | "diary">("company");
  const [diary, setDiary] = useState<ProjectDiaryEntry[]>([]);
  const [entry, setEntry] = useState({ kind: "idea", title: "", body: "" });
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [planDraft, setPlanDraft] = useState({
    desiredResult: "",
    why: "",
    startingPoint: "",
    strategy: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch(`/api/projects/${id}`);
      const d = await res.json();
      if (!res.ok || d.error || !d.project) {
        setData(null);
        setLoadError(d.error === "not found" ? "Проект не найден" : d.error || "Ошибка загрузки");
        return;
      }
      setData(d);
      setDiary(d.project?.diary ?? []);
    } catch {
      setData(null);
      setLoadError("Не удалось загрузить проект");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function addDiary() {
    if (!entry.title.trim()) return;
    const res = await fetch(`/api/projects/${id}/diary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", ...entry }),
    });
    const d = await res.json();
    setDiary(d.diary ?? []);
    setEntry({ kind: "idea", title: "", body: "" });
  }

  if (loading) {
    return <div className="text-[var(--ink-faint)]">…</div>;
  }

  if (!data?.project) {
    return (
      <div className="fade-in mx-auto max-w-2xl space-y-4">
        <Link href="/projects" className="text-[13px] font-medium text-[var(--ink-faint)]">
          ← Projects
        </Link>
        <p className="text-[15px] text-[var(--ink-soft)]">{loadError || "Проект не найден"}</p>
      </div>
    );
  }

  const { project, relatedNodes, workPlan } = data;
  const m = project.modules;

  return (
    <div className="fade-in mx-auto max-w-2xl space-y-10 pb-16">
      <div>
        <Link href="/projects" className="text-[13px] font-medium text-[var(--ink-faint)]">
          ← Projects
        </Link>
        <p className="mt-4 text-[12px] text-[var(--ink-faint)]">{project.status}</p>
        <h1 className="font-display mt-2 text-3xl">{project.name}</h1>
        {project.tagline && (
          <p className="mt-2 text-[15px] text-[var(--ink-soft)]">{project.tagline}</p>
        )}
      </div>

      <section className="card space-y-4 p-6">
        <p className="text-[12px] font-medium text-[var(--ink-faint)]">План</p>
        {workPlan ? (
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="font-semibold">{workPlan.title}</p>
              <p className="text-[13px] text-[var(--ink-faint)]">{workPlan.progress}% complete</p>
            </div>
            <Link href={`/plans/${workPlan.id}`} className="btn btn-ink">
              Открыть план
            </Link>
          </div>
        ) : creatingPlan ? (
          <div className="space-y-3">
            {(
              [
                ["desiredResult", "Результат"],
                ["why", "Зачем"],
                ["startingPoint", "С чего начинаю"],
                ["strategy", "Как двигаюсь"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block space-y-1">
                <span className="text-[12px] text-[var(--ink-faint)]">{label}</span>
                <textarea
                  rows={2}
                  value={planDraft[key]}
                  onChange={(e) => setPlanDraft({ ...planDraft, [key]: e.target.value })}
                />
              </label>
            ))}
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-ink"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const { apiPost } = await import("@/lib/client-api");
                    const result = await apiPost("/api/work-plans", {
                      action: "create",
                      ownerType: "project",
                      ownerId: project.id,
                      title: `План: ${project.name}`,
                      ...planDraft,
                    });
                    const plan = result.data?.plan as { id?: string } | undefined;
                    if (plan?.id) {
                      window.location.href = `/plans/${plan.id}`;
                      return;
                    }
                    await load();
                    setCreatingPlan(false);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Создать план
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setCreatingPlan(false)}>
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn-ink" onClick={() => setCreatingPlan(true)}>
            + Создать план
          </button>
        )}
      </section>

      <div className="flex gap-2">
        <button
          type="button"
          className={`chip ${tab === "company" ? "chip-on" : ""}`}
          onClick={() => setTab("company")}
        >
          Компания
        </button>
        <button
          type="button"
          className={`chip ${tab === "diary" ? "chip-on" : ""}`}
          onClick={() => setTab("diary")}
        >
          Дневник
        </button>
      </div>

      {tab === "company" ? (
        <>
          {project.kpi.length > 0 ? (
            <section className="grid gap-3 sm:grid-cols-3">
              {project.kpi.map((k) => (
                <div key={k.label} className="card p-4">
                  <p className="eyebrow">{k.label}</p>
                  <p className="mt-2 text-2xl font-bold">{k.value}</p>
                </div>
              ))}
            </section>
          ) : null}
          <Dept title="Документы" items={m.docs} />
          <Dept title="Задачи" items={m.tasks.map((t) => `${t.done ? "✓" : "·"} ${t.title}`)} />
          <Dept title="Идеи" items={m.ideas} />
          <Dept title="Маркетинг" items={m.marketing} />
          {relatedNodes.length > 0 && (
            <section>
              <p className="eyebrow mb-3">На графе</p>
              <div className="flex flex-wrap gap-2">
                {relatedNodes.map((n) => (
                  <Link key={n.id} href={`/nodes/${n.id}`} className="chip">
                    {n.title}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <div className="card space-y-2 p-4">
            <p className="eyebrow">Запись дневника</p>
            <select
              value={entry.kind}
              onChange={(e) => setEntry({ ...entry, kind: e.target.value })}
            >
              <option value="idea">Идея</option>
              <option value="proposal">Предложение</option>
              <option value="rule">Правило</option>
              <option value="integration">Интеграция</option>
              <option value="note">Заметка</option>
            </select>
            <input
              placeholder="Заголовок"
              value={entry.title}
              onChange={(e) => setEntry({ ...entry, title: e.target.value })}
            />
            <textarea
              rows={3}
              placeholder="Содержание"
              value={entry.body}
              onChange={(e) => setEntry({ ...entry, body: e.target.value })}
            />
            <button type="button" className="btn btn-ink" onClick={addDiary}>
              Добавить
            </button>
          </div>
          {diary.map((d) => (
            <article key={d.id} className="card p-4">
              <p className="eyebrow">{d.kind}</p>
              <h3 className="mt-1 font-semibold">{d.title}</h3>
              <p className="mt-2 whitespace-pre-wrap text-[14px] text-[var(--ink-soft)]">{d.body}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Dept({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <section className="card p-5">
      <p className="eyebrow mb-3">{title}</p>
      <ul className="space-y-2 text-[14px]">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
