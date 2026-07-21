export type StatusFlag = "active" | "archived";

export type NodeKind =
  | "thought"
  | "person"
  | "place"
  | "event"
  | "idea"
  | "project"
  | "book"
  | "quote"
  | "goal"
  | "habit"
  | "dream"
  | "skill"
  | "finance_tx"
  | "health_metric"
  | "task"
  | "document"
  | "memory_card"
  | "wish";

export type EdgeType =
  | "mentions"
  | "supports"
  | "blocks"
  | "part_of"
  | "leads_to"
  | "happened_at"
  | "owned_by"
  | "applies_to"
  | "contradicts"
  | "derived_from";

export type EdgeProvenance = "user" | "ai" | "rule";
export type WishBucket = "skill" | "plans" | "material";
export type ThemeMode = "light" | "dark";

export interface Sphere {
  id: string;
  slug: string;
  name: string;
  kpiLabel?: string;
  kpiValue?: string;
  order: number;
}

export interface LifeNode {
  id: string;
  kind: NodeKind;
  title: string;
  body?: string;
  sphereId?: string;
  metadata: Record<string, unknown>;
  salience: number;
  createdAt: string;
  updatedAt: string;
}

export interface LifeEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: EdgeType;
  weight: number;
  provenance: EdgeProvenance;
  confidence: number;
  createdAt: string;
}

export interface Capture {
  id: string;
  raw: string;
  status: "pending" | "processed" | "failed";
  nodeIds: string[];
  edgeIds: string[];
  createdAt: string;
}

export interface GoalStage {
  id: string;
  title: string;
  done: boolean;
  deadlineStart?: string;
  deadlineEnd?: string;
  order: number;
  archived?: boolean;
}

export interface Goal {
  id: string;
  nodeId: string;
  title: string;
  deadline?: string;
  stages: GoalStage[];
  notes?: string;
  progress: number;
  active: boolean;
  archived?: boolean;
  createdAt: string;
  /** @deprecated */
  module?: string;
  horizon?: "day" | "week" | "month" | "year";
}

export interface StageDayLog {
  id: string;
  stageId: string;
  date: string;
  done: boolean;
}

export interface Habit {
  id: string;
  nodeId: string;
  title: string;
  targetPerDay: number;
  unit?: string;
  streak: number;
  active: boolean;
}

export interface HabitLog {
  id: string;
  habitId: string;
  date: string;
  value: number;
  createdAt: string;
}

export interface VitalsDay {
  date: string;
  waterMl: number;
  waterTargetMl: number;
  sleepHours: number;
  sleepTargetHours: number;
  mood?: number;
  healthScore?: number;
  prayers: {
    fajr: boolean;
    dhuhr: boolean;
    asr: boolean;
    maghrib: boolean;
    isha: boolean;
  };
}

export interface ProjectDiaryEntry {
  id: string;
  kind: "idea" | "proposal" | "rule" | "integration" | "note";
  title: string;
  body: string;
  createdAt: string;
  archived?: boolean;
}

export interface Project {
  id: string;
  nodeId: string;
  name: string;
  tagline?: string;
  status: "active" | "paused" | "archived";
  kpi: { label: string; value: string }[];
  modules: {
    docs: string[];
    tasks: { id: string; title: string; done: boolean }[];
    ideas: string[];
    financeNotes: string[];
    team: string[];
    marketing: string[];
    sales: string[];
    files: string[];
    changelog: { at: string; text: string }[];
  };
  diary: ProjectDiaryEntry[];
}

export interface Book {
  id: string;
  nodeId: string;
  title: string;
  author: string;
  progress: number;
  chapters: Chapter[];
}

export interface Chapter {
  id: string;
  title: string;
  order: number;
  insights: Insight[];
}

export interface Insight {
  id: string;
  kind: "idea" | "person" | "quote" | "error" | "apply";
  text: string;
}

export interface ReviewCard {
  id: string;
  bookId: string;
  question: string;
  answer: string;
  ease: number;
  interval: number;
  repetitions: number;
  nextReviewAt: string;
}

export interface Skill {
  id: string;
  nodeId: string;
  name: string;
  level: number;
  xp: number;
  xpToNext: number;
  subskills: { name: string; level: number }[];
}

/** One hashtag = one block */
export interface WishBlock {
  id: string;
  hashtag: string;
  bucket: WishBucket;
  nodeId: string;
  items: WishItem[];
  archived?: boolean;
  createdAt: string;
}

export interface WishItem {
  id: string;
  title: string;
  description?: string;
  photoDataUrl?: string;
  done: boolean;
  archived?: boolean;
}

/** @deprecated — migrated into WishBlock */
export interface Wish {
  id: string;
  nodeId: string;
  title: string;
  categoryId?: string;
  description?: string;
  photoDataUrl?: string;
  done: boolean;
  status: "dreaming" | "active" | "done";
  createdAt: string;
  archived?: boolean;
}

export interface WishCategoryDef {
  id: string;
  name: string;
  color: string;
  order: number;
}

export interface ThoughtJournal {
  id: string;
  title: string;
  archived?: boolean;
  entries: ThoughtEntry[];
  createdAt: string;
}

export interface ThoughtEntry {
  id: string;
  word: string;
  body: string;
  date: string;
  archived?: boolean;
}

export interface FinanceTx {
  id: string;
  type: "income" | "expense" | "mandatory" | "savings";
  title: string;
  amount: number;
  date: string;
  note?: string;
  archived?: boolean;
}

export interface FinanceSummary {
  incomeMonth: number;
  expensesMonth: number;
  mandatoryMonth: number;
  cushion: number;
  debts: number;
  currency: string;
  subscriptions: { name: string; amount: number }[];
  goals: { title: string; target: number; current: number }[];
  transactions: FinanceTx[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  note?: string;
  important: boolean;
  archived?: boolean;
}

export interface PasswordEntry {
  id: string;
  projectName: string;
  title: string;
  username?: string;
  secret: string;
  url?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
}

export interface OracleMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  contextUsed?: string[];
}

export interface AppSettings {
  shortcutsToken: string;
  yearProgressNote: string;
  mit: string;
  theme: ThemeMode;
  language: string;
  startOfWeek: 0 | 1;
  notifications: boolean;
  sound: boolean;
  reduceMotion: boolean;
  compactMode: boolean;
  showArchived: boolean;
  name: string;
  email: string;
}

/** Visual life roadmap — stages → months → goals / daily tasks */
export interface RoadmapTask {
  id: string;
  title: string;
  done: boolean;
}

export interface RoadmapDay {
  id: string;
  date: string;
  tasks: RoadmapTask[];
}

export interface RoadmapMonthGoal {
  id: string;
  title: string;
  done: boolean;
}

export interface RoadmapMonth {
  id: string;
  year: number;
  month: number;
  goals: RoadmapMonthGoal[];
  days: RoadmapDay[];
  archived?: boolean;
  habitsScore?: number;
  focusScore?: number;
}

export interface RoadmapStage {
  id: string;
  title: string;
  subtitle: string;
  order: number;
  archived?: boolean;
  months: RoadmapMonth[];
}

export interface RoadmapData {
  stages: RoadmapStage[];
}

export interface LifeStore {
  version: number;
  spheres: Sphere[];
  nodes: LifeNode[];
  edges: LifeEdge[];
  captures: Capture[];
  goals: Goal[];
  stageDayLogs: StageDayLog[];
  dayTasks: DailyTaskItem[];
  habits: Habit[];
  habitLogs: HabitLog[];
  vitals: VitalsDay[];
  projects: Project[];
  books: Book[];
  reviewCards: ReviewCard[];
  skills: Skill[];
  wishBlocks: WishBlock[];
  /** legacy */
  wishCategories?: WishCategoryDef[];
  wishes?: Wish[];
  thoughtJournals: ThoughtJournal[];
  finance: FinanceSummary;
  calendarEvents: CalendarEvent[];
  passwords: PasswordEntry[];
  oracleMessages: OracleMessage[];
  roadmap: RoadmapData;
  settings: AppSettings;
}

export interface DailyTaskItem {
  id: string;
  date: string;
  title: string;
  done: boolean;
  archived?: boolean;
  stageId?: string;
  goalId?: string;
  goalTitle?: string;
  deadlineStart?: string;
  deadlineEnd?: string;
}
