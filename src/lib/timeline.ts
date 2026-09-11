import { todayKey } from "./id";
import { formatMinutes } from "./time";
import { financeTypeLabel } from "./ui-colors";
import type { LifeStore } from "./types";

export type TimelineRange = "day" | "week" | "month" | "half" | "year";

export type TimelineKind =
  | "task"
  | "habit"
  | "time"
  | "finance"
  | "thought"
  | "capture"
  | "quest"
  | "vitals"
  | "project"
  | "calendar"
  | "thing";

export interface TimelineEvent {
  id: string;
  kind: TimelineKind;
  at: string;
  date: string;
  title: string;
  subtitle?: string;
  href?: string;
  meta?: Record<string, unknown>;
}

export const TIMELINE_KIND_LABELS: Record<TimelineKind, string> = {
  task: "Задача",
  habit: "Привычка",
  time: "Фокус",
  finance: "Финансы",
  thought: "Мысль",
  capture: "Захват",
  quest: "Квест",
  vitals: "Здоровье",
  project: "Проект",
  calendar: "Календарь",
  thing: "Вещь",
};

export const ALL_TIMELINE_KINDS = Object.keys(TIMELINE_KIND_LABELS) as TimelineKind[];

const RANGE_DAYS: Record<TimelineRange, number> = {
  day: 1,
  week: 7,
  month: 30,
  half: 183,
  year: 365,
};

function addDays(iso: string, delta: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function timelineRangeBounds(
  range: TimelineRange,
  anchor = todayKey(),
  before?: string
): { from: string; to: string } {
  const to = before ? addDays(before, -1) : anchor;
  const from = addDays(to, -(RANGE_DAYS[range] - 1));
  return { from, to };
}

function inRange(date: string, from: string, to: string): boolean {
  return date >= from && date <= to;
}

function dayFromIso(iso: string): string {
  return iso.slice(0, 10);
}

function habitTitle(store: LifeStore, habitId: string): string {
  return store.habits.find((h) => h.id === habitId)?.title ?? "Привычка";
}

function push(events: TimelineEvent[], event: TimelineEvent) {
  events.push(event);
}

export function buildTimeline(
  store: LifeStore,
  opts: {
    from: string;
    to: string;
    kinds?: TimelineKind[];
  }
): TimelineEvent[] {
  const allowed = opts.kinds?.length ? new Set(opts.kinds) : new Set(ALL_TIMELINE_KINDS);
  const events: TimelineEvent[] = [];
  const { from, to } = opts;

  const kindOk = (k: TimelineKind) => allowed.has(k);

  if (kindOk("task")) {
    for (const t of store.dayTasks ?? []) {
      if (t.archived || !t.done || !inRange(t.date, from, to)) continue;
      push(events, {
        id: `task:${t.id}`,
        kind: "task",
        at: t.date,
        date: t.date,
        title: t.title,
        subtitle: t.goalTitle ? `Цель: ${t.goalTitle}` : undefined,
        href: t.goalId ? `/goals/${t.goalId}` : "/",
      });
    }
    for (const log of store.stageDayLogs ?? []) {
      if (!log.done || !inRange(log.date, from, to)) continue;
      const goal = store.goals.find((g) => g.stages?.some((s) => s.id === log.stageId));
      const stage = goal?.stages.find((s) => s.id === log.stageId);
      if (!stage) continue;
      push(events, {
        id: `stage:${log.id}`,
        kind: "task",
        at: log.date,
        date: log.date,
        title: stage.title,
        subtitle: goal ? `Этап · ${goal.title}` : "Этап цели",
        href: goal ? `/goals/${goal.id}` : "/goals",
      });
    }
    for (const stage of store.roadmap?.stages ?? []) {
      for (const month of stage.months ?? []) {
        for (const day of month.days ?? []) {
          if (!inRange(day.date, from, to)) continue;
          for (const task of day.tasks ?? []) {
            if (!task.done) continue;
            push(events, {
              id: `roadmap:${day.id}:${task.id}`,
              kind: "task",
              at: day.date,
              date: day.date,
              title: task.title,
              subtitle: `Roadmap · ${stage.title}`,
              href: "/",
            });
          }
        }
      }
    }
  }

  if (kindOk("habit")) {
    for (const log of store.habitLogs ?? []) {
      if (log.value <= 0 || !inRange(log.date, from, to)) continue;
      push(events, {
        id: `habit:${log.id}`,
        kind: "habit",
        at: log.createdAt || log.date,
        date: log.date,
        title: habitTitle(store, log.habitId),
        subtitle: log.value > 1 ? `${log.value} раз` : undefined,
        href: "/habits",
      });
    }
  }

  if (kindOk("time")) {
    for (const e of store.timeEntries ?? []) {
      if (!inRange(e.date, from, to)) continue;
      push(events, {
        id: `time:${e.id}`,
        kind: "time",
        at: e.startedAt,
        date: e.date,
        title: e.taskTitle,
        subtitle: [
          formatMinutes(e.durationMinutes),
          e.goalTitle ? e.goalTitle : null,
        ]
          .filter(Boolean)
          .join(" · "),
        href: e.goalId ? `/goals/${e.goalId}` : "/",
        meta: { minutes: e.durationMinutes },
      });
    }
  }

  if (kindOk("finance")) {
    for (const tx of store.finance?.transactions ?? []) {
      if (tx.archived || !inRange(tx.date, from, to)) continue;
      push(events, {
        id: `finance:${tx.id}`,
        kind: "finance",
        at: tx.date,
        date: tx.date,
        title: tx.title,
        subtitle: `${financeTypeLabel(tx.type)} · ${tx.amount.toLocaleString("ru-RU")} ₽`,
        href: "/finance",
        meta: { type: tx.type, amount: tx.amount },
      });
    }
  }

  if (kindOk("thought")) {
    for (const journal of store.thoughtJournals ?? []) {
      if (journal.archived) continue;
      for (const entry of journal.entries ?? []) {
        if (entry.archived || !inRange(entry.date, from, to)) continue;
        push(events, {
          id: `thought:${entry.id}`,
          kind: "thought",
          at: entry.date,
          date: entry.date,
          title: entry.word || entry.body.slice(0, 80),
          subtitle: journal.title,
          href: "/life",
        });
      }
    }
  }

  if (kindOk("capture")) {
    for (const c of store.captures ?? []) {
      const date = dayFromIso(c.createdAt);
      if (!inRange(date, from, to)) continue;
      push(events, {
        id: `capture:${c.id}`,
        kind: "capture",
        at: c.createdAt,
        date,
        title: c.raw.slice(0, 120),
        subtitle: c.status === "processed" ? "Обработано" : undefined,
        href: "/life",
      });
    }
  }

  if (kindOk("quest")) {
    for (const q of store.quests ?? []) {
      if (!q.done) continue;
      const date = q.date ?? q.weekStart ?? dayFromIso(q.createdAt);
      if (!date || !inRange(date, from, to)) continue;
      push(events, {
        id: `quest:${q.id}`,
        kind: "quest",
        at: q.createdAt,
        date,
        title: q.title,
        subtitle: q.xpReward ? `+${q.xpReward} XP` : undefined,
        href: "/analytics",
      });
    }
  }

  if (kindOk("vitals")) {
    for (const v of store.vitals ?? []) {
      if (!inRange(v.date, from, to)) continue;
      const parts: string[] = [];
      if (v.waterMl > 0) parts.push(`вода ${v.waterMl} мл`);
      if (v.sleepHours > 0) parts.push(`сон ${v.sleepHours} ч`);
      if (v.mood != null) parts.push(`настроение ${v.mood}/5`);
      const prayers = Object.values(v.prayers ?? {}).filter(Boolean).length;
      if (prayers > 0) parts.push(`намаз ${prayers}/5`);
      if (parts.length === 0) continue;
      push(events, {
        id: `vitals:${v.date}`,
        kind: "vitals",
        at: v.date,
        date: v.date,
        title: "День здоровья",
        subtitle: parts.join(" · "),
        href: "/habits",
      });
    }
  }

  if (kindOk("project")) {
    for (const p of store.projects ?? []) {
      if (p.status === "archived") continue;
      for (const entry of p.diary ?? []) {
        if (entry.archived) continue;
        const date = dayFromIso(entry.createdAt);
        if (!inRange(date, from, to)) continue;
        push(events, {
          id: `project-diary:${p.id}:${entry.id}`,
          kind: "project",
          at: entry.createdAt,
          date,
          title: entry.title,
          subtitle: `${p.name} · ${entry.kind}`,
          href: "/goals",
        });
      }
      for (const ch of p.modules?.changelog ?? []) {
        const date = dayFromIso(ch.at);
        if (!inRange(date, from, to)) continue;
        push(events, {
          id: `project-ch:${p.id}:${ch.at}:${ch.text.slice(0, 20)}`,
          kind: "project",
          at: ch.at,
          date,
          title: ch.text,
          subtitle: p.name,
          href: "/goals",
        });
      }
    }
  }

  if (kindOk("calendar")) {
    for (const ev of store.calendarEvents ?? []) {
      if (ev.archived || !inRange(ev.date, from, to)) continue;
      push(events, {
        id: `cal:${ev.id}`,
        kind: "calendar",
        at: ev.date,
        date: ev.date,
        title: ev.title,
        subtitle: ev.note,
        href: "/",
      });
    }
  }

  if (kindOk("thing")) {
    for (const block of store.wishBlocks ?? []) {
      if (block.archived) continue;
      for (const item of block.items ?? []) {
        if (item.archived || !item.done) continue;
        const date = item.doneAt ? dayFromIso(item.doneAt) : null;
        if (!date || !inRange(date, from, to)) continue;
        push(events, {
          id: `thing:${block.id}:${item.id}`,
          kind: "thing",
          at: item.doneAt!,
          date,
          title: item.title,
          subtitle: `#${block.hashtag}`,
          href: "/wishlist",
        });
      }
    }
    for (const w of store.wishes ?? []) {
      if (w.archived || !w.done) continue;
      const date = dayFromIso(w.createdAt);
      if (!inRange(date, from, to)) continue;
      push(events, {
        id: `wish-legacy:${w.id}`,
        kind: "thing",
        at: w.createdAt,
        date,
        title: w.title,
        subtitle: "Wishlist",
        href: "/wishlist",
      });
    }
  }

  events.sort((a, b) => {
    const da = a.at.localeCompare(b.at);
    if (da !== 0) return -da;
    return a.id.localeCompare(b.id);
  });

  return events;
}

export function countByKind(events: TimelineEvent[]): Partial<Record<TimelineKind, number>> {
  const counts: Partial<Record<TimelineKind, number>> = {};
  for (const e of events) {
    counts[e.kind] = (counts[e.kind] ?? 0) + 1;
  }
  return counts;
}

export type TimelineSummary = {
  total: number;
  counts: Partial<Record<TimelineKind, number>>;
  focusMinutes: number;
  income: number;
  expense: number;
  activeDays: number;
};

export function summarizeTimeline(events: TimelineEvent[]): TimelineSummary {
  const counts = countByKind(events);
  const days = new Set<string>();
  let focusMinutes = 0;
  let income = 0;
  let expense = 0;

  for (const e of events) {
    days.add(e.date);
    if (e.kind === "time" && e.meta?.minutes != null) {
      focusMinutes += Number(e.meta.minutes);
    }
    if (e.kind === "finance" && e.meta?.amount != null) {
      const amt = Number(e.meta.amount);
      const txType = String(e.meta.type ?? "");
      if (txType === "income") income += amt;
      if (txType === "expense" || txType === "mandatory") expense += amt;
    }
  }

  return {
    total: events.length,
    counts,
    focusMinutes,
    income,
    expense,
    activeDays: days.size,
  };
}

export function eventsByKind(events: TimelineEvent[]): Record<TimelineKind, TimelineEvent[]> {
  const map = {} as Record<TimelineKind, TimelineEvent[]>;
  for (const k of ALL_TIMELINE_KINDS) map[k] = [];
  for (const e of events) {
    map[e.kind].push(e);
  }
  return map;
}

export function groupEventsByDate(events: TimelineEvent[]): { date: string; events: TimelineEvent[] }[] {
  const map = new Map<string, TimelineEvent[]>();
  for (const e of events) {
    const list = map.get(e.date) ?? [];
    list.push(e);
    map.set(e.date, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, dayEvents]) => ({ date, events: dayEvents }));
}

export function formatTimelineDay(date: string): string {
  const d = new Date(date + "T12:00:00");
  const today = todayKey();
  const yesterday = addDays(today, -1);
  const label = d.toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  if (date === today) return `Сегодня · ${label}`;
  if (date === yesterday) return `Вчера · ${label}`;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatTimelineTime(at: string): string {
  if (at.length <= 10) return "";
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}
