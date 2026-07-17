"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LifeEdge, LifeNode, Sphere } from "@/lib/types";

interface Payload {
  node: LifeNode;
  sphere?: Sphere;
  neighborhood: { nodes: LifeNode[]; edges: LifeEdge[] };
  project?: { id: string; name: string };
  goal?: { horizon: string; progress: number };
  habit?: { title: string; streak: number };
  book?: { title: string; author: string };
  skill?: { name: string; level: number; xp: number; xpToNext: number };
  wish?: { title: string; steps: { title: string; done: boolean }[] };
}

export function NodeDetail({ id }: { id: string }) {
  const [data, setData] = useState<Payload | null>(null);

  useEffect(() => {
    fetch(`/api/nodes/${id}`)
      .then((r) => r.json())
      .then(setData);
  }, [id]);

  if (!data?.node) {
    return <div className="text-[var(--ink-faint)]">Загрузка…</div>;
  }

  const { node, sphere, neighborhood } = data;
  const others = neighborhood.nodes.filter((n) => n.id !== node.id);

  return (
    <div className="fade-in mx-auto max-w-3xl space-y-8">
      <div>
        <Link href="/graph" className="text-[13px] font-semibold text-[var(--indigo)]">
          ← Карта
        </Link>
        <p className="eyebrow mt-4">
          {node.kind}
          {sphere ? ` · ${sphere.name}` : ""}
        </p>
        <h1 className="font-display mt-2 text-3xl md:text-4xl">{node.title}</h1>
        {node.body && node.body !== node.title && (
          <p className="mt-3 max-w-xl text-[15px] text-[var(--ink-soft)]">{node.body}</p>
        )}
        <div className="mt-4 flex gap-4 text-[12px] text-[var(--ink-faint)]">
          <span>Salience {Math.round(node.salience * 100)}%</span>
          <span>{new Date(node.createdAt).toLocaleString("ru-RU")}</span>
        </div>
      </div>

      {(data.goal || data.habit || data.project || data.book || data.skill || data.wish) && (
        <section className="grid gap-3 md:grid-cols-2">
          {data.goal && <Meta label="Цель" value={`${data.goal.horizon} · ${data.goal.progress}%`} />}
          {data.habit && <Meta label="Привычка" value={`streak ${data.habit.streak}d`} />}
          {data.project && (
            <Meta label="Проект" value={data.project.name} href={`/projects/${data.project.id}`} />
          )}
          {data.book && <Meta label="Книга" value={`${data.book.title} — ${data.book.author}`} />}
          {data.skill && (
            <Meta
              label="Навык"
              value={`Lvl ${data.skill.level} · ${data.skill.xp}/${data.skill.xpToNext}`}
            />
          )}
          {data.wish && (
            <Meta
              label="Wish"
              value={`${data.wish.steps.filter((s) => s.done).length}/${data.wish.steps.length} этапов`}
            />
          )}
        </section>
      )}

      <section className="card p-5">
        <p className="eyebrow mb-3">Связи</p>
        <ul className="space-y-2">
          {neighborhood.edges.map((e) => {
            const otherId = e.sourceId === node.id ? e.targetId : e.sourceId;
            const other = neighborhood.nodes.find((n) => n.id === otherId);
            if (!other) return null;
            return (
              <li key={e.id} className="flex flex-wrap items-baseline gap-2 text-[14px]">
                <span className="font-semibold text-[var(--indigo)]">{e.type}</span>
                <Link href={`/nodes/${other.id}`} className="font-medium hover:text-[var(--coral)]">
                  {other.title}
                </Link>
                <span className="text-[11px] text-[var(--ink-faint)]">
                  {Math.round(e.confidence * 100)}%
                </span>
              </li>
            );
          })}
          {neighborhood.edges.length === 0 && (
            <li className="text-[13px] text-[var(--ink-faint)]">Пока без связей.</li>
          )}
        </ul>
      </section>

      {others.length > 0 && (
        <section>
          <p className="eyebrow mb-3">Окрестность</p>
          <div className="flex flex-wrap gap-2">
            {others.map((n) => (
              <Link key={n.id} href={`/nodes/${n.id}`} className="chip hover:chip-on">
                {n.title}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Meta({ label, value, href }: { label: string; value: string; href?: string }) {
  const inner = (
    <>
      <p className="eyebrow">{label}</p>
      <p className="mt-2 text-[16px] font-semibold">{value}</p>
    </>
  );
  if (href) {
    return (
      <Link href={href} className="card block p-4 hover:border-[var(--indigo)]">
        {inner}
      </Link>
    );
  }
  return <div className="card p-4">{inner}</div>;
}
