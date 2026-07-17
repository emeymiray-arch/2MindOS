"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { FinanceSummary, FinanceTx } from "@/lib/types";

export default function CapitalPage() {
  const [finance, setFinance] = useState<FinanceSummary | null>(null);
  const [form, setForm] = useState({
    type: "expense" as FinanceTx["type"],
    title: "",
    amount: "",
  });

  const load = useCallback(async () => {
    const res = await fetch("/api/finance");
    const data = await res.json();
    setFinance(data.finance);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!finance) return <div className="text-[var(--ink-faint)]">Загрузка…</div>;

  const free =
    finance.incomeMonth - finance.expensesMonth - finance.mandatoryMonth;

  async function add() {
    const amount = Number(form.amount);
    if (!form.title || !amount) return;
    await fetch("/api/finance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", ...form, amount }),
    });
    setForm({ type: "expense", title: "", amount: "" });
    await load();
  }

  return (
    <div className="fade-in mx-auto max-w-4xl space-y-6">
      <div>
        <p className="eyebrow">Капитал</p>
        <h1 className="font-display mt-1 text-3xl">Финучёт</h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Доход / мес" value={`${finance.incomeMonth.toLocaleString("ru-RU")} ₽`} />
        <Tile label="Расходы" value={`${finance.expensesMonth.toLocaleString("ru-RU")} ₽`} />
        <Tile label="Обязательные" value={`${finance.mandatoryMonth.toLocaleString("ru-RU")} ₽`} />
        <Tile label="Копилка" value={`${finance.cushion.toLocaleString("ru-RU")} ₽`} />
      </div>

      <div className="card p-5">
        <p className="eyebrow">Аналитика месяца</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-[12px] text-[var(--ink-faint)]">Свободно</p>
            <p className="text-2xl font-bold">{free.toLocaleString("ru-RU")} ₽</p>
          </div>
          <div>
            <p className="text-[12px] text-[var(--ink-faint)]">Долги</p>
            <p className="text-2xl font-bold">{finance.debts.toLocaleString("ru-RU")} ₽</p>
          </div>
          <div>
            <p className="text-[12px] text-[var(--ink-faint)]">Подписки</p>
            <p className="text-2xl font-bold">
              {finance.subscriptions.reduce((a, s) => a + s.amount, 0).toLocaleString("ru-RU")} ₽
            </p>
          </div>
        </div>
        <div className="meter meter-teal mt-4">
          <span
            style={{
              width: `${Math.min(
                100,
                finance.incomeMonth
                  ? ((finance.mandatoryMonth + finance.expensesMonth) / finance.incomeMonth) * 100
                  : 0
              )}%`,
            }}
          />
        </div>
        <p className="mt-2 text-[12px] text-[var(--ink-faint)]">Доля обязательных + расходов от дохода</p>
      </div>

      <div className="card space-y-3 p-4">
        <p className="eyebrow">Добавить операцию</p>
        <div className="flex flex-wrap gap-2">
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as FinanceTx["type"] })}
          >
            <option value="income">Доход</option>
            <option value="expense">Расход</option>
            <option value="mandatory">Обязательный</option>
            <option value="savings">В копилку</option>
          </select>
          <input
            className="min-w-[140px] flex-1"
            placeholder="Название"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <input
            type="number"
            placeholder="Сумма"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
          <button type="button" className="btn btn-ink" onClick={add}>
            +
          </button>
        </div>
      </div>

      <section className="card p-5">
        <p className="eyebrow mb-3">История</p>
        <ul className="space-y-2">
          {finance.transactions.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 text-[14px]">
              <div>
                <span className="text-[11px] font-semibold uppercase text-[var(--ink-faint)]">
                  {t.type}
                </span>
                <p className="font-medium">{t.title}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{t.amount.toLocaleString("ru-RU")} ₽</p>
                <p className="text-[11px] text-[var(--ink-faint)]">{t.date}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <Link href="/" className="text-[13px] font-semibold text-[var(--indigo)]">
        Health vitals → Пульт
      </Link>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="eyebrow">{label}</p>
      <p className="mt-2 text-xl font-bold tracking-[-0.02em]">{value}</p>
    </div>
  );
}
