"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type LifePayload = {
  today: string;
  plan: { title: string; startDate: string; endDate: string } | null;
  matters: { id: string; title: string; progress: number }[];
  workingOn: {
    id: string;
    title: string;
    progress: number;
    phase: { title: string } | null;
    area: { name: string; emoji?: string } | null;
  }[];
  notDoing: { id: string; title: string; area?: string }[];
  tasks: {
    id: string;
    title: string;
    done: boolean;
    effectivePriority: string;
    chain: { goal?: string; phase?: string; area?: string };
  }[];
  load: { percent: number; must: number; should: number; optional: number };
};

export default function NowPage() {
  const [data, setData] = useState<LifePayload | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/life");
    setData(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) return <div className="text-[var(--ink-faint)]">…</div>;

  const open = data.tasks.filter((t) => !t.done);

  return (
    <div className="fade-in mx-auto max-w-2xl space-y-8 pb-10">
      <header className="space-y-2">
        <h1 className="font-display text-4xl">Now</h1>
        <p className="text-[15px] text-[var(--ink-soft)]">
          {data.plan?.title ?? "6-month plan"}
        </p>
      </header>

      <section className="card space-y-3 p-5">
        <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--ink-faint)]">
          What matters now
        </p>
        {data.matters.length === 0 ? (
          <p className="text-[13px] text-[var(--ink-faint)]">Добавь цели в Foundation / Goals</p>
        ) : (
          <ul className="space-y-2">
            {data.matters.map((m) => (
              <li key={m.id}>
                <Link href={`/goals?id=${m.id}`} className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">{m.title}</span>
                  <span className="tabular-nums text-[var(--ink-soft)]">{m.progress}%</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--ink-faint)]">
            What I&apos;m working on
          </p>
          <Link href="/week" className="text-[13px] font-semibold text-[var(--ink-soft)]">
            Week →
          </Link>
        </div>
        <div className="space-y-2">
          {data.workingOn.length === 0 ? (
            <p className="text-[13px] text-[var(--ink-faint)]">Нет активных целей</p>
          ) : (
            data.workingOn.map((g) => (
              <Link key={g.id} href={`/goals?id=${g.id}`} className="card block space-y-1 p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-semibold">
                    {g.area?.emoji ? `${g.area.emoji} ` : ""}
                    {g.title}
                  </p>
                  <span className="tabular-nums text-[var(--ink-soft)]">{g.progress}%</span>
                </div>
                {g.phase ? (
                  <p className="text-[13px] text-[var(--ink-faint)]">Phase · {g.phase.title}</p>
                ) : null}
              </Link>
            ))
          )}
        </div>
      </section>

      <section className="card space-y-3 p-5">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--ink-faint)]">
            Today
          </p>
          <Link href="/today" className="text-[13px] font-semibold text-[var(--ink-soft)]">
            Open →
          </Link>
        </div>
        <p
          className={`font-display text-3xl tabular-nums ${
            data.load.percent > 100 ? "text-[var(--bad)]" : ""
          }`}
        >
          {data.load.percent}%
          <span className="ml-2 text-[13px] font-semibold text-[var(--ink-faint)]">load</span>
        </p>
        <ul className="space-y-2">
          {open.slice(0, 5).map((t) => (
            <li key={t.id} className="text-[14px]">
              <span className="font-medium">{t.title}</span>
              {t.chain.goal ? (
                <span className="meta-quiet"> · {t.chain.goal}</span>
              ) : null}
            </li>
          ))}
          {open.length === 0 ? (
            <li className="text-[13px] text-[var(--ink-faint)]">Пусто — открой Week</li>
          ) : null}
        </ul>
      </section>

      <section className="card space-y-3 p-5">
        <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--ink-faint)]">
          Intentionally not doing
        </p>
        {data.notDoing.length === 0 ? (
          <p className="text-[13px] text-[var(--ink-faint)]">Later-цели появятся здесь</p>
        ) : (
          <ul className="space-y-2">
            {data.notDoing.map((g) => (
              <li key={g.id} className="text-[14px] text-[var(--ink-soft)]">
                {g.title}
                {g.area ? <span className="meta-quiet"> · {g.area}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
