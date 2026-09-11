"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/client-api";
import { EmptyState } from "@/components/ui/Progress";
import { TaskRow, type TaskRowData } from "@/components/tasks/TaskRow";
import { toast } from "@/components/ui/Toast";

type NextPurchase = {
  blockId: string;
  itemId: string;
  title: string;
  hashtag: string;
  description?: string;
  cushion: number;
  currency: string;
  targetAmount?: number;
  savedToward?: number;
  progress?: number;
};

type DiaryStage = {
  order: number;
  indexInPhase: number;
  label: string;
  start: string;
  end: string;
  current: boolean;
};

type GoalTask = TaskRowData & {
  horizonStage?: number;
  goalTitle?: string;
  goalId?: string;
};

type HomeGoal = {
  id: string;
  title: string;
  horizonStage: number;
  hasPlan?: boolean;
};

type HomeData = {
  today: string;
  week: {
    planned: number;
    completed: number;
    remaining: number;
    percent: number;
  };
  nextPurchase: NextPurchase | null;
  diary: {
    phaseNum: number;
    label: string;
    stages: DiaryStage[];
    defaultStage: number;
  };
  goals: HomeGoal[];
  tasks: {
    fromGoals: GoalTask[];
    personal: TaskRowData[];
    habits: TaskRowData[];
    overdue: TaskRowData[];
  };
};

const STAGE_COLORS = ["var(--c-blue)", "var(--c-green)", "var(--c-violet)"] as const;

function formatDay(iso: string) {
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString("ru-RU", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  } catch {
    return iso;
  }
}

export default function HomePage() {
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [personalTitle, setPersonalTitle] = useState("");
  const [diaryStage, setDiaryStage] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await apiGet("/api/os");
    if (res.ok) {
      const d = res.data as unknown as HomeData;
      setData(d);
      setDiaryStage(() => {
        // Always land on the live calendar stage — other tabs are diary browse only.
        return d.diary?.defaultStage ?? d.diary?.stages.find((s) => s.current)?.order ?? 1;
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function selectStage(order: number) {
    setDiaryStage(order);
  }

  async function addPersonal(e: React.FormEvent) {
    e.preventDefault();
    const title = personalTitle.trim();
    if (!title) return;
    const res = await apiPost("/api/tasks", { action: "add", title, date: data?.today });
    if (!res.ok) {
      toast(res.error ?? "Не удалось добавить", "warn");
      return;
    }
    setPersonalTitle("");
    toast("Добавила", "ok");
    await load();
  }

  const stageMeta = useMemo(() => {
    if (!data?.diary || diaryStage == null) return null;
    return data.diary.stages.find((s) => s.order === diaryStage) ?? null;
  }, [data, diaryStage]);

  const stageTasks = useMemo(() => {
    if (!data || diaryStage == null) return [];
    return data.tasks.fromGoals.filter((t) => t.horizonStage === diaryStage);
  }, [data, diaryStage]);

  const stageGoals = useMemo(() => {
    if (!data || diaryStage == null) return [];
    return (data.goals ?? []).filter((g) => g.horizonStage === diaryStage);
  }, [data, diaryStage]);

  const isLiveStage = Boolean(stageMeta?.current);

  if (loading) return <p className="text-[var(--ink-faint)]">Секунду…</p>;
  if (!data) {
    return <EmptyState title="Не удалось загрузить" body="Проверь vault или облако." />;
  }

  const accent =
    STAGE_COLORS[((stageMeta?.indexInPhase ?? 1) - 1) % STAGE_COLORS.length] ?? "var(--c-blue)";

  const work = isLiveStage
    ? [...stageTasks, ...data.tasks.personal, ...data.tasks.habits]
    : [];
  const doneToday = work.filter((t) => t.done).length;
  const totalToday = work.length;

  const currentLabel =
    data.diary.stages.find((s) => s.current)?.label ?? `Этап ${data.diary.defaultStage}`;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-[2.4rem] capitalize md:text-[2.8rem]">
          {formatDay(data.today)}
        </h1>
        <p className="mt-2 text-[15px] font-semibold" style={{ color: accent }}>
          {totalToday === 0 ? "Нет задач" : `${doneToday} из ${totalToday}`}
        </p>
      </header>

      <section>
        <div className="flex gap-2">
          {data.diary.stages.map((s, i) => {
            const on = s.order === diaryStage;
            const c = STAGE_COLORS[i % STAGE_COLORS.length];
            return (
              <button
                key={s.order}
                type="button"
                onClick={() => selectStage(s.order)}
                className="flex-1 rounded-[16px] px-3 py-3 text-center transition"
                style={{
                  background: on ? c : "var(--bg-muted)",
                  color: on ? "#fff" : c,
                  boxShadow: on ? `0 8px 20px ${c}40` : undefined,
                }}
              >
                <span className="block text-[14px] font-bold">{s.label}</span>
                {s.current ? (
                  <span className="mt-0.5 block text-[10px] font-bold opacity-80">сегодня</span>
                ) : null}
              </button>
            );
          })}
        </div>
        {!isLiveStage ? (
          <p className="mt-3 text-[13px] font-semibold" style={{ color: accent }}>
            Дневник этапа — шаги дня только в {currentLabel}
          </p>
        ) : null}
      </section>

      {isLiveStage ? (
      <section>
        <h2 className="font-display text-[1.45rem]">Привычки</h2>
        {data.tasks.habits.length === 0 ? (
          <div className="mt-3">
            <Link href="/habits" className="text-[13px] font-bold text-[var(--c-green)]">
              Добавить →
            </Link>
          </div>
        ) : (
          <div className="surface mt-3 px-4">
            {data.tasks.habits.map((t) => (
              <TaskRow key={t.id} task={t} onToggle={() => void load()} />
            ))}
          </div>
        )}
      </section>
      ) : null}

      {isLiveStage ? (
      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-display text-[1.45rem]">Коплю</h2>
          <Link href="/wishlist" className="text-[13px] font-bold text-[var(--c-pink)]">
            wishlist →
          </Link>
        </div>
        {data.nextPurchase ? (
          <Link
            href="/wishlist"
            className="surface block p-5 transition hover:shadow-[var(--shadow)]"
            style={{ borderLeft: "4px solid var(--c-pink)", background: "var(--c-pink-soft)" }}
          >
            <p className="text-[12px] font-bold text-[var(--c-pink)]">#{data.nextPurchase.hashtag}</p>
            <p className="mt-1 text-[17px] font-bold">{data.nextPurchase.title}</p>
            {data.nextPurchase.targetAmount ? (
              <p className="mt-3 text-[14px] font-semibold text-[var(--c-pink)]">
                {(data.nextPurchase.savedToward ?? 0).toLocaleString("ru-RU")} /{" "}
                {data.nextPurchase.targetAmount.toLocaleString("ru-RU")} {data.nextPurchase.currency}
                {data.nextPurchase.progress != null
                  ? ` · ${Math.round(data.nextPurchase.progress * 100)}%`
                  : ""}
              </p>
            ) : (
              <p className="mt-3 text-[14px] font-semibold text-[var(--c-pink)]">
                Подушка {data.nextPurchase.cushion.toLocaleString("ru-RU")}{" "}
                {data.nextPurchase.currency}
              </p>
            )}
          </Link>
        ) : (
          <Link
            href="/wishlist"
            className="block rounded-[18px] border border-dashed border-[var(--line)] px-4 py-5 text-[13px] font-semibold text-[var(--c-pink)]"
          >
            Выбери покупку в wishlist
          </Link>
        )}
      </section>
      ) : null}

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="font-display text-[1.45rem]">
            {isLiveStage ? "Задачи" : "Цели этапа"}
          </h2>
          <Link href="/goals" className="text-[13px] font-bold" style={{ color: accent }}>
            цели →
          </Link>
        </div>

        {!isLiveStage ? (
          <div className="surface mt-3 px-4">
            {stageGoals.length === 0 ? (
              <p className="py-6 text-center text-[14px] font-semibold" style={{ color: accent }}>
                В этом этапе пока нет целей
              </p>
            ) : (
              stageGoals.map((g) => (
                <Link
                  key={g.id}
                  href={`/goals/${g.id}`}
                  className="flex items-center justify-between border-b border-[var(--line)] py-3.5 last:border-0"
                >
                  <span className="font-bold">{g.title}</span>
                  <span className="text-[12px] font-bold" style={{ color: accent }}>
                    {g.hasPlan ? "план →" : "открыть →"}
                  </span>
                </Link>
              ))
            )}
          </div>
        ) : (
          <>
            {data.tasks.overdue.length > 0 ? (
              <div className="mt-2">
                <p className="mb-2 text-[12px] font-bold text-[var(--behind)]">Просрочено</p>
                <div className="surface px-4">
                  {data.tasks.overdue.map((t) => (
                    <TaskRow key={t.id} task={t} onToggle={() => void load()} />
                  ))}
                </div>
              </div>
            ) : null}

            <div className="surface mt-3 px-4">
              {stageTasks.length === 0 && data.tasks.personal.length === 0 ? (
                <p className="py-4 text-center text-[13px] font-semibold text-[var(--ink-faint)]">
                  Нет шагов целей — открой цель и добавь блок плана
                </p>
              ) : null}
              {stageTasks.map((t) => (
                <TaskRow key={t.id} task={t} onToggle={() => void load()} />
              ))}
              {data.tasks.personal.map((t) => (
                <TaskRow key={t.id} task={t} onToggle={() => void load()} />
              ))}
              <form onSubmit={addPersonal} className="flex gap-2 py-3">
                <input
                  value={personalTitle}
                  onChange={(e) => setPersonalTitle(e.target.value)}
                  placeholder="Своя задача…"
                  className="field min-w-0 flex-1"
                />
                <button type="submit" className="btn btn-primary shrink-0">
                  +
                </button>
              </form>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
