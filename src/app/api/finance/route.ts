import { NextResponse } from "next/server";
import { displayCurrency } from "@/lib/format";
import { id, todayKey } from "@/lib/id";
import { getStore, updateStore } from "@/lib/store";
import type { FinanceSummary, FinanceTx, LifeStore } from "@/lib/types";

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
      transactions: [],
    };
  }
  if (!Array.isArray(s.finance.transactions)) s.finance.transactions = [];
  if (s.finance.salary == null || !Number.isFinite(s.finance.salary)) s.finance.salary = 0;
  if (!s.finance.currency || s.finance.currency === "RUB" || s.finance.currency === "rub") {
    s.finance.currency = "₽";
  }
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
  return finance;
}

export async function GET() {
  const store = await getStore();
  const base = store.finance;
  const finance: FinanceSummary = {
    incomeMonth: base?.incomeMonth ?? 0,
    expensesMonth: base?.expensesMonth ?? 0,
    mandatoryMonth: base?.mandatoryMonth ?? 0,
    salary: base?.salary ?? 0,
    cushion: base?.cushion ?? 0,
    cushionManual: Boolean(base?.cushionManual),
    debts: base?.debts ?? 0,
    currency: displayCurrency(base?.currency),
    subscriptions: [...(base?.subscriptions ?? [])],
    goals: [...(base?.goals ?? [])],
    transactions: [...(base?.transactions ?? [])],
  };
  recompute(finance);
  return NextResponse.json({ finance });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = String(body.action ?? "add");

    if (action === "add") {
      const title = String(body.title ?? "").trim();
      const amount = Number(body.amount ?? 0);
      const type = String(body.type ?? "") as FinanceTx["type"];
      if (!title || !(amount > 0) || !["income", "expense", "mandatory", "savings"].includes(type)) {
        return NextResponse.json({ error: "Заполни название, сумму и тип" }, { status: 400 });
      }
      const store = await updateStore((s) => {
        const finance = ensureFinance(s);
        const wishItemId = body.wishItemId ? String(body.wishItemId) : undefined;
        const wishBlockId = body.wishBlockId ? String(body.wishBlockId) : undefined;
        const tx: FinanceTx = {
          id: id(),
          type,
          title,
          amount,
          date: String(body.date ?? todayKey()).slice(0, 10),
          note: body.note ? String(body.note) : undefined,
          wishItemId: type === "savings" ? wishItemId : undefined,
          wishBlockId: type === "savings" ? wishBlockId : undefined,
        };
        finance.transactions.unshift(tx);
        recompute(finance);
        syncWishSavedToward(s);
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
        finance.transactions.unshift({
          id: id(),
          type: "income",
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
        if (body.type != null) tx.type = body.type as FinanceTx["type"];
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
