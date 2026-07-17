"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import type { LifeNode, Project, ProjectDiaryEntry } from "@/lib/types";

interface Payload {
  project: Project;
  node?: LifeNode;
  relatedNodes: LifeNode[];
}

export default function ProjectCompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<Payload | null>(null);
  const [tab, setTab] = useState<"company" | "diary">("company");
  const [diary, setDiary] = useState<ProjectDiaryEntry[]>([]);
  const [entry, setEntry] = useState({ kind: "idea", title: "", body: "" });

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setDiary(d.project?.diary ?? []);
      });
  }, [id]);

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

  if (!data?.project) {
    return <div className="text-[var(--ink-faint)]">Загрузка…</div>;
  }

  const { project, relatedNodes } = data;
  const m = project.modules;

  return (
    <div className="fade-in mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/projects" className="meta-quiet text-[13px] font-semibold">
          ←
        </Link>
        <p className="meta-quiet mt-4">{project.status}</p>
        <h1 className="font-display mt-2 text-3xl md:text-4xl">{project.name}</h1>
        {project.tagline && (
          <p className="mt-2 text-[15px] text-[var(--ink-soft)]">{project.tagline}</p>
        )}
      </div>

      <div className="flex gap-2">
        <button type="button" className={`chip ${tab === "company" ? "chip-on" : ""}`} onClick={() => setTab("company")}>
          Компания
        </button>
        <button type="button" className={`chip ${tab === "diary" ? "chip-on" : ""}`} onClick={() => setTab("diary")}>
          Дневник
        </button>
      </div>

      {tab === "company" ? (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            {project.kpi.map((k) => (
              <div key={k.label} className="card p-4">
                <p className="eyebrow">{k.label}</p>
                <p className="mt-2 text-2xl font-bold">{k.value}</p>
              </div>
            ))}
          </section>
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
