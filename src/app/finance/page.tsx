"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/client-api";
import { displayCurrency } from "@/lib/format";
import { toast } from "@/components/ui/Toast";

type Tx = {
  id: string;
  type: "income" | "expense" | "mandatory" | "savings";
  title: string;
  amount: number;
  date: string;
  note?: string;
};

type Finance = {
  incomeMonth: number;
  expensesMonth: number;
  mandatoryMonth?: number;
  salary?: number;
  cushion: number;
  cushionManual?: boolean;
  currency?: string;
  transactions: Tx[];
};

const TYPES: { id: Tx["type"]; label: string; color: string; soft: string }[] = [
  { id: "income", label: "Доход", color: "var(--c-green)", soft: "var(--c-green-soft)" },
  { id: "expense", label: "Расход", color: "var(--c-orange)", soft: "var(--c-orange-soft)" },
  { id: "mandatory", label: "Обязательное", color: "var(--c-violet)", soft: "var(--c-violet-soft)" },
  { id: "savings", label: "В подушку", color: "var(--c-blue)", soft: "var(--c-blue-soft)" },
];

function money(n: number, cur: string) {
  return `${n.toLocaleString("ru-RU")} ${cur}`;
}

function typeMeta(type: string) {
  return TYPES.find((t) => t.id === type) ?? TYPES[1];
}

export default function FinancePage() {
  const [data, setData] = useState<Finance | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [type, setType] = useState<Tx["type"]>("expense");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [cushionEdit, setCushionEdit] = useState("");
  const [salaryEdit, setSalaryEdit] = useState("");

  const load = useCallback(async () => {
    const res = await apiGet("/api/finance");
    if (res.ok) {
      const f = (res.data.finance as Finance) ?? null;
      setData(f);
      if (f) {
        setCushionEdit(String(f.cushion ?? 0));
        setSalaryEdit(String(f.salary ?? 0));
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addTx(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const amt = Number(String(amount).replace(",", "."));
    if (!title.trim() || !(amt > 0)) {
      toast("Нужны название и сумма", "warn");
      return;
    }
    setBusy(true);
    const res = await apiPost("/api/finance", {
      action: "add",
      type,
      title: title.trim(),
      amount: amt,
      date,
    });
    setBusy(false);
    if (!res.ok) {
      toast(res.error ?? "Не удалось добавить", "warn");
      return;
    }
    setTitle("");
    setAmount("");
    toast("Добавила", "ok");
    await load();
  }

  async function saveCushion(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const n = Number(String(cushionEdit).replace(",", "."));
    if (!Number.isFinite(n) || n < 0) {
      toast("Некорректная сумма", "warn");
      return;
    }
    setBusy(true);
    const res = await apiPost("/api/finance", { action: "setCushion", cushion: n });
    setBusy(false);
    if (!res.ok) {
      toast(res.error ?? "Не сохранилось", "warn");
      return;
    }
    toast("Подушка зафиксирована вручную", "ok");
    await load();
  }

  async function clearCushionManual() {
    if (busy) return;
    setBusy(true);
    const res = await apiPost("/api/finance", { action: "clearCushionManual" });
    setBusy(false);
    if (!res.ok) {
      toast(res.error ?? "Не сохранилось", "warn");
      return;
    }
    toast("Подушка снова из истории", "ok");
    await load();
  }

  async function saveSalary(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const n = Number(String(salaryEdit).replace(",", "."));
    if (!Number.isFinite(n) || n < 0) {
      toast("Некорректная сумма", "warn");
      return;
    }
    setBusy(true);
    const res = await apiPost("/api/finance", { action: "setSalary", salary: n });
    setBusy(false);
    if (!res.ok) {
      toast(res.error ?? "Не сохранилось", "warn");
      return;
    }
    toast("ЗП сохранена", "ok");
    await load();
  }

  async function paySalary() {
    if (busy) return;
    const n = Number(String(salaryEdit).replace(",", ".")) || data?.salary || 0;
    if (!(n > 0)) {
      toast("Сначала укажи сумму ЗП", "warn");
      return;
    }
    setBusy(true);
    const res = await apiPost("/api/finance", { action: "paySalary", amount: n });
    setBusy(false);
    if (!res.ok) {
      toast(res.error ?? "Не удалось начислить", "warn");
      return;
    }
    toast("ЗП начислена в доход месяца", "ok");
    await load();
  }

  async function removeTx(id: string) {
    if (busy) return;
    setBusy(true);
    const res = await apiPost("/api/finance", { action: "delete", id });
    setBusy(false);
    if (!res.ok) {
      toast(res.error ?? "Не удалось удалить", "warn");
      return;
    }
    toast("Удалила", "ok");
    await load();
  }

  if (loading) return <p className="text-[var(--ink-faint)]">Секунду…</p>;

  const cur = displayCurrency(data?.currency);
  const txs = data?.transactions ?? [];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-[34px]">Деньги</h1>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="surface p-4 text-center" style={{ background: "var(--c-green-soft)" }}>
          <p className="text-[12px] font-bold text-[var(--c-green)]">ЗП</p>
          <p className="mt-2 font-bold tabular-nums">{money(data?.salary ?? 0, cur)}</p>
        </div>
        <div className="surface p-4 text-center" style={{ background: "var(--c-green-soft)" }}>
          <p className="text-[12px] font-bold text-[var(--c-green)]">Доход</p>
          <p className="mt-2 font-bold tabular-nums">{money(data?.incomeMonth ?? 0, cur)}</p>
        </div>
        <div className="surface p-4 text-center" style={{ background: "var(--c-orange-soft)" }}>
          <p className="text-[12px] font-bold text-[var(--c-orange)]">Расход</p>
          <p className="mt-2 font-bold tabular-nums">{money(data?.expensesMonth ?? 0, cur)}</p>
        </div>
        <div className="surface p-4 text-center" style={{ background: "var(--c-blue-soft)" }}>
          <p className="text-[12px] font-bold text-[var(--c-blue)]">Подушка</p>
          <p className="mt-2 font-bold tabular-nums">{money(data?.cushion ?? 0, cur)}</p>
        </div>
      </div>

      <form onSubmit={saveSalary} className="surface flex flex-wrap items-end gap-3 p-5">
        <div className="min-w-[10rem] flex-1">
          <label className="text-[13px] font-bold text-[var(--c-green)]">Зарплата в месяц</label>
          <input
            className="field mt-2"
            inputMode="decimal"
            value={salaryEdit}
            onChange={(e) => setSalaryEdit(e.target.value)}
            placeholder="Сумма ЗП"
          />
        </div>
        <button type="submit" className="btn" disabled={busy}>
          Сохранить ЗП
        </button>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void paySalary()}>
          Начислить ЗП
        </button>
      </form>

      <form onSubmit={addTx} className="surface space-y-4 p-5">
        <p className="text-[13px] font-bold text-[var(--accent)]">Новая запись</p>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => {
            const on = type === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setType(t.id)}
                className="rounded-full px-3 py-1.5 text-[12px] font-bold transition"
                style={{
                  background: on ? t.color : t.soft,
                  color: on ? "#fff" : t.color,
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className="field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Например: продукты / такси"
            required
          />
          <input
            className="field"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Сумма"
            required
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="date"
            className="field"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <button type="submit" className="btn btn-primary sm:ml-auto" disabled={busy}>
            Добавить
          </button>
        </div>
      </form>

      <form onSubmit={saveCushion} className="surface flex flex-wrap items-end gap-3 p-5">
        <div className="min-w-[10rem] flex-1">
          <label className="text-[13px] font-bold text-[var(--c-blue)]">Подушка</label>
          <input
            className="field mt-2"
            inputMode="decimal"
            value={cushionEdit}
            onChange={(e) => setCushionEdit(e.target.value)}
          />
          <p className="mt-2 text-[12px] font-semibold text-[var(--ink-faint)]">
            {data?.cushionManual
              ? "Ручной режим: история «В подушку» не меняет эту цифру (wishlist-копилки всё равно копят к вещи)"
              : "Считается из записей «В подушку»"}
          </p>
        </div>
        <button type="submit" className="btn" disabled={busy}>
          Зафиксировать
        </button>
        {data?.cushionManual ? (
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => void clearCushionManual()}
          >
            Считать из истории
          </button>
        ) : null}
      </form>

      <section>
        <h2 className="font-display text-[1.45rem]">История</h2>
        <div className="surface mt-3 px-4">
          {txs.length === 0 ? (
            <p className="py-8 text-center text-[14px] font-semibold text-[var(--c-blue)]">
              Пока пусто — добавь первую запись сверху
            </p>
          ) : (
            txs.map((tx) => {
              const meta = typeMeta(tx.type);
              const sign = tx.type === "income" || tx.type === "savings" ? "+" : "−";
              return (
                <div
                  key={tx.id}
                  className="flex items-center gap-3 border-b border-[var(--line)] py-3.5 last:border-0"
                >
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ background: meta.soft, color: meta.color }}
                  >
                    {meta.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-bold">{tx.title}</p>
                    <p className="text-[12px] font-semibold" style={{ color: meta.color }}>
                      {tx.date}
                    </p>
                  </div>
                  <p className="shrink-0 text-[14px] font-bold tabular-nums" style={{ color: meta.color }}>
                    {sign}
                    {money(tx.amount, cur)}
                  </p>
                  <button
                    type="button"
                    className="text-[12px] font-bold text-[var(--behind)]"
                    disabled={busy}
                    onClick={() => void removeTx(tx.id)}
                  >
                    ✕
                  </button>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
