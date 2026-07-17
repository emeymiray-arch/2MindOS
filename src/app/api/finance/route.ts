import { NextResponse } from "next/server";
import { id, todayKey } from "@/lib/id";
import { getStore, updateStore } from "@/lib/store";
import type { FinanceTx } from "@/lib/types";

function recompute(finance: {
  transactions: FinanceTx[];
  incomeMonth: number;
  expensesMonth: number;
  mandatoryMonth: number;
  cushion: number;
}) {
  const month = todayKey().slice(0, 7);
  const txs = finance.transactions.filter((t) => t.date.startsWith(month));
  finance.incomeMonth = txs.filter((t) => t.type === "income").reduce((a, t) => a + t.amount, 0);
  finance.expensesMonth = txs.filter((t) => t.type === "expense").reduce((a, t) => a + t.amount, 0);
  finance.mandatoryMonth = txs
    .filter((t) => t.type === "mandatory")
    .reduce((a, t) => a + t.amount, 0);
  const savings = txs.filter((t) => t.type === "savings").reduce((a, t) => a + t.amount, 0);
  // cushion stays as base + savings tracked separately in display; bump soft
  if (savings > 0 && finance.cushion < savings) {
    /* keep user cushion as source of truth unless empty */
  }
}

export async function GET() {
  const store = await getStore();
  return NextResponse.json({ finance: store.finance });
}

export async function POST(request: Request) {
  const body = await request.json();
  const action = String(body.action ?? "add");

  if (action === "add") {
    const title = String(body.title ?? "").trim();
    const amount = Number(body.amount ?? 0);
    const type = body.type as FinanceTx["type"];
    if (!title || !amount || !type) {
      return NextResponse.json({ error: "fields" }, { status: 400 });
    }
    const store = await updateStore((s) => {
      const tx: FinanceTx = {
        id: id(),
        type,
        title,
        amount,
        date: String(body.date ?? todayKey()),
        note: body.note ? String(body.note) : undefined,
      };
      s.finance.transactions.unshift(tx);
      if (type === "savings") s.finance.cushion += amount;
      recompute(s.finance);
    });
    return NextResponse.json({ finance: store.finance });
  }

  if (action === "setCushion") {
    const store = await updateStore((s) => {
      s.finance.cushion = Number(body.cushion ?? 0);
    });
    return NextResponse.json({ finance: store.finance });
  }

  if (action === "update") {
    const store = await updateStore((s) => {
      const tx = s.finance.transactions.find((t) => t.id === body.id);
      if (!tx) return;
      if (body.title != null) tx.title = String(body.title).trim() || tx.title;
      if (body.amount != null) tx.amount = Number(body.amount);
      if (body.type != null) tx.type = body.type as FinanceTx["type"];
      if (body.date != null) tx.date = String(body.date);
      if (body.note !== undefined) tx.note = body.note || undefined;
      recompute(s.finance);
    });
    return NextResponse.json({ finance: store.finance });
  }

  if (action === "delete") {
    const store = await updateStore((s) => {
      s.finance.transactions = s.finance.transactions.filter((t) => t.id !== body.id);
      recompute(s.finance);
    });
    return NextResponse.json({ finance: store.finance });
  }

  return NextResponse.json({ error: "unknown" }, { status: 400 });
}
