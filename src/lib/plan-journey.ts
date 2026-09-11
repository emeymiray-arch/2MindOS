import type { PlanModule, PlanPhase } from "./types";

export type JourneyModule = PlanModule & { id: string; title: string; order: number };
export type JourneyPhase = PlanPhase & {
  id: string;
  title: string;
  order: number;
  modules: JourneyModule[];
};

export function moduleProgress(modules: JourneyModule[]): number {
  if (!modules.length) return 0;
  const done = modules.filter((m) => m.done).length;
  return Math.round((done / modules.length) * 100);
}

export function phaseProgress(phase: JourneyPhase): number {
  const modules = [...(phase.modules ?? [])].sort((a, b) => a.order - b.order);
  if (!modules.length) return phase.progress ?? 0;
  let score = 0;
  for (const m of modules) {
    if (m.done) score += 1;
    else if (m.understanding === 2) score += 0.75;
    else if (m.understanding === 1) score += 0.4;
  }
  return Math.round((score / modules.length) * 100);
}

export function allModulesDone(phase: JourneyPhase): boolean {
  const modules = phase.modules ?? [];
  return modules.length > 0 && modules.every((m) => m.done);
}

export function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function formatDeadlineShort(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export function currentPhaseIndex(phases: JourneyPhase[], today = todayKey()): number {
  if (!phases.length) return 0;
  const sorted = [...phases].sort((a, b) => a.order - b.order);
  const active = sorted.findIndex((p) => p.status === "active");
  if (active >= 0) return active;
  const inRange = sorted.findIndex(
    (p) => p.deadlineStart && p.deadlineEnd && today >= p.deadlineStart && today <= p.deadlineEnd
  );
  if (inRange >= 0) return inRange;
  const incomplete = sorted.findIndex((p) => !allModulesDone(p));
  return incomplete >= 0 ? incomplete : sorted.length - 1;
}

export function findFocusModule(
  phases: JourneyPhase[],
  phaseIndex: number,
  today = todayKey()
): { phase: JourneyPhase; module: JourneyModule; phaseIndex: number } | null {
  const sorted = [...phases].sort((a, b) => a.order - b.order);
  const tryPhase = (idx: number) => {
    const phase = sorted[idx];
    if (!phase) return null;
    const modules = [...(phase.modules ?? [])].sort((a, b) => a.order - b.order);
    const open = modules.filter((m) => !m.done);
    if (!open.length) return null;
    const overdue = open.find((m) => m.deadlineEnd && m.deadlineEnd < today);
    if (overdue) return { phase, module: overdue, phaseIndex: idx };
    const inRange = open.find(
      (m) =>
        m.deadlineStart &&
        m.deadlineEnd &&
        today >= m.deadlineStart &&
        today <= m.deadlineEnd
    );
    if (inRange) return { phase, module: inRange, phaseIndex: idx };
    return { phase, module: open[0], phaseIndex: idx };
  };

  const primary = tryPhase(phaseIndex);
  if (primary) return primary;
  for (let i = 0; i < sorted.length; i++) {
    if (i === phaseIndex) continue;
    const hit = tryPhase(i);
    if (hit) return hit;
  }
  return null;
}

export type MonthGroup = { label: string; modules: JourneyModule[] };

/** Group modules like «М1 · …» into month buckets inside a phase. */
export function groupModulesByMonth(modules: JourneyModule[]): MonthGroup[] {
  const sorted = [...modules].sort((a, b) => a.order - b.order);
  const groups: MonthGroup[] = [];
  let current: MonthGroup | null = null;

  for (const m of sorted) {
    const match = m.title.match(/^М(\d+)\s·\s*/);
    if (match) {
      const label = `Месяц ${match[1]}`;
      if (!current || current.label !== label) {
        current = { label, modules: [] };
        groups.push(current);
      }
      current.modules.push(m);
    } else {
      if (!current || current.label !== "Шаги") {
        current = { label: "Шаги", modules: [] };
        groups.push(current);
      }
      current.modules.push(m);
    }
  }
  return groups.length ? groups : [{ label: "Шаги", modules: sorted }];
}

export function actShortTitle(title: string, index: number): string {
  const m = title.match(/Фаза\s*(\d+)/i);
  if (m) return `Акт ${m[1]}`;
  const month = title.match(/Месяц\s*(\d+)/i);
  if (month) return `М${month[1]}`;
  if (title.length <= 14) return title;
  return `Этап ${index + 1}`;
}

export function actSubtitle(phase: JourneyPhase): string {
  if (phase.deadlineStart && phase.deadlineEnd) {
    return `${formatDeadlineShort(phase.deadlineStart)} – ${formatDeadlineShort(phase.deadlineEnd)}`;
  }
  return `${phaseProgress(phase)}%`;
}
