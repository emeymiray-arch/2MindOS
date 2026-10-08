import { id, todayKey } from "@/lib/id";
import type { FinanceCategory, FinanceSummary, FinanceTx, LifeStore } from "@/lib/types";

export const DEFAULT_FINANCE_CATEGORIES: Omit<FinanceCategory, "id">[] = [
  { name: "Доход", kind: "income", color: "#34d399" },
  { name: "Расход", kind: "expense", color: "#fb923c" },
  { name: "Обязательное", kind: "mandatory", color: "#a855f7" },
  { name: "В подушку", kind: "savings", color: "#38bdf8" },
];

export const FINANCE_KINDS = new Set(["income", "expense", "mandatory", "savings"]);

export function ensureCategories(finance: FinanceSummary): FinanceCategory[] {
  if (!Array.isArray(finance.categories) || finance.categories.length === 0) {
    finance.categories = DEFAULT_FINANCE_CATEGORIES.map((c) => ({ ...c, id: id() }));
  }
  return finance.categories;
}

export function ensureFinance(s: { finance?: FinanceSummary }): FinanceSummary {
  if (!s.finance) {
    s.finance = {
      incomeMonth: 0,
      expensesMonth: 0,
      mandatoryMonth: 0,
      salary: 0,
      cushion: 0,
      cushionManual: false,
      debts: 0,
      currency: "₽",
      subscriptions: [],
      goals: [],
      categories: [],
      transactions: [],
    };
  }
  if (!Array.isArray(s.finance.transactions)) s.finance.transactions = [];
  if (s.finance.salary == null || !Number.isFinite(s.finance.salary)) s.finance.salary = 0;
  if (!s.finance.currency || s.finance.currency === "RUB" || s.finance.currency === "rub") {
    s.finance.currency = "₽";
  }
  ensureCategories(s.finance);
  return s.finance;
}

export function sumSavings(finance: FinanceSummary) {
  return finance.transactions
    .filter((t) => !t.archived && t.type === "savings")
    .reduce((a, t) => a + t.amount, 0);
}

export function syncWishSavedToward(store: LifeStore) {
  const totals = new Map<string, number>();
  for (const t of store.finance?.transactions ?? []) {
    if (t.archived || t.type !== "savings" || !t.wishItemId) continue;
    totals.set(t.wishItemId, (totals.get(t.wishItemId) ?? 0) + t.amount);
  }
  for (const b of store.wishBlocks ?? []) {
    for (const item of b.items ?? []) {
      item.savedToward = totals.get(item.id) ?? 0;
    }
  }
}

export function resolveType(
  finance: FinanceSummary,
  body: { type?: string; categoryId?: string }
): { type: FinanceTx["type"]; categoryId?: string } | null {
  const cats = ensureCategories(finance).filter((c) => !c.archived);
  const categoryId = body.categoryId ? String(body.categoryId) : "";
  const cat = cats.find((c) => c.id === categoryId);
  if (cat) return { type: cat.kind, categoryId: cat.id };
  const type = String(body.type ?? "") as FinanceTx["type"];
  if (FINANCE_KINDS.has(type)) {
    const fallback = cats.find((c) => c.kind === type);
    return { type, categoryId: fallback?.id };
  }
  return null;
}

export function recompute(finance: FinanceSummary, month = todayKey().slice(0, 7)) {
  const txs = finance.transactions.filter(
    (t) => !t.archived && typeof t.date === "string" && t.date.startsWith(month)
  );
  finance.incomeMonth = txs.filter((t) => t.type === "income").reduce((a, t) => a + t.amount, 0);
  finance.expensesMonth = txs
    .filter((t) => t.type === "expense" || t.type === "mandatory")
    .reduce((a, t) => a + t.amount, 0);
  finance.mandatoryMonth = txs
    .filter((t) => t.type === "mandatory")
    .reduce((a, t) => a + t.amount, 0);
  if (!finance.cushionManual) {
    finance.cushion = sumSavings(finance);
  }
}
