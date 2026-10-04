import { NextResponse } from "next/server";
import { displayCurrency } from "@/lib/format";
import { id, todayKey } from "@/lib/id";
import { getStore, updateStore } from "@/lib/store";
import type { FinanceCategory, FinanceSummary, FinanceTx, LifeStore } from "@/lib/types";

const DEFAULT_CATEGORIES: Omit<FinanceCategory, "id">[] = [
  { name: "Доход", kind: "income", color: "#34d399" },
  { name: "Расход", kind: "expense", color: "#fb923c" },
  { name: "Обязательное", kind: "mandatory", color: "#a855f7" },
  { name: "В подушку", kind: "savings", color: "#38bdf8" },
];

const KINDS = new Set(["income", "expense", "mandatory", "savings"]);

function ensureCategories(finance: FinanceSummary): FinanceCategory[] {
  if (!Array.isArray(finance.categories) || finance.categories.length === 0) {
    finance.categories = DEFAULT_CATEGORIES.map((c) => ({ ...c, id: id() }));
  }
  return finance.categories;
}

function ensureFinance(s: { finance?: FinanceSummary }): FinanceSummary {
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

function sumSavings(finance: FinanceSummary) {
  return finance.transactions
    .filter((t) => !t.archived && t.type === "savings")
    .reduce((a, t) => a + t.amount, 0);
}

function syncWishSavedToward(store: LifeStore) {
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

function resolveType(finance: FinanceSummary, body: { type?: string; categoryId?: string }) {
  const cats = ensureCategories(finance).filter((c) => !c.archived);
  const categoryId = body.categoryId ? String(body.categoryId) : "";
  const cat = cats.find((c) => c.id === categoryId);
  if (cat) return { type: cat.kind, categoryId: cat.id };
  const type = String(body.type ?? "") as FinanceTx["type"];
  if (KINDS.has(type)) {
    const fallback = cats.find((c) => c.kind === type);
    return { type, categoryId: fallback?.id };
  }
  return null;
}

function recompute(finance: FinanceSummary) {
  const month = todayKey().slice(0, 7);
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

function snapshot(store: LifeStore): FinanceSummary {
  const finance = ensureFinance(store);
  recompute(finance);
  syncWishSavedToward(store);
  return {
    ...finance,
    currency: displayCurrency(finance.currency),
    categories: [...(finance.categories ?? [])],
    transactions: [...(finance.transactions ?? [])],
    subscriptions: [...(finance.subscriptions ?? [])],
    goals: [...(finance.goals ?? [])],
  };
}

export async function GET() {
  const store = await getStore();
  return NextResponse.json({ finance: snapshot(store) });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = String(body.action ?? "add");

    if (action === "add") {
      const title = String(body.title ?? "").trim();
      const amount = Number(body.amount ?? 0);
      if (!title || !(amount > 0)) {
        return NextResponse.json({ error: "Заполни название и сумму" }, { status: 400 });
      }
      const preview = ensureFinance(await getStore());
      const resolved = resolveType(preview, body);
      if (!resolved) {
        return NextResponse.json({ error: "Выбери категорию" }, { status: 400 });
      }
      const store = await updateStore((s) => {
        const finance = ensureFinance(s);
        const again = resolveType(finance, body) ?? resolved;
        const wishItemId = body.wishItemId ? String(body.wishItemId) : undefined;
        const wishBlockId = body.wishBlockId ? String(body.wishBlockId) : undefined;
        const tx: FinanceTx = {
          id: id(),
          type: again.type,
          categoryId: again.categoryId,
          title,
          amount,
          date: String(body.date ?? todayKey()).slice(0, 10),
          note: body.note ? String(body.note) : undefined,
          wishItemId: again.type === "savings" ? wishItemId : undefined,
          wishBlockId: again.type === "savings" ? wishBlockId : undefined,
        };
        finance.transactions.unshift(tx);
        recompute(finance);
        syncWishSavedToward(s);
      });
      return NextResponse.json({ finance: snapshot(store) });
    }

    if (action === "addCategory") {
      const name = String(body.name ?? "").trim();
      const kind = String(body.kind ?? "expense") as FinanceCategory["kind"];
      const color = String(body.color ?? "#a855f7");
      if (!name || !KINDS.has(kind)) {
        return NextResponse.json({ error: "Нужны название и тип" }, { status: 400 });
      }
      const store = await updateStore((s) => {
        const finance = ensureFinance(s);
        finance.categories = finance.categories ?? [];
        finance.categories.push({ id: id(), name, kind, color });
      });
      return NextResponse.json({ finance: snapshot(store) });
    }

    if (action === "updateCategory") {
      const catId = String(body.id ?? "");
      if (!catId) return NextResponse.json({ error: "Нет id" }, { status: 400 });
      const store = await updateStore((s) => {
        const finance = ensureFinance(s);
        const cat = (finance.categories ?? []).find((c) => c.id === catId);
        if (!cat) return;
        if (body.name != null) cat.name = String(body.name).trim() || cat.name;
        if (body.kind != null && KINDS.has(String(body.kind))) {
          cat.kind = body.kind as FinanceCategory["kind"];
        }
        if (body.color != null) cat.color = String(body.color);
        if (body.archived != null) cat.archived = Boolean(body.archived);
        // Keep existing txs in sync with category kind
        for (const tx of finance.transactions) {
          if (tx.categoryId === cat.id && !tx.archived) tx.type = cat.kind;
        }
        recompute(finance);
      });
      return NextResponse.json({ finance: snapshot(store) });
    }

    if (action === "deleteCategory") {
      const catId = String(body.id ?? "");
      if (!catId) return NextResponse.json({ error: "Нет id" }, { status: 400 });
      const preview = ensureFinance(await getStore());
      const active = (preview.categories ?? []).filter((c) => !c.archived);
      if (active.length <= 1) {
        return NextResponse.json({ error: "Нужна хотя бы одна категория" }, { status: 400 });
      }
      const store = await updateStore((s) => {
        const finance = ensureFinance(s);
        const cat = (finance.categories ?? []).find((c) => c.id === catId);
        if (!cat) return;
        cat.archived = true;
        const fallback = (finance.categories ?? []).find((c) => !c.archived);
        for (const tx of finance.transactions) {
          if (tx.categoryId === catId) {
            tx.categoryId = fallback?.id;
            if (fallback) tx.type = fallback.kind;
          }
        }
        recompute(finance);
      });
      return NextResponse.json({ finance: snapshot(store) });
    }

    if (action === "setCushion") {
      const cushion = Number(body.cushion ?? 0);
      if (!Number.isFinite(cushion) || cushion < 0) {
        return NextResponse.json({ error: "Некорректная подушка" }, { status: 400 });
      }
      const store = await updateStore((s) => {
        const finance = ensureFinance(s);
        finance.cushion = cushion;
        finance.cushionManual = true;
      });
      return NextResponse.json({ finance: snapshot(store) });
    }

    if (action === "clearCushionManual") {
      const store = await updateStore((s) => {
        const finance = ensureFinance(s);
        finance.cushionManual = false;
        recompute(finance);
      });
      return NextResponse.json({ finance: snapshot(store) });
    }

    if (action === "setSalary") {
      const salary = Number(body.salary ?? 0);
      if (!Number.isFinite(salary) || salary < 0) {
        return NextResponse.json({ error: "Некорректная ЗП" }, { status: 400 });
      }
      const store = await updateStore((s) => {
        ensureFinance(s).salary = salary;
      });
      return NextResponse.json({ finance: snapshot(store) });
    }

    if (action === "paySalary") {
      const preview = ensureFinance(await getStore());
      const amount = Number(body.amount ?? preview.salary ?? 0);
      if (!(amount > 0)) {
        return NextResponse.json({ error: "Сначала укажи сумму ЗП" }, { status: 400 });
      }
      const month = todayKey().slice(0, 7);
      const already = preview.transactions.some(
        (t) =>
          !t.archived &&
          t.type === "income" &&
          typeof t.date === "string" &&
          t.date.startsWith(month) &&
          /зарплат|зп/i.test(t.title)
      );
      if (already && !body.force) {
        return NextResponse.json(
          { error: "ЗП за этот месяц уже есть в истории" },
          { status: 400 }
        );
      }
      const store = await updateStore((s) => {
        const finance = ensureFinance(s);
        const incomeCat = ensureCategories(finance).find((c) => !c.archived && c.kind === "income");
        finance.transactions.unshift({
          id: id(),
          type: "income",
          categoryId: incomeCat?.id,
          title: String(body.title ?? "Зарплата").trim() || "Зарплата",
          amount,
          date: String(body.date ?? todayKey()).slice(0, 10),
          note: "ЗП",
        });
        recompute(finance);
      });
      return NextResponse.json({ finance: snapshot(store) });
    }

    if (action === "update") {
      const store = await updateStore((s) => {
        const finance = ensureFinance(s);
        const tx = finance.transactions.find((t) => t.id === body.id);
        if (!tx) return;
        if (body.title != null) tx.title = String(body.title).trim() || tx.title;
        if (body.amount != null) tx.amount = Number(body.amount);
        if (body.categoryId != null || body.type != null) {
          const resolved = resolveType(finance, body);
          if (resolved) {
            tx.type = resolved.type;
            tx.categoryId = resolved.categoryId;
          }
        }
        if (body.date != null) tx.date = String(body.date).slice(0, 10);
        if (body.note !== undefined) tx.note = body.note || undefined;
        if (body.wishItemId !== undefined) {
          tx.wishItemId = body.wishItemId ? String(body.wishItemId) : undefined;
        }
        if (body.wishBlockId !== undefined) {
          tx.wishBlockId = body.wishBlockId ? String(body.wishBlockId) : undefined;
        }
        recompute(finance);
        syncWishSavedToward(s);
      });
      return NextResponse.json({ finance: snapshot(store) });
    }

    if (action === "delete") {
      const store = await updateStore((s) => {
        const finance = ensureFinance(s);
        finance.transactions = finance.transactions.filter((t) => t.id !== body.id);
        recompute(finance);
        syncWishSavedToward(s);
      });
      return NextResponse.json({ finance: snapshot(store) });
    }

    return NextResponse.json({ error: "unknown" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "save failed" },
      { status: 500 }
    );
  }
}
