import { describe, expect, it } from "vitest";
import {
  ensureFinance,
  recompute,
  resolveType,
  sumSavings,
} from "@/lib/finance-core";
import type { FinanceSummary } from "@/lib/types";

function blankFinance(): FinanceSummary {
  const finance = ensureFinance({});
  finance.categories = finance.categories ?? [];
  return finance;
}

function cats(finance: FinanceSummary) {
  return finance.categories ?? [];
}

describe("finance-core", () => {
  it("seeds default categories", () => {
    const finance = blankFinance();
    expect(cats(finance).length).toBe(4);
    expect(cats(finance).map((c) => c.kind).sort()).toEqual([
      "expense",
      "income",
      "mandatory",
      "savings",
    ].sort());
  });

  it("resolves type from categoryId", () => {
    const finance = blankFinance();
    const expense = cats(finance).find((c) => c.kind === "expense")!;
    const resolved = resolveType(finance, { categoryId: expense.id });
    expect(resolved).toEqual({ type: "expense", categoryId: expense.id });
  });

  it("rejects unknown type without category", () => {
    const finance = blankFinance();
    expect(resolveType(finance, { type: "unknown" })).toBeNull();
  });

  it("recomputes month totals and cushion from savings", () => {
    const finance = blankFinance();
    const income = cats(finance).find((c) => c.kind === "income")!;
    const expense = cats(finance).find((c) => c.kind === "expense")!;
    const savings = cats(finance).find((c) => c.kind === "savings")!;
    const month = "2026-10";
    finance.transactions = [
      {
        id: "1",
        type: "income",
        categoryId: income.id,
        title: "ЗП",
        amount: 1000,
        date: `${month}-01`,
      },
      {
        id: "2",
        type: "expense",
        categoryId: expense.id,
        title: "Еда",
        amount: 200,
        date: `${month}-02`,
      },
      {
        id: "3",
        type: "savings",
        categoryId: savings.id,
        title: "Подушка",
        amount: 150,
        date: `${month}-03`,
      },
    ];
    recompute(finance, month);
    expect(finance.incomeMonth).toBe(1000);
    expect(finance.expensesMonth).toBe(200);
    expect(finance.cushion).toBe(150);
    expect(sumSavings(finance)).toBe(150);
  });

  it("keeps manual cushion when recomputing", () => {
    const finance = blankFinance();
    finance.cushionManual = true;
    finance.cushion = 999;
    const savings = cats(finance).find((c) => c.kind === "savings")!;
    finance.transactions = [
      {
        id: "1",
        type: "savings",
        categoryId: savings.id,
        title: "x",
        amount: 10,
        date: "2026-10-01",
      },
    ];
    recompute(finance, "2026-10");
    expect(finance.cushion).toBe(999);
  });
});
