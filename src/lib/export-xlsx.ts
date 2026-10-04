/**
 * Excel export: Year → Months → interactive Calendar (Apple Storage palette),
 * plus flat Excel Tables for Power BI joined by ID columns.
 */
import ExcelJS from "exceljs";
import { resolveGoalSide, SIDE_HINT, SIDE_LABEL } from "./layers";
import { calcWorkPlanProgress, findWorkPlan, phaseModules, phasesOf } from "./lifeos";
import { buildAnalytics, planRealityForGoal } from "./plan-reality";
import type { DailyTaskItem, Goal, LifeLayer, LifeStore, Review } from "./types";

const P = {
  bg: "FFF5F5F7",
  card: "FFFFFFFF",
  ink: "FF1D1D1F",
  ink2: "FF6E6E73",
  ink3: "FF86868B",
  blue: "FF007AFF",
  orange: "FFFF9500",
  green: "FF34C759",
  red: "FFFF3B30",
  cyan: "FF5AC8FA",
  gray: "FF8E8E93",
  empty: "FFEDEDF0",
  sep: "FFE5E5EA",
  sep2: "FFD1D1D6",
  white: "FFFFFFFF",
};

const HEAT = ["FFE8F8EC", "FFC9F0D3", "FF8EDFA5", "FF4CD07A", "FF34C759"] as const;
const FONT = "Helvetica Neue";
const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const WEEKDAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const WD_MON = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const STATUS_RU: Record<string, string> = {
  ahead: "Опережает",
  on_track: "В графике",
  behind: "Отстаёт",
  no_plan: "Без плана",
};
const PRIORITY_RU: Record<string, string> = {
  critical: "Критичный",
  high: "Высокий",
  medium: "Средний",
  low: "Низкий",
  must: "Обязательно",
  should: "Желательно",
  optional: "По желанию",
};
const FOCUS_RU: Record<string, string> = {
  main: "Главное",
  support: "Поддержка",
  background: "Фон",
};
const SIDE_COLOR: Record<LifeLayer, string> = { inner: P.blue, outer: P.orange };
const SIDE_EN: Record<LifeLayer, string> = { inner: "INSIDE", outer: "OUTSIDE" };

type SideOrNone = LifeLayer | null;
type Col = { header: string; key: string; width: number; fmt?: string; bar?: boolean };
type TextOpts = {
  size?: number;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  fill?: string;
  align?: "left" | "center" | "right";
  valign?: "top" | "middle" | "bottom";
  wrap?: boolean;
  indent?: number;
  fmt?: string;
};

function toDate(iso?: string | null): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function humanDate(iso: string) {
  const d = toDate(iso);
  if (!d) return iso;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].toLowerCase().slice(0, 3)}`;
}

function pct(done: number, planned: number) {
  return planned ? done / planned : 0;
}

function heatColor(p: number | null): string {
  if (p == null || Number.isNaN(p)) return P.card;
  if (p >= 1) return HEAT[4];
  if (p >= 0.75) return HEAT[3];
  if (p >= 0.5) return HEAT[2];
  if (p >= 0.25) return HEAT[1];
  if (p > 0) return HEAT[0];
  return P.empty;
}

function taskSource(t: DailyTaskItem) {
  if (t.habitId) return "Привычка";
  if (t.goalId) return "Цель";
  if (t.projectId) return "Проект";
  return "Личное";
}

function paint(ws: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number, argb: string) {
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
    }
  }
}

function put(
  ws: ExcelJS.Worksheet,
  r: number,
  c1: number,
  c2: number,
  value: ExcelJS.CellValue,
  o: TextOpts = {}
) {
  if (c2 > c1) ws.mergeCells(r, c1, r, c2);
  const cell = ws.getCell(r, c1);
  cell.value = value;
  cell.font = {
    name: FONT,
    size: o.size ?? 10.5,
    bold: o.bold,
    italic: o.italic,
    color: { argb: o.color ?? P.ink },
  };
  cell.alignment = {
    horizontal: o.align ?? "left",
    vertical: o.valign ?? "middle",
    wrapText: o.wrap,
    indent: o.indent ?? (o.align === "center" || o.align === "right" ? 0 : 1),
  };
  if (o.fmt) cell.numFmt = o.fmt;
  if (o.fill) paint(ws, r, c1, r, c2, o.fill);
  return cell;
}

function card(ws: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number, fill: string | null = P.card) {
  if (fill) paint(ws, r1, c1, r2, c2, fill);
  const edge = { style: "thin" as const, color: { argb: P.sep } };
  for (let c = c1; c <= c2; c++) {
    ws.getCell(r1, c).border = { ...ws.getCell(r1, c).border, top: edge };
    ws.getCell(r2, c).border = { ...ws.getCell(r2, c).border, bottom: edge };
  }
  for (let r = r1; r <= r2; r++) {
    ws.getCell(r, c1).border = { ...ws.getCell(r, c1).border, left: edge };
    ws.getCell(r, c2).border = { ...ws.getCell(r, c2).border, right: edge };
  }
}

function storageBar(
  ws: ExcelJS.Worksheet,
  r: number,
  c1: number,
  width: number,
  segments: { value: number; color: string }[],
  height = 16
) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const raw = segments.map((s) => (total ? (s.value / total) * width : 0));
  const cells = raw.map(Math.floor);
  let left = width - cells.reduce((s, x) => s + x, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (left <= 0 || !total) break;
    if (segments[i].value > 0) {
      cells[i] += 1;
      left -= 1;
    }
  }
  let c = c1;
  segments.forEach((s, i) => {
    for (let k = 0; k < cells[i]; k++) {
      ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: s.color } };
      c++;
    }
  });
  for (; c < c1 + width; c++) {
    ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: P.empty } };
  }
  ws.getRow(r).height = height;
}

function legend(
  ws: ExcelJS.Worksheet,
  r: number,
  c1: number,
  items: { label: string; value: string; color: string }[],
  span: number
) {
  items.forEach((it, i) => {
    const c = c1 + i * span;
    put(ws, r, c, c + span - 1, {
      richText: [
        { text: "● ", font: { name: FONT, size: 11, color: { argb: it.color } } },
        { text: it.label + "  ", font: { name: FONT, size: 10, color: { argb: P.ink } } },
        { text: it.value, font: { name: FONT, size: 10, color: { argb: P.ink3 } } },
      ],
    });
  });
}

function progressRich(p: number, color: string, len = 10): ExcelJS.CellValue {
  const full = Math.round(Math.max(0, Math.min(1, p)) * len);
  return {
    richText: [
      { text: "■".repeat(full), font: { name: FONT, size: 9, color: { argb: color } } },
      { text: "■".repeat(Math.max(0, len - full)), font: { name: FONT, size: 9, color: { argb: P.empty } } },
      { text: `  ${Math.round(p * 100)}%`, font: { name: FONT, size: 10, color: { argb: P.ink2 } } },
    ],
  };
}

function finishBackground(ws: ExcelJS.Worksheet, lastRow: number, lastCol: number) {
  for (let r = 1; r <= lastRow; r++) {
    for (let c = 1; c <= lastCol; c++) {
      const cell = ws.getCell(r, c);
      if (!cell.fill || (cell.fill as ExcelJS.FillPattern).type !== "pattern") {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: P.bg } };
      }
    }
  }
}

function addTableSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  tableName: string,
  cols: Col[],
  rows: Record<string, unknown>[]
) {
  const ws = wb.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 1, showGridLines: false }],
    properties: { tabColor: { argb: P.gray } },
  });
  cols.forEach((c, i) => {
    ws.getColumn(i + 1).width = c.width;
  });
  const data = rows.length ? rows : [Object.fromEntries(cols.map((c) => [c.key, null]))];
  ws.addTable({
    name: tableName,
    ref: "A1",
    headerRow: true,
    style: { theme: "TableStyleLight1", showRowStripes: false },
    columns: cols.map((c) => ({ name: c.header, filterButton: true })),
    rows: data.map((r) => cols.map((c) => (r[c.key] ?? null) as ExcelJS.CellValue)),
  });
  const header = ws.getRow(1);
  header.height = 26;
  header.eachCell((cell) => {
    cell.font = { name: FONT, bold: true, color: { argb: P.ink }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: P.bg } };
    cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    cell.border = { bottom: { style: "thin", color: { argb: P.sep2 } } };
  });
  const last = data.length + 1;
  cols.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    for (let r = 2; r <= last; r++) {
      const cell = ws.getCell(r, i + 1);
      cell.font = { name: FONT, size: 10.5, color: { argb: P.ink } };
      cell.alignment = { vertical: "middle", indent: 1 };
      cell.border = { bottom: { style: "hair", color: { argb: P.sep } } };
      if (r % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: P.bg } };
      }
      if (c.fmt) cell.numFmt = c.fmt;
    }
    if (c.bar && rows.length) {
      const letter = col.letter;
      ws.addConditionalFormatting({
        ref: `${letter}2:${letter}${last}`,
        rules: [
          {
            type: "dataBar",
            priority: 1,
            cfvo: [
              { type: "num", value: 0 },
              { type: "num", value: 1 },
            ],
            color: { argb: P.green },
            gradient: true,
          } as unknown as ExcelJS.ConditionalFormattingRule,
        ],
      });
    }
  });
  for (let r = 2; r <= last; r++) ws.getRow(r).height = 20;
  return ws;
}

type GoalInfo = {
  goal: Goal;
  side: SideOrNone;
  progress: number;
  achieved: boolean;
  achievedAt: string | null;
};

type SkillInfo = {
  title: string;
  side: SideOrNone;
  goalTitle: string;
  date: string | null;
  month: number | null;
};

type HabitInfo = {
  id: string;
  title: string;
  side: LifeLayer;
  rate30: number;
  rateYear: number;
  hitsYear: number;
  streak: number;
  status: string;
};

type MonthInfo = {
  month: number;
  key: string;
  planned: number;
  done: number;
  split: { inner: number; outer: number; none: number; open: number };
  sidePlanned: { inner: number; outer: number };
  achieved: GoalInfo[];
  skills: SkillInfo[];
  habits: { title: string; side: LifeLayer; rate: number }[];
  bestDay: { date: string; p: number } | null;
  weakWeekday: string | null;
  review: Review | null;
};

export async function buildExportWorkbook(store: LifeStore, asOf: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "2MindOS";
  wb.created = new Date();
  wb.title = "2MindOS — сводка года";

  const analytics = buildAnalytics(store, asOf);
  const year = Number(asOf.slice(0, 4));
  const yearStart = `${year}-01-01`;
  const curMonth = Number(asOf.slice(5, 7));
  const spheres = store.spheres ?? [];
  const sphereName = (id?: string) => spheres.find((s) => s.id === id)?.name ?? "";
  const focusLevels =
    (store.periodFocus ?? []).find((p) => p.monthKey === asOf.slice(0, 7))?.levels ?? {};
  const goalById = new Map(store.goals.map((g) => [g.id, g]));
  const forecastById = new Map((analytics.forecast ?? []).map((f) => [f.id, f]));
  const since30 = addDays(asOf, -30);

  const sphereSide = (id?: string): SideOrNone => {
    const s = spheres.find((x) => x.id === id);
    if (s?.layerBias === "inner" || s?.layerBias === "outer") return s.layerBias;
    return null;
  };

  const sideOfTask = (t: DailyTaskItem): SideOrNone => {
    const g = t.goalId ? goalById.get(t.goalId) : undefined;
    if (g) return resolveGoalSide(g, spheres);
    const fromDir = sphereSide(t.lifeAreaId);
    if (fromDir) return fromDir;
    if (t.habitId) {
      const h = store.habits.find((x) => x.id === t.habitId);
      if (h?.layer) return h.layer;
      return sphereSide(h?.lifeAreaId) ?? "inner";
    }
    return null;
  };

  const tasks = (store.dayTasks ?? []).filter((t) => !t.archived && t.date >= yearStart && t.date <= asOf);
  const habitLogs = (store.habitLogs ?? []).filter((l) => l.value > 0);

  const goalsInfo: GoalInfo[] = store.goals
    .filter((g) => !g.archived || g.status === "done")
    .map((g) => {
      const plan = g.workPlanId ? findWorkPlan(store, g.workPlanId) : undefined;
      const progress = plan ? calcWorkPlanProgress(plan) / 100 : (g.progress ?? 0) / 100;
      const achieved = g.status === "done" || progress >= 1;
      let achievedAt: string | null = null;
      if (achieved && plan) {
        const ends = phasesOf(plan)
          .filter((ph) => ph.status === "done" || phaseModules(ph).every((m) => m.done))
          .map((ph) => ph.deadlineEnd)
          .filter(Boolean) as string[];
        achievedAt = ends.sort().at(-1) ?? g.deadline ?? asOf;
      } else if (achieved) {
        achievedAt = g.deadline ?? asOf;
      }
      return {
        goal: g,
        side: resolveGoalSide(g, spheres),
        progress,
        achieved,
        achievedAt: achievedAt && achievedAt.slice(0, 10) <= asOf ? achievedAt.slice(0, 10) : achieved ? asOf : null,
      };
    });

  const skills: SkillInfo[] = [];
  for (const gi of goalsInfo) {
    const plan = gi.goal.workPlanId ? findWorkPlan(store, gi.goal.workPlanId) : undefined;
    if (!plan) continue;
    for (const ph of phasesOf(plan)) {
      const mods = phaseModules(ph);
      const done = ph.status === "done" || (mods.length > 0 && mods.every((m) => m.done));
      if (!done) continue;
      const date = (ph.deadlineEnd ?? asOf).slice(0, 10);
      if (date > asOf || date < yearStart) continue;
      skills.push({
        title: ph.title,
        side: gi.side,
        goalTitle: gi.goal.title,
        date,
        month: Number(date.slice(5, 7)),
      });
    }
  }

  const habitsInfo: HabitInfo[] = (store.habits ?? [])
    .filter((h) => !h.archived)
    .map((h) => {
      const days = new Set(habitLogs.filter((l) => l.habitId === h.id).map((l) => l.date));
      const yearDays = [...days].filter((d) => d >= yearStart && d <= asOf).sort();
      const first = yearDays[0] ?? asOf;
      const span = Math.max(1, (toDate(asOf)!.getTime() - toDate(first)!.getTime()) / 86400000 + 1);
      const hit30 = [...days].filter((d) => d >= since30 && d <= asOf).length;
      let streak = 0;
      let cursor = days.has(asOf) ? asOf : addDays(asOf, -1);
      while (days.has(cursor)) {
        streak += 1;
        cursor = addDays(cursor, -1);
      }
      const rate30 = hit30 / 30;
      return {
        id: h.id,
        title: h.title,
        side: h.layer ?? sphereSide(h.lifeAreaId) ?? "inner",
        rate30,
        rateYear: yearDays.length / span,
        hitsYear: yearDays.length,
        streak,
        status: rate30 >= 0.7 ? "Сформирована" : rate30 >= 0.4 ? "Формируется" : "Не держится",
      };
    });

  const byDate = new Map<string, DailyTaskItem[]>();
  for (const t of tasks) {
    const list = byDate.get(t.date) ?? [];
    list.push(t);
    byDate.set(t.date, list);
  }

  const months: MonthInfo[] = [];
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, "0")}`;
    const mStart = `${key}-01`;
    const mEnd = m < 12 ? `${year}-${String(m + 1).padStart(2, "0")}-01` : `${year + 1}-01-01`;
    const mTasks = tasks.filter((t) => t.date >= mStart && t.date < mEnd);
    const doneList = mTasks.filter((t) => t.done);
    const split = { inner: 0, outer: 0, none: 0, open: 0 };
    const sidePlanned = { inner: 0, outer: 0 };
    for (const t of mTasks) {
      const side = sideOfTask(t);
      if (side === "inner") sidePlanned.inner += 1;
      else if (side === "outer") sidePlanned.outer += 1;
      if (!t.done) {
        split.open += 1;
        continue;
      }
      if (side === "inner") split.inner += 1;
      else if (side === "outer") split.outer += 1;
      else split.none += 1;
    }

    const dayStats: { date: string; p: number; wd: number }[] = [];
    for (let d = mStart; d < mEnd && d <= asOf; d = addDays(d, 1)) {
      const list = byDate.get(d) ?? [];
      if (!list.length) continue;
      const p = pct(list.filter((t) => t.done).length, list.length);
      dayStats.push({ date: d, p, wd: toDate(d)!.getUTCDay() });
    }
    const bestDay = dayStats.length
      ? dayStats.reduce((a, b) => (b.p > a.p ? b : a))
      : null;
    const wdAvg = new Map<number, { sum: number; n: number }>();
    for (const ds of dayStats) {
      const cur = wdAvg.get(ds.wd) ?? { sum: 0, n: 0 };
      cur.sum += ds.p;
      cur.n += 1;
      wdAvg.set(ds.wd, cur);
    }
    let weakWeekday: string | null = null;
    let weakAvg = 2;
    for (const [wd, v] of wdAvg) {
      const avg = v.sum / v.n;
      if (avg < weakAvg) {
        weakAvg = avg;
        weakWeekday = WEEKDAYS[wd];
      }
    }

    const habitRates = habitsInfo.map((h) => {
      const hits = habitLogs.filter(
        (l) => l.habitId === h.id && l.date >= mStart && l.date < mEnd && l.date <= asOf
      ).length;
      const daysInMonth = Math.max(
        1,
        Math.min(
          (toDate(m < 12 ? `${key}-${String(new Date(Date.UTC(year, m, 0)).getUTCDate()).padStart(2, "0")}` : `${year}-12-31`)!.getTime() -
            toDate(mStart)!.getTime()) /
            86400000 +
            1,
          (toDate(asOf)!.getTime() - toDate(mStart)!.getTime()) / 86400000 + 1
        )
      );
      return { title: h.title, side: h.side, rate: hits / daysInMonth };
    });

    months.push({
      month: m,
      key,
      planned: mTasks.length,
      done: doneList.length,
      split,
      sidePlanned,
      achieved: goalsInfo.filter(
        (g) => g.achieved && g.achievedAt && g.achievedAt >= mStart && g.achievedAt < mEnd
      ),
      skills: skills.filter((s) => s.month === m),
      habits: habitRates.filter((h) => h.rate > 0).sort((a, b) => b.rate - a.rate),
      bestDay: bestDay ? { date: bestDay.date, p: bestDay.p } : null,
      weakWeekday,
      review: (store.reviews ?? []).find((r) => r.cadence === "month" && r.periodKey === key) ?? null,
    });
  }

  const yearDone = tasks.filter((t) => t.done).length;
  const yearPlanned = tasks.length;
  const yearSplit = { inner: 0, outer: 0, none: 0, open: 0 };
  for (const t of tasks) {
    if (!t.done) {
      yearSplit.open += 1;
      continue;
    }
    const s = sideOfTask(t);
    if (s === "inner") yearSplit.inner += 1;
    else if (s === "outer") yearSplit.outer += 1;
    else yearSplit.none += 1;
  }
  const achievedYear = goalsInfo.filter((g) => g.achieved && g.achievedAt && g.achievedAt >= yearStart && g.achievedAt <= asOf);
  const activeGoals = goalsInfo.filter((g) => !g.achieved && g.goal.active && !g.goal.archived);
  const formedHabits = habitsInfo.filter((h) => h.status === "Сформирована");
  const bestMonth = [...months]
    .filter((m) => m.month <= curMonth && m.planned > 0)
    .sort((a, b) => pct(b.done, b.planned) - pct(a.done, a.planned))[0];

  let bestStreak = 0;
  let run = 0;
  for (let d = yearStart; d <= asOf; d = addDays(d, 1)) {
    const list = byDate.get(d) ?? [];
    if (list.length && list.every((t) => t.done)) {
      run += 1;
      bestStreak = Math.max(bestStreak, run);
    } else if (list.length) {
      run = 0;
    }
  }

  // Compact-but-roomy grid: fits a laptop width, text wraps instead of clipping.
  const COLS = 42;
  const C0 = 2;
  const CL = C0 + COLS - 1;
  const COL_W = 3.8;

  // ======================= Sheet 1: ГОД =======================
  const ys = wb.addWorksheet("Год", {
    views: [{ showGridLines: false, zoomScale: 100 }],
    properties: { tabColor: { argb: P.blue } },
  });
  ys.getColumn(1).width = 2.4;
  for (let c = C0; c <= CL; c++) ys.getColumn(c).width = COL_W;
  ys.getColumn(CL + 1).width = 2.4;

  put(ys, 2, C0, C0 + 10, String(year), { size: 36, bold: true });
  put(ys, 2, C0 + 11, CL, `Год в цифрах · на ${humanDate(asOf)} · Inside / Outside`, {
    size: 12, color: P.ink2, valign: "bottom",
  });
  ys.getRow(2).height = 44;

  const kpi = (
    r: number,
    c1: number,
    c2: number,
    label: string,
    value: ExcelJS.CellValue,
    hint: string,
    color: string,
    fmt?: string
  ) => {
    paint(ys, r, c1, r + 3, c2, P.card);
    card(ys, r, c1, r + 3, c2, null);
    put(ys, r, c1, c2, label.toUpperCase(), { size: 9, bold: true, color: P.ink3, fill: P.card, indent: 1 });
    put(ys, r + 1, c1, c2, value, { size: 22, bold: true, color, fill: P.card, fmt, indent: 1 });
    put(ys, r + 2, c1, c2, hint, { size: 9.5, color: P.ink2, fill: P.card, wrap: true, indent: 1 });
    ys.getRow(r).height = 18;
    ys.getRow(r + 1).height = 32;
    ys.getRow(r + 2).height = 22;
    ys.getRow(r + 3).height = 10;
  };

  const kpiW = 7;
  kpi(4, C0, C0 + kpiW - 1, "Задачи", yearPlanned ? yearDone / yearPlanned : 0, `${yearDone} из ${yearPlanned} закрыто`, P.ink, "0%");
  kpi(4, C0 + kpiW, C0 + kpiW * 2 - 1, "Цели достигнуты", achievedYear.length, `из ${goalsInfo.length} целей`, P.green);
  kpi(4, C0 + kpiW * 2, C0 + kpiW * 3 - 1, "Навыки обретены", skills.length, "закрытых этапов", P.blue);
  kpi(4, C0 + kpiW * 3, C0 + kpiW * 4 - 1, "Привычки", formedHabits.length, `сформировано из ${habitsInfo.length}`, P.cyan);
  kpi(
    4,
    C0 + kpiW * 4,
    C0 + kpiW * 5 - 1,
    "Лучший месяц",
    bestMonth ? MONTHS[bestMonth.month - 1] : "—",
    bestMonth ? `${Math.round(pct(bestMonth.done, bestMonth.planned) * 100)}% задач` : "",
    P.orange
  );
  kpi(4, C0 + kpiW * 5, C0 + kpiW * 6 - 1, "Серия", bestStreak, "дней подряд · рекорд", P.red);

  put(ys, 10, C0, CL, "Куда ушли силы", { size: 13, bold: true });
  paint(ys, 12, C0, 14, CL, P.card);
  card(ys, 12, C0, 15, CL, null);
  storageBar(ys, 13, C0 + 1, COLS - 2, [
    { value: yearSplit.inner, color: P.blue },
    { value: yearSplit.outer, color: P.orange },
    { value: yearSplit.none, color: P.gray },
    { value: yearSplit.open, color: P.empty },
  ], 18);
  paint(ys, 14, C0, 14, CL, P.card);
  legend(ys, 14, C0, [
    { label: "Inside", value: `${yearSplit.inner} · ${Math.round(pct(yearSplit.inner, yearPlanned) * 100)}%`, color: P.blue },
    { label: "Outside", value: `${yearSplit.outer} · ${Math.round(pct(yearSplit.outer, yearPlanned) * 100)}%`, color: P.orange },
    { label: "Без стороны", value: `${yearSplit.none}`, color: P.gray },
    { label: "Не сделано", value: `${yearSplit.open}`, color: P.sep2 },
  ], 10);
  paint(ys, 15, C0, 15, CL, P.card);
  ys.getRow(14).height = 22;

  put(ys, 17, C0, CL, "Месяцы · нажми процент → сводка", { size: 11, color: P.ink2 });
  paint(ys, 19, C0, 21, CL, P.card);
  card(ys, 19, C0, 21, CL, null);
  const monthStripW = 3;
  const monthStripPad = Math.max(0, Math.floor((COLS - 12 * monthStripW) / 2));
  months.forEach((m, i) => {
    const c1 = C0 + monthStripPad + i * monthStripW;
    const c2 = c1 + monthStripW - 1;
    const future = m.month > curMonth;
    const p = pct(m.done, m.planned);
    put(ys, 19, c1, c2, MONTHS[m.month - 1].slice(0, 3), {
      size: 9, color: P.ink3, align: "center", fill: P.card,
    });
    const fill = future ? P.empty : heatColor(m.planned ? p : null);
    put(ys, 20, c1, c2, future ? "—" : `${Math.round(p * 100)}%`, {
      size: 12, bold: true, align: "center", fill, color: p >= 1 ? P.white : P.ink,
    });
    paint(ys, 21, c1, 21, c2, future ? P.empty : heatColor(m.planned ? p : null));
  });
  ys.getRow(20).height = 26;

  // Two columns: INSIDE / OUTSIDE — equal width with a clear gutter.
  const leftC1 = C0;
  const leftC2 = C0 + 19;
  const rightC1 = C0 + 22;
  const rightC2 = CL;
  const sideStartRow = 23;

  const renderSide = (side: LifeLayer, c1: number, c2: number): number => {
    let r = sideStartRow;
    const color = SIDE_COLOR[side];
    paint(ys, r, c1, r + 3, c2, P.card);
    put(ys, r, c1, c2, SIDE_EN[side], { size: 16, bold: true, color, fill: P.card, indent: 1 });
    put(ys, r + 1, c1, c2, `${SIDE_LABEL[side]} · ${SIDE_HINT[side]}`, {
      size: 9.5, color: P.ink2, fill: P.card, wrap: true, indent: 1,
    });
    ys.getRow(r + 1).height = 32;
    const sideTasks = tasks.filter((t) => sideOfTask(t) === side);
    const sideDone = sideTasks.filter((t) => t.done).length;
    put(ys, r + 2, c1, c2, `Задачи стороны: ${sideDone} из ${sideTasks.length}`, {
      size: 10.5, color: P.ink2, fill: P.card, indent: 1,
    });
    r += 3;
    paint(ys, r, c1, r, c2, P.card);
    storageBar(ys, r, c1 + 1, c2 - c1 - 1, [
      { value: sideDone, color },
      { value: Math.max(0, sideTasks.length - sideDone), color: P.empty },
    ], 12);
    r += 2;

    const block = (title: string, lines: ExcelJS.CellValue[]) => {
      put(ys, r, c1, c2, title, { size: 10, bold: true, color: P.ink3, fill: P.card, indent: 1 });
      r++;
      if (!lines.length) {
        put(ys, r, c1, c2, "—", { size: 10.5, color: P.ink3, fill: P.card, indent: 1 });
        r++;
      } else {
        for (const line of lines) {
          put(ys, r, c1, c2, line, { size: 10.5, fill: P.card, wrap: true, indent: 1 });
          const textLen =
            typeof line === "string"
              ? line.length
              : line && typeof line === "object" && "richText" in line
                ? line.richText.reduce((s, p) => s + p.text.length, 0)
                : 40;
          ys.getRow(r).height = Math.max(20, Math.ceil(textLen / 28) * 14 + 4);
          r++;
        }
      }
      r++;
    };

    const ach = achievedYear.filter((g) => g.side === side);
    block(
      `ДОСТИГНУТЫЕ ЦЕЛИ · ${ach.length}`,
      ach.map((g) => ({
        richText: [
          { text: "✓ ", font: { name: FONT, size: 11, color: { argb: P.green } } },
          { text: g.goal.title, font: { name: FONT, size: 10.5, color: { argb: P.ink } } },
          {
            text: g.achievedAt ? `  · ${humanDate(g.achievedAt)}` : "",
            font: { name: FONT, size: 9, color: { argb: P.ink3 } },
          },
        ],
      }))
    );

    const work = activeGoals.filter((g) => g.side === side).sort((a, b) => b.progress - a.progress);
    block(
      `ЦЕЛИ В РАБОТЕ · ${work.length}`,
      work.map((g) => ({
        richText: [
          { text: g.goal.title + "  ", font: { name: FONT, size: 10.5, color: { argb: P.ink } } },
          ...(progressRich(g.progress, color, 8) as { richText: ExcelJS.RichText[] }).richText,
        ],
      }))
    );

    const sk = skills.filter((s) => s.side === side);
    block(
      `ОБРЕТЁННЫЕ НАВЫКИ · ${sk.length}`,
      sk.map((s) => ({
        richText: [
          { text: s.title, font: { name: FONT, size: 10.5, color: { argb: P.ink } } },
          {
            text: s.date ? `  · ${humanDate(s.date)}` : "",
            font: { name: FONT, size: 9, color: { argb: P.ink3 } },
          },
        ],
      }))
    );

    const hb = habitsInfo.filter((h) => h.side === side);
    block(
      `ПРИВЫЧКИ · ${hb.length}`,
      hb.map((h) => {
        const stColor =
          h.status === "Сформирована" ? P.green : h.status === "Формируется" ? P.orange : P.red;
        return {
          richText: [
            { text: "● ", font: { name: FONT, size: 10, color: { argb: stColor } } },
            { text: h.title, font: { name: FONT, size: 10.5, color: { argb: P.ink } } },
            {
              text: `  ${h.status.toLowerCase()} · серия ${h.streak}`,
              font: { name: FONT, size: 9, color: { argb: P.ink3 } },
            },
          ],
        };
      })
    );

    const pr = (store.principles ?? []).filter((p) => !p.archived && p.layer === side);
    block(
      `ПРИНЦИПЫ · ${pr.length}`,
      pr.map((p) => p.title)
    );

    card(ys, sideStartRow, c1, r - 1, c2, null);
    return r;
  };

  const leftEnd = renderSide("inner", leftC1, leftC2);
  const rightEnd = renderSide("outer", rightC1, rightC2);
  const sideBottom = Math.max(leftEnd, rightEnd);
  // Pad the shorter column so both cards share one bottom edge.
  for (const [c1, c2, end] of [
    [leftC1, leftC2, leftEnd],
    [rightC1, rightC2, rightEnd],
  ] as const) {
    if (end < sideBottom) {
      paint(ys, end, c1, sideBottom - 1, c2, P.card);
      card(ys, sideStartRow, c1, sideBottom - 1, c2, null);
    }
  }

  let foot = sideBottom + 1;
  const profile = store.skills ?? [];
  if (profile.length) {
    put(ys, foot, C0, CL, "Навыки профиля", { size: 12, bold: true });
    foot++;
    put(
      ys,
      foot,
      C0,
      CL,
      profile.map((s) => `${s.name} · ур. ${s.level}`).join("   ·   "),
      { size: 10.5, color: P.ink2, wrap: true }
    );
    foot += 2;
  }
  put(
    ys,
    foot,
    C0,
    CL,
    "Power BI: Данные → Excel → таблицы tGoals, tTasks, tDays, tSkills, tStages, tHabits… Связи по столбцам ID.",
    { size: 9, color: P.ink3 }
  );
  finishBackground(ys, foot + 2, CL + 1);

  // ======================= Sheet 2: МЕСЯЦЫ =======================
  const ms = wb.addWorksheet("Месяцы", {
    views: [{ showGridLines: false, zoomScale: 100 }],
    properties: { tabColor: { argb: P.orange } },
  });
  ms.getColumn(1).width = 2.4;
  for (let c = C0; c <= CL; c++) ms.getColumn(c).width = COL_W;
  ms.getColumn(CL + 1).width = 2.4;

  put(ms, 2, C0, C0 + 14, `Месяцы ${year}`, { size: 28, bold: true });
  put(ms, 3, C0, C0 + 30, "Каждый месяц: куда ушли силы, что достигнуто, какие навыки и привычки.", {
    size: 11, color: P.ink2, wrap: true,
  });
  put(ms, 3, C0 + 31, CL, { text: "← к году", hyperlink: "#'Год'!B2" }, {
    size: 11, color: P.blue, align: "right",
  });
  ms.getRow(3).height = 22;

  const monthRowOf = new Map<number, number>();
  const calRowOf = new Map<number, number>();
  const CAL_GRID_TOP = 25;
  const CAL_BLOCK_H = 11;
  const CAL_MONTH_W = 14;
  for (let m = 1; m <= 12; m++) {
    const blockRow = Math.floor((m - 1) / 3);
    calRowOf.set(m, CAL_GRID_TOP + blockRow * CAL_BLOCK_H);
  }

  let mr = 5;
  for (const m of [...months].reverse()) {
    if (m.month > curMonth) continue;
    monthRowOf.set(m.month, mr);
    const top = mr;
    const p = pct(m.done, m.planned);
    const has = m.planned > 0;

    put(ms, mr, C0, C0 + 14, MONTHS[m.month - 1], { size: 18, bold: true, fill: P.card, indent: 1 });
    put(ms, mr, C0 + 15, C0 + 24, has ? `${m.done} / ${m.planned} задач` : "нет задач", {
      size: 11, color: P.ink2, fill: P.card, align: "right",
    });
    put(ms, mr, C0 + 25, C0 + 31, has ? p : "—", {
      size: 18, bold: true, fill: P.card, align: "right",
      color: !has ? P.ink3 : p >= 0.75 ? P.green : p >= 0.5 ? P.orange : P.red, fmt: "0%",
    });
    put(ms, mr, C0 + 32, CL, { text: "в календарь →", hyperlink: `#'Календарь'!B${calRowOf.get(m.month)}` }, {
      size: 10, color: P.blue, fill: P.card, align: "right",
    });
    ms.getRow(mr).height = 34;
    mr++;

    paint(ms, mr, C0, mr, CL, P.card);
    storageBar(ms, mr, C0 + 1, COLS - 2, [
      { value: m.split.inner, color: P.blue },
      { value: m.split.outer, color: P.orange },
      { value: m.split.none, color: P.gray },
      { value: m.split.open, color: P.empty },
    ], 16);
    mr++;
    paint(ms, mr, C0, mr, CL, P.card);
    legend(ms, mr, C0, [
      { label: "Inside", value: `${m.split.inner}/${m.sidePlanned.inner}`, color: P.blue },
      { label: "Outside", value: `${m.split.outer}/${m.sidePlanned.outer}`, color: P.orange },
      { label: "Без стороны", value: `${m.split.none}`, color: P.gray },
      { label: "Не сделано", value: `${m.split.open}`, color: P.sep2 },
    ], 10);
    for (let c = C0; c <= CL; c++) {
      ms.getCell(mr, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: P.card } };
    }
    ms.getRow(mr).height = 22;
    mr++;

    const line = (label: string, value: ExcelJS.CellValue) => {
      put(ms, mr, C0, C0 + 9, label, { size: 9, bold: true, color: P.ink3, fill: P.card, valign: "top", indent: 1 });
      put(ms, mr, C0 + 10, CL, value, { size: 10.5, fill: P.card, wrap: true, valign: "top", indent: 0 });
      const len =
        typeof value === "string"
          ? value.length
          : value && typeof value === "object" && "richText" in value
            ? value.richText.reduce((s, part) => s + part.text.length, 0)
            : 0;
      ms.getRow(mr).height = Math.max(24, Math.ceil(len / 48) * 16 + 8);
      mr++;
    };

    const bySide = (items: { side: SideOrNone; text: string }[]): ExcelJS.CellValue => {
      if (!items.length) return "—";
      const parts: ExcelJS.RichText[] = [];
      items.forEach((it, i) => {
        if (i) parts.push({ text: "   ", font: { name: FONT, size: 10.5 } });
        parts.push({
          text: "● ",
          font: { name: FONT, size: 10, color: { argb: it.side ? SIDE_COLOR[it.side] : P.gray } },
        });
        parts.push({ text: it.text, font: { name: FONT, size: 10.5, color: { argb: P.ink } } });
      });
      return { richText: parts };
    };

    line("ДОСТИГНУТО", bySide(m.achieved.map((g) => ({ side: g.side, text: g.goal.title }))));
    line("НАВЫКИ", bySide(m.skills.map((s) => ({ side: s.side, text: s.title }))));
    line(
      "ПРИВЫЧКИ",
      bySide(m.habits.map((h) => ({ side: h.side, text: `${h.title} ${Math.round(h.rate * 100)}%` })))
    );
    line(
      "ДНИ",
      [
        m.bestDay ? `лучший — ${humanDate(m.bestDay.date)} (${Math.round(m.bestDay.p * 100)}%)` : null,
        m.weakWeekday ? `слабый день недели — ${m.weakWeekday}` : null,
      ]
        .filter(Boolean)
        .join("  ·  ") || "—"
    );
    if (m.review) {
      line(
        "ИТОГ",
        [
          m.review.worked ? `Получилось: ${m.review.worked}` : null,
          m.review.failed ? `Не получилось: ${m.review.failed}` : null,
          m.review.nextChange ? `Меняю: ${m.review.nextChange}` : null,
        ]
          .filter(Boolean)
          .join("   ·   ")
      );
    }
    card(ms, top, C0, mr - 1, CL, null);
    mr += 1;
  }
  finishBackground(ms, mr + 1, CL + 1);

  months.forEach((m, i) => {
    const target = monthRowOf.get(m.month);
    const cell = ys.getCell(20, C0 + monthStripPad + i * monthStripW);
    if (target && typeof cell.value === "string" && cell.value !== "—") {
      cell.value = { text: cell.value, hyperlink: `#'Месяцы'!B${target}` };
      cell.font = { name: FONT, size: 12, bold: true, color: { argb: pct(m.done, m.planned) >= 1 ? P.white : P.ink } };
    }
  });

  // Placeholder so Календарь stays 3rd in the tab order; filled after Дни.
  const cs = wb.addWorksheet("Календарь", {
    views: [{ showGridLines: false }],
    properties: { tabColor: { argb: P.green } },
  });
  cs.getColumn(1).width = 2.4;
  for (let c = C0; c <= CL; c++) cs.getColumn(c).width = COL_W;
  cs.getColumn(CL + 1).width = 2.4;
  cs.views = [{ showGridLines: false, zoomScale: 100 }];

  // ======================= DATA SHEETS (before Calendar formulas) =======================
  // Tasks / Days column order is fixed — Calendar formulas depend on it.

  addTableSheet(
    wb,
    "Цели",
    "tGoals",
    [
      { header: "ID", key: "id", width: 14 },
      { header: "Цель", key: "title", width: 36 },
      { header: "Сторона", key: "side", width: 14 },
      { header: "DirectionID", key: "dirId", width: 14 },
      { header: "Направление", key: "dir", width: 24 },
      { header: "Фокус месяца", key: "focus", width: 14 },
      { header: "Статус", key: "status", width: 14 },
      { header: "Достигнута", key: "achieved", width: 12 },
      { header: "Дата достижения", key: "achievedAt", width: 15, fmt: "dd.mm.yyyy" },
      { header: "Прогресс", key: "progress", width: 12, fmt: "0%", bar: true },
      { header: "План по дате", key: "expected", width: 13, fmt: "0%" },
      { header: "Отклонение", key: "delta", width: 12, fmt: "+0%;-0%;0%" },
      { header: "Создана", key: "created", width: 13, fmt: "dd.mm.yyyy" },
      { header: "Дедлайн", key: "deadline", width: 13, fmt: "dd.mm.yyyy" },
      { header: "Дней до дедлайна", key: "daysLeft", width: 16, fmt: "0" },
      { header: "Финиш (прогноз)", key: "eta", width: 15, fmt: "dd.mm.yyyy" },
      { header: "Опоздание, дн", key: "late", width: 14, fmt: "0" },
      { header: "Есть план", key: "hasPlan", width: 11 },
      { header: "Активна", key: "active", width: 10 },
    ],
    store.goals.map((g) => {
      const reality = planRealityForGoal(store, g, asOf);
      const plan = g.workPlanId ? findWorkPlan(store, g.workPlanId) : undefined;
      const f = forecastById.get(g.id);
      const gi = goalsInfo.find((x) => x.goal.id === g.id);
      return {
        id: g.id,
        title: g.title,
        side: gi?.side ? SIDE_LABEL[gi.side] : "Не задано",
        dirId: g.lifeAreaId ?? "",
        dir: sphereName(g.lifeAreaId),
        focus: g.lifeAreaId ? FOCUS_RU[focusLevels[g.lifeAreaId] ?? "background"] : "",
        status: g.archived ? "Закрыта" : STATUS_RU[reality.status],
        achieved: gi?.achieved ? "Да" : "Нет",
        achievedAt: toDate(gi?.achievedAt),
        progress: reality.actual / 100,
        expected: reality.expected == null ? null : reality.expected / 100,
        delta: reality.delta == null ? null : reality.delta / 100,
        created: toDate(g.createdAt),
        deadline: toDate(g.deadline ?? plan?.deadline),
        daysLeft: reality.daysLeft,
        eta: toDate(f?.eta),
        late: f?.lateDays ?? null,
        hasPlan: plan ? "Да" : "Нет",
        active: g.active && !g.archived ? "Да" : "Нет",
      };
    })
  );

  const allTasks = (store.dayTasks ?? []).filter((t) => !t.archived);
  const taskRows = allTasks
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => {
      const g = t.goalId ? goalById.get(t.goalId) : undefined;
      const dirId = t.lifeAreaId ?? g?.lifeAreaId ?? "";
      const d = toDate(t.date);
      const side = sideOfTask(t);
      return {
        id: t.id,
        date: d,
        year: Number(t.date.slice(0, 4)),
        month: MONTHS[Number(t.date.slice(5, 7)) - 1],
        wd: d ? WEEKDAYS[d.getUTCDay()] : "",
        title: t.title,
        done: t.done ? "Да" : "Нет",
        doneNum: t.done ? 1 : 0,
        source: taskSource(t),
        side: side ? SIDE_LABEL[side] : "Не задано",
        goalId: t.goalId ?? "",
        goal: g?.title ?? t.goalTitle ?? "",
        dirId,
        dir: sphereName(dirId),
        priority: t.priority ? PRIORITY_RU[t.priority] ?? t.priority : "",
        minutes: t.actualMinutes ?? null,
        _iso: t.date,
        _side: side,
        _done: t.done,
      };
    });

  addTableSheet(
    wb,
    "Задачи",
    "tTasks",
    [
      { header: "ID", key: "id", width: 14 },
      { header: "Дата", key: "date", width: 13, fmt: "dd.mm.yyyy" },
      { header: "Год", key: "year", width: 8, fmt: "0" },
      { header: "Месяц", key: "month", width: 12 },
      { header: "День недели", key: "wd", width: 12 },
      { header: "Задача", key: "title", width: 42 },
      { header: "Выполнено", key: "done", width: 11 },
      { header: "Выполнено (1/0)", key: "doneNum", width: 15, fmt: "0" },
      { header: "Источник", key: "source", width: 12 },
      { header: "Сторона", key: "side", width: 14 },
      { header: "GoalID", key: "goalId", width: 14 },
      { header: "Цель", key: "goal", width: 30 },
      { header: "DirectionID", key: "dirId", width: 14 },
      { header: "Направление", key: "dir", width: 22 },
      { header: "Приоритет", key: "priority", width: 11 },
      { header: "Минут факт", key: "minutes", width: 12, fmt: "0" },
    ],
    taskRows
  );

  const firstTask = allTasks.reduce<string | null>(
    (min, t) => (!min || t.date < min ? t.date : min),
    null
  );
  let dayStart = firstTask && firstTask < yearStart ? firstTask : yearStart;
  if ((toDate(asOf)!.getTime() - toDate(dayStart)!.getTime()) / 86400000 > 900) {
    dayStart = addDays(asOf, -900);
  }
  const dayEnd = `${year}-12-31`;
  const allByDate = new Map<string, DailyTaskItem[]>();
  for (const t of allTasks) {
    const list = allByDate.get(t.date) ?? [];
    list.push(t);
    allByDate.set(t.date, list);
  }
  const habitByDate = new Map<string, number>();
  for (const l of habitLogs) habitByDate.set(l.date, (habitByDate.get(l.date) ?? 0) + 1);

  const dayRows: Record<string, unknown>[] = [];
  const dayIso: string[] = [];
  for (let d = dayStart; d <= dayEnd; d = addDays(d, 1)) {
    const list = allByDate.get(d) ?? [];
    const inner = list.filter((t) => sideOfTask(t) === "inner");
    const outer = list.filter((t) => sideOfTask(t) === "outer");
    const done = list.filter((t) => t.done).length;
    const date = toDate(d)!;
    dayIso.push(d);
    dayRows.push({
      date,
      year: Number(d.slice(0, 4)),
      monthNum: Number(d.slice(5, 7)),
      month: MONTHS[Number(d.slice(5, 7)) - 1],
      wd: WEEKDAYS[date.getUTCDay()],
      future: d > asOf ? "Да" : "Нет",
      planned: list.length,
      done,
      pct: list.length ? done / list.length : null,
      innerDone: inner.filter((t) => t.done).length,
      innerPlanned: inner.length,
      outerDone: outer.filter((t) => t.done).length,
      outerPlanned: outer.length,
      habits: habitByDate.get(d) ?? 0,
    });
  }
  addTableSheet(
    wb,
    "Дни",
    "tDays",
    [
      { header: "Дата", key: "date", width: 13, fmt: "dd.mm.yyyy" },
      { header: "Год", key: "year", width: 8, fmt: "0" },
      { header: "Месяц №", key: "monthNum", width: 9, fmt: "0" },
      { header: "Месяц", key: "month", width: 12 },
      { header: "День недели", key: "wd", width: 12 },
      { header: "Будущее", key: "future", width: 10 },
      { header: "Задач", key: "planned", width: 9, fmt: "0" },
      { header: "Готово", key: "done", width: 9, fmt: "0" },
      { header: "% дня", key: "pct", width: 10, fmt: "0%", bar: true },
      { header: "Inside готово", key: "innerDone", width: 13, fmt: "0" },
      { header: "Inside задач", key: "innerPlanned", width: 12, fmt: "0" },
      { header: "Outside готово", key: "outerDone", width: 14, fmt: "0" },
      { header: "Outside задач", key: "outerPlanned", width: 13, fmt: "0" },
      { header: "Привычки", key: "habits", width: 12, fmt: "0" },
    ],
    dayRows
  );

  addTableSheet(
    wb,
    "Навыки",
    "tSkills",
    [
      { header: "Навык", key: "title", width: 36 },
      { header: "Сторона", key: "side", width: 14 },
      { header: "Цель", key: "goal", width: 32 },
      { header: "Дата", key: "date", width: 13, fmt: "dd.mm.yyyy" },
      { header: "Месяц", key: "month", width: 12 },
    ],
    skills.map((s) => ({
      title: s.title,
      side: s.side ? SIDE_LABEL[s.side] : "Не задано",
      goal: s.goalTitle,
      date: toDate(s.date),
      month: s.month ? MONTHS[s.month - 1] : "",
    }))
  );

  // ======================= Sheet 3: КАЛЕНДАРЬ =======================
  put(cs, 2, C0, C0 + 18, `Календарь ${year}`, { size: 28, bold: true });
  put(cs, 2, C0 + 19, CL, { text: "← к году", hyperlink: "#'Год'!B2" }, {
    size: 11, color: P.blue, align: "right", valign: "bottom",
  });

  const pickW = 11;
  const taskL = C0 + pickW + 1;
  put(cs, 4, C0, C0 + pickW, "ВЫБЕРИ ДЕНЬ", { size: 9, bold: true, color: P.ink3, indent: 1 });
  const dateCell = put(cs, 5, C0, C0 + pickW, toDate(asOf), {
    size: 16, bold: true, fill: P.card, fmt: "[$-419]d mmmm yyyy", indent: 1,
  });
  dateCell.border = {
    top: { style: "medium", color: { argb: P.blue } },
    bottom: { style: "medium", color: { argb: P.blue } },
    left: { style: "medium", color: { argb: P.blue } },
    right: { style: "medium", color: { argb: P.blue } },
  };
  cs.getRow(5).height = 34;
  const dayCount = Math.max(2, dayRows.length + 1);
  dateCell.dataValidation = {
    type: "list",
    allowBlank: false,
    formulae: [`'Дни'!$A$2:$A$${dayCount}`],
    showErrorMessage: true,
    errorTitle: "День",
    error: "Выбери дату из списка",
  };

  const metric = (r: number, label: string, formula: string, result: number | string, color = P.ink, fmt?: string) => {
    put(cs, r, C0, C0 + 5, label, { size: 10.5, color: P.ink2, fill: P.card, indent: 1 });
    // exceljs drops numeric 0 as formula result — keep a string cache for zeros.
    const cached = typeof result === "number" ? result : result;
    const cell = cs.getCell(r, C0 + 6);
    if (C0 + pickW > C0 + 6) cs.mergeCells(r, C0 + 6, r, C0 + pickW);
    cell.value = { formula, result: cached === 0 ? "0" : cached };
    cell.font = { name: FONT, size: 13, bold: true, color: { argb: color } };
    cell.alignment = { horizontal: "right", vertical: "middle" };
    if (fmt) cell.numFmt = fmt;
    paint(cs, r, C0 + 6, r, C0 + pickW, P.card);
    return cell;
  };

  const asOfDay = dayRows[dayIso.indexOf(asOf)] as {
    planned: number;
    done: number;
    pct: number | null;
    innerDone: number;
    innerPlanned: number;
    outerDone: number;
    outerPlanned: number;
    habits: number;
  } | undefined;

  paint(cs, 7, C0, 13, C0 + pickW, P.card);
  card(cs, 7, C0, 13, C0 + pickW, null);
  for (let r = 7; r <= 12; r++) cs.getRow(r).height = 20;
  metric(7, "Задач", `IFERROR(INDEX('Дни'!G:G,MATCH(B5,'Дни'!A:A,0)),0)`, asOfDay?.planned ?? 0);
  metric(8, "Выполнено", `IFERROR(INDEX('Дни'!H:H,MATCH(B5,'Дни'!A:A,0)),0)`, asOfDay?.done ?? 0, P.green);
  metric(9, "% дня", `IFERROR(INDEX('Дни'!I:I,MATCH(B5,'Дни'!A:A,0)),0)`, asOfDay?.pct ?? 0, P.ink, "0%");
  metric(
    10,
    "Inside",
    `IFERROR(INDEX('Дни'!J:J,MATCH(B5,'Дни'!A:A,0)),0)&" / "&IFERROR(INDEX('Дни'!K:K,MATCH(B5,'Дни'!A:A,0)),0)`,
    `${asOfDay?.innerDone ?? 0} / ${asOfDay?.innerPlanned ?? 0}`,
    P.blue
  );
  metric(
    11,
    "Outside",
    `IFERROR(INDEX('Дни'!L:L,MATCH(B5,'Дни'!A:A,0)),0)&" / "&IFERROR(INDEX('Дни'!M:M,MATCH(B5,'Дни'!A:A,0)),0)`,
    `${asOfDay?.outerDone ?? 0} / ${asOfDay?.outerPlanned ?? 0}`,
    P.orange
  );
  metric(12, "Привычки", `IFERROR(INDEX('Дни'!N:N,MATCH(B5,'Дни'!A:A,0)),0)`, asOfDay?.habits ?? 0, P.cyan);

  const todayTasks = (allByDate.get(asOf) ?? []).slice(0, 12);
  const taskRowsN = Math.max(todayTasks.length + 2, 8);
  put(cs, 4, taskL, CL - 1, "ЗАДАЧИ ДНЯ", { size: 11, bold: true, color: P.ink3, indent: 1 });
  paint(cs, 5, taskL, 5 + taskRowsN, CL - 1, P.card);
  card(cs, 5, taskL, 5 + taskRowsN, CL - 1, null);

  const taskLast = Math.max(2, taskRows.length + 1);
  const sideL = CL - 8;
  for (let k = 1; k <= taskRowsN; k++) {
    const r = 5 + k;
    const t = todayTasks[k - 1];
    const rowFormula = `IFERROR(AGGREGATE(15,6,ROW('Задачи'!$B$2:$B$${taskLast})/('Задачи'!$B$2:$B$${taskLast}=$B$5),${k}),"")`;
    cs.getRow(r).height = 18;
    const side = t ? sideOfTask(t) : null;
    const sideTag = side === "inner" ? "Inside" : side === "outer" ? "Outside" : "";

    put(cs, r, taskL, taskL, t ? (t.done ? "●" : "○") : "", {
      size: 11,
      fill: P.card,
      align: "center",
      color: t?.done ? P.green : P.ink3,
    });

    // Plain cached text first — formulas keep the day picker interactive in Excel.
    const titleCell = put(cs, r, taskL + 1, sideL - 1, t?.title ?? "", {
      size: 10.5, fill: P.card, indent: 1, color: t ? P.ink : P.ink3,
    });
    titleCell.value = {
      formula: `IFERROR(INDEX('Задачи'!$F:$F,${rowFormula}),"")`,
      result: t?.title ?? "",
    };
    titleCell.font = { name: FONT, size: 10.5, color: { argb: t ? P.ink : P.ink3 } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: P.card } };
    titleCell.alignment = { vertical: "middle", indent: 1 };

    const sideCell = put(cs, r, sideL, CL - 2, sideTag, {
      size: 9.5,
      fill: P.card,
      align: "right",
      color: side === "inner" ? P.blue : side === "outer" ? P.orange : P.ink3,
    });
    sideCell.value = {
      formula: `IFERROR(IF(INDEX('Задачи'!$J:$J,${rowFormula})="Внутреннее","Inside",IF(INDEX('Задачи'!$J:$J,${rowFormula})="Внешнее","Outside","")),"")`,
      result: sideTag,
    };
    sideCell.font = {
      name: FONT,
      size: 9.5,
      color: { argb: side === "inner" ? P.blue : side === "outer" ? P.orange : P.ink3 },
    };
    sideCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: P.card } };
    sideCell.alignment = { horizontal: "right", vertical: "middle" };
  }

  const legendRow = 5 + taskRowsN + 2;
  put(cs, legendRow, C0, C0 + 4, "Легенда", { size: 10, bold: true, color: P.ink3 });
  const legendItems = [
    { label: "нет", color: P.card },
    { label: "<25%", color: HEAT[0] },
    { label: "25–49%", color: HEAT[1] },
    { label: "50–74%", color: HEAT[2] },
    { label: "75–99%", color: HEAT[3] },
    { label: "100%", color: HEAT[4] },
  ];
  legendItems.forEach((it, i) => {
    const c1 = C0 + 5 + i * 6;
    paint(cs, legendRow, c1, legendRow, c1 + 1, it.color);
    put(cs, legendRow, c1 + 2, c1 + 5, it.label, { size: 9, color: P.ink2 });
  });
  cs.getRow(legendRow).height = 18;

  const dayPctMap = new Map<string, number | null>();
  for (let i = 0; i < dayIso.length; i++) {
    const row = dayRows[i] as { pct: number | null; planned: number };
    dayPctMap.set(dayIso[i], row.planned ? row.pct : null);
  }

  for (let m = 1; m <= 12; m++) {
    const blockRow = Math.floor((m - 1) / 3);
    const blockCol = (m - 1) % 3;
    const top = CAL_GRID_TOP + blockRow * CAL_BLOCK_H;
    const left = C0 + blockCol * CAL_MONTH_W;
    const right = left + CAL_MONTH_W - 2;
    const monthInfo = months[m - 1];
    const p = pct(monthInfo.done, monthInfo.planned);
    const titleTarget = monthRowOf.get(m);

    put(
      cs,
      top,
      left,
      left + 8,
      titleTarget
        ? { text: MONTHS[m - 1], hyperlink: `#'Месяцы'!B${titleTarget}` }
        : MONTHS[m - 1],
      { size: 11, bold: true, color: P.ink, indent: 1 }
    );
    put(cs, top, left + 9, right, m <= curMonth && monthInfo.planned ? `${Math.round(p * 100)}%` : "—", {
      size: 11, bold: true, align: "right",
      color: m > curMonth ? P.ink3 : p >= 0.7 ? P.green : p >= 0.5 ? P.orange : P.ink2,
    });
    cs.getRow(top).height = 20;

    WD_MON.forEach((wd, i) => {
      put(cs, top + 1, left + i * 2, left + i * 2 + 1, wd, {
        size: 8,
        color: i >= 5 ? P.red : P.ink3,
        align: "center",
      });
    });
    cs.getRow(top + 1).height = 15;

    const first = new Date(Date.UTC(year, m - 1, 1));
    const startPad = (first.getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(year, m, 0)).getUTCDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const idx = startPad + day - 1;
      const row = top + 2 + Math.floor(idx / 7);
      const col = left + (idx % 7) * 2;
      const iso = `${year}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const future = iso > asOf;
      const dp = dayPctMap.get(iso);
      const list = allByDate.get(iso) ?? [];
      const fill = future ? P.bg : list.length ? heatColor(dp ?? null) : P.card;
      const cell = put(cs, row, col, col + 1, day, {
        size: 9,
        align: "center",
        fill,
        color: future ? P.ink3 : dp != null && dp >= 1 ? P.white : P.ink,
      });
      cs.getRow(row).height = Math.max(cs.getRow(row).height || 0, 16);
      if (iso === asOf) {
        cell.border = {
          top: { style: "medium", color: { argb: P.blue } },
          bottom: { style: "medium", color: { argb: P.blue } },
          left: { style: "medium", color: { argb: P.blue } },
          right: { style: "medium", color: { argb: P.blue } },
        };
      }
      if (list.length) {
        const note = list
          .slice(0, 12)
          .map((t) => `${t.done ? "✓" : "○"} ${t.title}`)
          .join("\n");
        cell.note = note + (list.length > 12 ? `\n…ещё ${list.length - 12}` : "");
      }
    }
    card(cs, top, left, top + 8, right, null);
  }

  finishBackground(cs, CAL_GRID_TOP + 4 * CAL_BLOCK_H + 2, CL + 1);

  // ======================= Remaining data sheets =======================
  const stageRows: Record<string, unknown>[] = [];
  for (const g of store.goals.filter((x) => !x.archived)) {
    const plan = g.workPlanId ? findWorkPlan(store, g.workPlanId) : undefined;
    if (!plan) continue;
    for (const ph of phasesOf(plan)) {
      const mods = phaseModules(ph);
      stageRows.push({
        goalId: g.id,
        goal: g.title,
        side: resolveGoalSide(g, spheres) ? SIDE_LABEL[resolveGoalSide(g, spheres)!] : "Не задано",
        stage: ph.title,
        status: ph.status ?? "",
        progress: (ph.progress ?? 0) / 100,
        modsDone: mods.filter((m) => m.done).length,
        modsTotal: mods.length,
        start: toDate(ph.deadlineStart),
        end: toDate(ph.deadlineEnd),
      });
    }
  }
  addTableSheet(
    wb,
    "Этапы",
    "tStages",
    [
      { header: "GoalID", key: "goalId", width: 14 },
      { header: "Цель", key: "goal", width: 32 },
      { header: "Сторона", key: "side", width: 14 },
      { header: "Этап", key: "stage", width: 38 },
      { header: "Статус", key: "status", width: 11 },
      { header: "Прогресс", key: "progress", width: 12, fmt: "0%", bar: true },
      { header: "Модулей готово", key: "modsDone", width: 15, fmt: "0" },
      { header: "Модулей всего", key: "modsTotal", width: 14, fmt: "0" },
      { header: "Начало", key: "start", width: 13, fmt: "dd.mm.yyyy" },
      { header: "Конец", key: "end", width: 13, fmt: "dd.mm.yyyy" },
    ],
    stageRows
  );

  addTableSheet(
    wb,
    "Привычки",
    "tHabits",
    [
      { header: "ID", key: "id", width: 14 },
      { header: "Привычка", key: "title", width: 30 },
      { header: "Сторона", key: "side", width: 14 },
      { header: "Статус", key: "status", width: 14 },
      { header: "Активна", key: "active", width: 10 },
      { header: "Регулярность 30д", key: "rate", width: 16, fmt: "0%", bar: true },
      { header: "Регулярность год", key: "rateYear", width: 16, fmt: "0%", bar: true },
      { header: "Текущая серия", key: "streak", width: 14, fmt: "0" },
      { header: "Дней за год", key: "hitsYear", width: 12, fmt: "0" },
    ],
    habitsInfo.map((h) => ({
      id: h.id,
      title: h.title,
      side: SIDE_LABEL[h.side],
      status: h.status,
      active: "Да",
      rate: h.rate30,
      rateYear: h.rateYear,
      streak: h.streak,
      hitsYear: h.hitsYear,
    }))
  );

  addTableSheet(
    wb,
    "Логи привычек",
    "tHabitLogs",
    [
      { header: "HabitID", key: "habitId", width: 14 },
      { header: "Привычка", key: "title", width: 30 },
      { header: "Дата", key: "date", width: 13, fmt: "dd.mm.yyyy" },
      { header: "Значение", key: "value", width: 10, fmt: "0" },
    ],
    habitLogs
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((l) => ({
        habitId: l.habitId,
        title: store.habits.find((h) => h.id === l.habitId)?.title ?? "",
        date: toDate(l.date),
        value: l.value,
      }))
  );

  const focusById = new Map((analytics.focusVsReality ?? []).map((f) => [f.id, f]));
  addTableSheet(
    wb,
    "Направления",
    "tDirections",
    [
      { header: "ID", key: "id", width: 14 },
      { header: "Направление", key: "name", width: 26 },
      { header: "Сторона", key: "side", width: 14 },
      { header: "Фокус месяца", key: "focus", width: 14 },
      { header: "Активных целей", key: "goals", width: 15, fmt: "0" },
      { header: "Выполнено 30д", key: "done", width: 14, fmt: "0" },
      { header: "Доля работы 30д", key: "share", width: 16, fmt: "0%", bar: true },
    ],
    spheres
      .filter((s) => !s.archived)
      .map((s) => ({
        id: s.id,
        name: s.name,
        side: s.layerBias === "inner" || s.layerBias === "outer" ? SIDE_LABEL[s.layerBias] : "Обе",
        focus: FOCUS_RU[focusLevels[s.id] ?? "background"],
        goals: store.goals.filter((g) => g.active && !g.archived && g.lifeAreaId === s.id).length,
        done: focusById.get(s.id)?.done ?? 0,
        share: (focusById.get(s.id)?.share ?? 0) / 100,
      }))
  );

  addTableSheet(
    wb,
    "Принципы",
    "tPrinciples",
    [
      { header: "ID", key: "id", width: 14 },
      { header: "Принцип", key: "title", width: 40 },
      { header: "Сторона", key: "side", width: 14 },
      { header: "Описание", key: "body", width: 60 },
      { header: "Создан", key: "created", width: 13, fmt: "dd.mm.yyyy" },
    ],
    (store.principles ?? [])
      .filter((p) => !p.archived)
      .map((p) => ({
        id: p.id,
        title: p.title,
        side: SIDE_LABEL[p.layer],
        body: p.body ?? "",
        created: toDate(p.createdAt),
      }))
  );

  const fin = store.finance;
  if (fin) {
    const TX_RU: Record<string, string> = {
      income: "Доход",
      expense: "Расход",
      mandatory: "Обязательное",
      savings: "Накопления",
    };
    const money = `#,##0 "${fin.currency === "RUB" ? "₽" : fin.currency}"`;
    addTableSheet(
      wb,
      "Финансы",
      "tFinance",
      [
        { header: "Дата", key: "date", width: 13, fmt: "dd.mm.yyyy" },
        { header: "Месяц", key: "month", width: 12 },
        { header: "Тип", key: "type", width: 14 },
        { header: "Название", key: "title", width: 32 },
        { header: "Сумма", key: "amount", width: 14, fmt: money },
        { header: "Сумма со знаком", key: "signed", width: 16, fmt: money },
        { header: "Заметка", key: "note", width: 36 },
      ],
      (fin.transactions ?? [])
        .filter((t) => !t.archived)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((t) => ({
          date: toDate(t.date),
          month: MONTHS[Number(t.date.slice(5, 7)) - 1] ?? "",
          type: TX_RU[t.type] ?? t.type,
          title: t.title,
          amount: t.amount,
          signed: t.type === "income" ? t.amount : -t.amount,
          note: t.note ?? "",
        }))
    );
  }

  const CAD_RU: Record<string, string> = { day: "День", week: "Неделя", month: "Месяц" };
  addTableSheet(
    wb,
    "Итоги",
    "tReviews",
    [
      { header: "Период", key: "cadence", width: 10 },
      { header: "Ключ периода", key: "key", width: 14 },
      { header: "Получилось", key: "worked", width: 40 },
      { header: "Не получилось", key: "failed", width: 40 },
      { header: "Меняю", key: "next", width: 40 },
    ],
    (store.reviews ?? []).map((rv) => ({
      cadence: CAD_RU[rv.cadence] ?? rv.cadence,
      key: rv.periodKey,
      worked: rv.worked ?? "",
      failed: rv.failed ?? "",
      next: rv.nextChange ?? "",
    }))
  );

  return wb;
}
