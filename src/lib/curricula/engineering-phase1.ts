import { id } from "../id";
import type { PlanModule, PlanPhase, WorkPlan } from "../types";
import { createWorkPlan } from "../lifeos";

function topics(titles: string[]): PlanModule[] {
  return titles.map((title, i) => ({
    id: id(),
    title,
    done: false,
    order: i + 1,
  }));
}

function stage(
  title: string,
  order: number,
  moduleTitles: string[],
  range?: { start: string; end: string; weeks?: number }
): PlanPhase {
  const modules = topics(moduleTitles);
  if (range) {
    for (const m of modules) {
      m.deadlineStart = range.start;
      m.deadlineEnd = range.end;
    }
  }
  return {
    id: id(),
    title,
    order,
    status: order === 1 ? "active" : "planned",
    durationWeeks: range?.weeks,
    deadlineStart: range?.start,
    deadlineEnd: range?.end,
    objectives: [],
    modules,
    progress: 0,
  };
}

/** Engineering Programming — Phase 1 (from 22 Aug, 8 weeks). */
export function buildEngineeringPhase1Plan(owner: {
  ownerType: "goal" | "project";
  ownerId: string;
}): WorkPlan {
  const planStart = "2026-08-22";
  const planEnd = "2026-10-16";

  const weeks = [
    { n: 1, start: "2026-08-22", end: "2026-08-28", focus: "Computer Science + Linux" },
    { n: 2, start: "2026-08-29", end: "2026-09-04", focus: "Python fundamentals" },
    { n: 3, start: "2026-09-05", end: "2026-09-11", focus: "Python + OOP + Git" },
    { n: 4, start: "2026-09-12", end: "2026-09-18", focus: "Algorithms + Data Structures" },
    { n: 5, start: "2026-09-19", end: "2026-09-25", focus: "SQL + PostgreSQL" },
    { n: 6, start: "2026-09-26", end: "2026-10-02", focus: "Networking + HTTP + REST" },
    { n: 7, start: "2026-10-03", end: "2026-10-09", focus: "Backend fundamentals + первый API" },
    { n: 8, start: "2026-10-10", end: "2026-10-16", focus: "Большой проект + тестирование + GitHub" },
  ];

  const phases: PlanPhase[] = [
    stage(
      "Computer Science Fundamentals",
      1,
      [
        "Как работает компьютер",
        "CPU / RAM / storage",
        "Binary / hexadecimal",
        "Processes / threads",
        "Memory",
        "OS fundamentals",
        "Networking basics",
      ],
      { start: weeks[0].start, end: weeks[0].end, weeks: 1 }
    ),
    stage(
      "Linux",
      2,
      [
        "CLI",
        "Файловая система",
        "Permissions",
        "Processes",
        "Environment variables",
        "Pipes / redirects",
        "SSH",
        "Bash basics",
      ],
      { start: weeks[0].start, end: weeks[0].end, weeks: 1 }
    ),
    stage(
      "Git",
      3,
      [
        "Git fundamentals",
        "Branches",
        "Merge / rebase",
        "Conflicts",
        "GitHub",
        "Pull requests",
        "Conventional commits",
      ],
      { start: weeks[2].start, end: weeks[2].end, weeks: 1 }
    ),
    stage(
      "Programming Fundamentals",
      4,
      [
        "Python",
        "Variables / types",
        "Conditions",
        "Loops",
        "Functions",
        "Modules",
        "Exceptions",
        "OOP",
        "Typing",
        "Package management",
        "Virtual environments",
      ],
      { start: weeks[1].start, end: weeks[2].end, weeks: 2 }
    ),
    stage(
      "Data Structures & Algorithms",
      5,
      [
        "Big O",
        "Arrays / lists",
        "Hash tables",
        "Stacks / queues",
        "Linked lists",
        "Trees",
        "Recursion",
        "Sorting",
        "Searching",
        "Basic problem solving",
      ],
      { start: weeks[3].start, end: weeks[3].end, weeks: 1 }
    ),
    stage(
      "Databases",
      6,
      [
        "SQL",
        "PostgreSQL",
        "Tables / relations",
        "Primary & foreign keys",
        "JOIN",
        "Indexes",
        "Transactions",
        "Normalization",
        "Basic database design",
      ],
      { start: weeks[4].start, end: weeks[4].end, weeks: 1 }
    ),
    stage(
      "Networking",
      7,
      [
        "OSI / TCP-IP",
        "HTTP / HTTPS",
        "DNS",
        "TCP / UDP",
        "IP",
        "Ports",
        "REST",
        "JSON",
        "Client/server architecture",
      ],
      { start: weeks[5].start, end: weeks[5].end, weeks: 1 }
    ),
    stage(
      "Недели",
      8,
      weeks.map((w) => `Неделя ${w.n} · ${w.focus}`),
      { start: planStart, end: planEnd, weeks: 8 }
    ),
  ];

  // Attach per-week deadlines on the "Недели" stage modules
  const weekStage = phases[phases.length - 1];
  weekStage.modules = weeks.map((w, i) => ({
    id: id(),
    title: `Неделя ${w.n} · ${w.focus}`,
    done: false,
    order: i + 1,
    deadlineStart: w.start,
    deadlineEnd: w.end,
  }));

  return createWorkPlan({
    ownerType: owner.ownerType,
    ownerId: owner.ownerId,
    title: "Engineering Programming — Фаза 1",
    deadline: planEnd,
    phases,
  });
}

export const ENGINEERING_PHASE1_META = {
  label: "Engineering Programming — Фаза 1",
  window: "22 августа → 16 октября · 8 недель",
  start: "2026-08-22",
  end: "2026-10-16",
} as const;
