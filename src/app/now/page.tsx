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
    area: { name: string } | null;
    workPlan?: { id: string; title: string; progress: number } | null;
  }[];
  notDoing: { id: string; title: string; area?: string }[];
  tasks: {
    id: string;
    title: string;
    done: boolean;
    chain: { goal?: string; phase?: string; area?: string; workPlan?: string; why?: string };
  }[];
  load: { percent: number };
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
    <div className="fade-in mx-auto max-w-2xl space-y-12 pb-16">
      <header className="space-y-3">
        <h1 className="font-display text-4xl tracking-[-0.04em]">Сейчас</h1>
        {data.plan?.title ? (
          <p className="text-[15px] text-[var(--ink-soft)]">{data.plan.title}</p>
        ) : null}
      </header>

      {data.matters.length > 0 ? (
        <section className="space-y-4">
          <p className="text-[12px] font-medium text-[var(--ink-faint)]">Важно сейчас</p>
          <ul className="space-y-3">
            {data.matters.map((m) => (
              <li key={m.id}>
                <Link href={`/goals?id=${m.id}`} className="flex items-baseline justify-between gap-3">
                  <span className="text-[17px] font-semibold tracking-[-0.02em]">{m.title}</span>
                  <span className="tabular-nums text-[14px] text-[var(--ink-faint)]">{m.progress}%</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.workingOn.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-medium text-[var(--ink-faint)]">В работе</p>
            <Link href="/week" className="text-[13px] font-medium text-[var(--ink-faint)]">
              Неделя →
            </Link>
          </div>
          <div className="space-y-3">
            {data.workingOn.map((g) => (
              <Link key={g.id} href={`/goals?id=${g.id}`} className="card block space-y-2 p-5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-semibold tracking-[-0.02em]">{g.title}</p>
                  <span className="tabular-nums text-[14px] text-[var(--ink-faint)]">{g.progress}%</span>
                </div>
                {g.phase ? (
                  <p className="text-[13px] text-[var(--ink-faint)]">Этап · {g.phase.title}</p>
                ) : null}
                {g.workPlan ? (
                  <p className="text-[13px] text-[var(--ink-faint)]">
                    План · {g.workPlan.progress}%
                  </p>
                ) : null}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-medium text-[var(--ink-faint)]">Сегодня</p>
          <Link href="/today" className="text-[13px] font-medium text-[var(--ink-faint)]">
            Открыть →
          </Link>
        </div>
        <p className="font-display text-3xl tabular-nums tracking-[-0.04em]">
          {data.load.percent}%
          <span className="ml-2 text-[13px] font-medium text-[var(--ink-faint)]">нагрузка</span>
        </p>
        {open.length > 0 ? (
          <ul className="space-y-3">
            {open.slice(0, 5).map((t) => (
              <li key={t.id} className="text-[15px]">
                <span className="font-medium">{t.title}</span>
                {t.chain.why || t.chain.goal ? (
                  <span className="meta-quiet">
                    {" "}
                    · {t.chain.why || [t.chain.goal, t.chain.phase].filter(Boolean).join(" → ")}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {data.notDoing.length > 0 ? (
        <section className="space-y-4">
          <p className="text-[12px] font-medium text-[var(--ink-faint)]">Позже</p>
          <ul className="space-y-3">
            {data.notDoing.map((g) => (
              <li key={g.id} className="text-[15px] text-[var(--ink-soft)]">
                {g.title}
                {g.area ? <span className="meta-quiet"> · {g.area}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
