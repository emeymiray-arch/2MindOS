import { todayKey } from "./id";
import {
  calcWorkPlanProgress,
  currentPhase,
  currentWorkPhase,
  dailyLoad,
  findWorkPlan,
  inheritTaskPriority,
  taskChain,
  weekStartMonday,
} from "./lifeos";
import { getQuestPayload, focusLoadPercent } from "./gamification";
import {
  activeTimerPayload,
  elapsedMinutesSince,
  formatMinutes,
  sumMinutesForDate,
  sumMinutesForGoal,
} from "./time";
import { calcGoalProgress, tasksForDate } from "./tasks";
import { cleanTopicTitle, isGenericPlanTitle } from "./daily-focus";
import { currentHorizonStage, effectiveHorizonStage, bucketForHorizonStage } from "./plan-calendar";
import type { LifeStore, TaskPriority } from "./types";

export type BriefingAction = {
  kind: "timer" | "task" | "mit" | "done" | "empty";
  taskId?: string;
  title: string;
  subtitle?: string;
  href: string;
  priority?: TaskPriority;
};

export type BriefingGap = {
  id: string;
  title: string;
  reason: string;
  href: string;
  severity: number;
  tag?: string;
};

export type BriefingGoal = {
  id: string;
  title: string;
  progress: number;
  phaseTitle?: string;
  bucket: string;
  deadline?: string;
  minutesWeek: number;
  hasPlan?: boolean;
  workPlanId?: string;
};

export type Briefing = {
  date: string;
  greeting: string;
  headline: string;
  subline: string;
  primary: BriefingAction;
  todayStats: {
    done: number;
    total: number;
    mustOpen: number;
    loadPercent: number;
    focusFormatted: string;
    focusPercent: number;
  };
  gaps: BriefingGap[];
  goals: BriefingGoal[];
  planTitle?: string;
};

function weekAgo(iso: string) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() - 6);
  return d.toISOString().slice(0, 10);
}

function greetingForHour(h: number): string {
  if (h < 6) return "Поздний вечер";
  if (h < 12) return "Доброе утро";
  if (h < 18) return "День";
  return "Вечер";
}

function collectOverdueGaps(store: LifeStore, today: string): BriefingGap[] {
  const gaps: BriefingGap[] = [];
  for (const g of store.goals.filter((x) => x.active && !x.archived)) {
    const wp = g.workPlanId ? findWorkPlan(store, g.workPlanId) : undefined;
    if (wp) {
      for (const ph of wp.phases ?? []) {
        if (ph.status === "done" || ph.archived) continue;
        for (const m of ph.modules ?? []) {
          if (m.done || !m.deadlineEnd || m.deadlineEnd >= today) continue;
          gaps.push({
            id: `od-${g.id}-${m.id}`,
            title: m.title,
            tag: "Просрочено",
            reason: g.title,
            href: `/goals?id=${g.id}`,
            severity: 90,
          });
        }
        if (
          ph.deadlineEnd &&
          ph.deadlineEnd < today &&
          (ph.modules ?? []).some((m) => !m.done)
        ) {
          gaps.push({
            id: `od-ph-${ph.id}`,
            title: ph.title,
            tag: "Этап",
            reason: g.title,
            href: `/goals?id=${g.id}`,
            severity: 85,
          });
        }
      }
    }
    for (const st of g.stages ?? []) {
      if (st.done || st.archived || !st.deadlineEnd || st.deadlineEnd >= today) continue;
      gaps.push({
        id: `od-st-${st.id}`,
        title: st.title,
        tag: "Просрочено",
        reason: g.title,
        href: `/goals?id=${g.id}`,
        severity: 80,
      });
    }
  }
  return gaps;
}

export function buildBriefing(store: LifeStore, date?: string): Briefing {
  const today = date ?? todayKey();
  const now = new Date();
  getQuestPayload(store, today);

  const rawTasks = tasksForDate(store, today).map((t) => ({
    ...t,
    effectivePriority: inheritTaskPriority(store, t),
    chain: taskChain(store, t),
  }));

  const open = rawTasks.filter((t) => !t.done);
  const done = rawTasks.length - open.length;
  const mustOpen = open.filter((t) => (t.effectivePriority ?? t.priority) === "must");
  const load = dailyLoad(rawTasks, store, store.settings.dailyCapacity ?? 6);
  const focusMinutes = sumMinutesForDate(store, today);
  const focusPercent = focusLoadPercent(store, today);
  const timer = activeTimerPayload(store);
  const mit = store.settings.mit?.trim();

  let primary: BriefingAction;

  if (timer) {
    const elapsed = formatMinutes(timer.elapsedMinutes);
    primary = {
      kind: "timer",
      taskId: timer.taskId,
      title: timer.taskTitle,
      subtitle: timer.goalTitle ? `${timer.goalTitle} · ${elapsed}` : elapsed,
      href: "/",
    };
  } else if (mustOpen.length > 0) {
    const t = mustOpen[0];
    const phase = t.chain.workPhase?.title ?? t.chain.phase?.title;
    const phaseLabel =
      phase && !isGenericPlanTitle(phase) ? cleanTopicTitle(phase) : undefined;
    primary = {
      kind: "task",
      taskId: t.id,
      title: t.title,
      subtitle: [t.chain.goal?.title, phaseLabel].filter(Boolean).join(" · "),
      href: "/",
      priority: "must",
    };
  } else if (open.length > 0) {
    const t = open[0];
    const phase = t.chain.workPhase?.title ?? t.chain.phase?.title;
    const phaseLabel =
      phase && !isGenericPlanTitle(phase) ? cleanTopicTitle(phase) : undefined;
    primary = {
      kind: "task",
      taskId: t.id,
      title: t.title,
      subtitle: [t.chain.goal?.title, phaseLabel].filter(Boolean).join(" · "),
      href: "/",
      priority: (t.effectivePriority ?? t.priority) as TaskPriority,
    };
  } else if (mit) {
    primary = {
      kind: "mit",
      title: mit,
      subtitle: "Фокус дня из настроек",
      href: "/settings",
    };
  } else if (rawTasks.length > 0) {
    primary = {
      kind: "done",
      title: "Все задачи на сегодня закрыты",
      subtitle: "Можно отдохнуть или заглянуть в цели",
      href: "/goals",
    };
  } else {
    primary = {
      kind: "empty",
      title: "На сегодня задач нет",
      subtitle: "Добавь на неделе или в целях",
      href: "/analytics",
    };
  }

  const gaps: BriefingGap[] = [];

  if (load.percent > 100) {
    gaps.push({
      id: "overload",
      title: "Перегруз",
      tag: "Нагрузка",
      reason: `${load.percent}% — перенеси или ослабь приоритет`,
      href: "/",
      severity: 95,
    });
  }

  gaps.push(...collectOverdueGaps(store, today));

  for (const g of store.goals.filter(
    (x) =>
      x.active &&
      !x.archived &&
      effectiveHorizonStage(x) <= currentHorizonStage(store, today) &&
      (x.priority === "critical" || x.priority === "high" || effectiveHorizonStage(x) === 1)
  )) {
    if (!g.workPlanId) {
      gaps.push({
        id: `noplan-${g.id}`,
        title: g.title,
        tag: "No plan",
        reason: "Создай Work Plan — иначе нет этапов и недели",
        href: `/goals?id=${g.id}`,
        severity: 75,
      });
    }
  }

  const weekFrom = weekAgo(today);
  for (const g of store.goals.filter(
    (x) =>
      x.active &&
      !x.archived &&
      effectiveHorizonStage(x) <= currentHorizonStage(store, today)
  )) {
    const mins = sumMinutesForGoal(store, g.id, weekFrom, today);
    const wp = g.workPlanId ? findWorkPlan(store, g.workPlanId) : undefined;
    const progress = wp ? calcWorkPlanProgress(wp) : calcGoalProgress(g, store);
    if (mins === 0 && progress < 40 && (g.priority === "critical" || g.priority === "high")) {
      gaps.push({
        id: `focus-${g.id}`,
        title: g.title,
        reason: "Нет фокуса за неделю — запусти таймер на задаче",
        href: `/goals?id=${g.id}`,
        severity: 70,
      });
    }
    if (progress < 15 && effectiveHorizonStage(g) === 1) {
      gaps.push({
        id: `slow-${g.id}`,
        title: g.title,
        reason: `Только ${progress}% — нужен шаг в плане`,
        href: `/goals?id=${g.id}`,
        severity: 65,
      });
    }
  }

  const weekStart = weekStartMonday(today);
  const week = store.weeks?.find((w) => w.weekStart === weekStart);
  const openObjectives = (week?.objectives ?? []).filter((o) => !o.done);
  if (openObjectives.length > 3) {
    gaps.push({
      id: "week-obj",
      title: "Цели недели",
      reason: `${openObjectives.length} без прогресса — разбей на сегодня`,
      href: "/analytics",
      severity: 60,
    });
  }

  gaps.sort((a, b) => b.severity - a.severity);

  const goals: BriefingGoal[] = store.goals
    .filter(
      (g) =>
        g.active &&
        !g.archived &&
        effectiveHorizonStage(g) <= currentHorizonStage(store, today)
    )
    .map((g) => {
      const wp = g.workPlanId ? findWorkPlan(store, g.workPlanId) : undefined;
      const phase = wp ? currentWorkPhase(wp) : currentPhase(g);
      return {
        id: g.id,
        title: g.title,
        progress: wp ? calcWorkPlanProgress(wp) : calcGoalProgress(g, store),
        phaseTitle: phase?.title,
        bucket: bucketForHorizonStage(
          effectiveHorizonStage(g),
          currentHorizonStage(store, today)
        ),
        deadline: g.deadline,
        minutesWeek: sumMinutesForGoal(store, g.id, weekFrom, today),
        hasPlan: Boolean(wp),
        workPlanId: wp?.id,
      };
    })
    .sort((a, b) => {
      const pa = a.progress;
      const pb = b.progress;
      if (pa !== pb) return pa - pb;
      return a.title.localeCompare(b.title, "ru");
    })
    .slice(0, 4);

  let headline: string;
  if (timer) {
    headline = `В фокусе · ${formatMinutes(elapsedMinutesSince(timer.startedAt))}`;
  } else if (mustOpen.length > 0) {
    headline = `${mustOpen.length} главных · ${done}/${rawTasks.length} за день`;
  } else if (open.length > 0) {
    headline = `${open.length} осталось · ${done}/${rawTasks.length} за день`;
  } else if (rawTasks.length > 0) {
    headline = "День закрыт";
  } else {
    headline = "Свободный день";
  }

  const plan = store.plans?.find((p) => p.status === "active");
  const subline = plan?.title ?? "6 месяцев · три фазы";

  return {
    date: today,
    greeting: greetingForHour(now.getHours()),
    headline,
    subline,
    primary,
    todayStats: {
      done,
      total: rawTasks.length,
      mustOpen: mustOpen.length,
      loadPercent: load.percent,
      focusFormatted: formatMinutes(focusMinutes),
      focusPercent,
    },
    gaps: gaps.slice(0, 4),
    goals,
    planTitle: plan?.title,
  };
}
