"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/client-api";
import { displayCurrency } from "@/lib/format";
import {
  IconCoin,
  IconTarget,
  IconTrendDown,
  IconTrendUp,
  IconWallet,
} from "@/components/ui/Icons";
import { KpiTile, PageHero, WidgetHead } from "@/components/ui/Widgets";
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
  const income = data?.incomeMonth ?? 0;
  const expenses = data?.expensesMonth ?? 0;
  const net = income - expenses;
  const cushion = data?.cushion ?? 0;

  return (
    <div className="space-y-4">
      <PageHero
        kicker="Финансы"
        title="Финансы"
        lede="Доход, обязательное, подушка."
        action={
          <div className="text-right">
            <p className="home-clock-time" style={{ fontSize: "1.6rem" }}>
              {money(net, cur)}
            </p>
            <p className="home-clock-meta">баланс месяца</p>
          </div>
        }
      />

      <div className="bento">
        <div className="span-3">
          <KpiTile
            label="Зарплата"
            value={money(data?.salary ?? 0, cur)}
            hint="месячная ставка"
            color="#34d399"
            icon={<IconCoin size={18} />}
          />
        </div>
        <div className="span-3">
          <KpiTile
            label="Доход"
            value={money(income, cur)}
            hint="за этот месяц"
            color="#38bdf8"
            icon={<IconTrendUp size={18} />}
          />
        </div>
        <div className="span-3">
          <KpiTile
            label="Расход"
            value={money(expenses, cur)}
            hint="за этот месяц"
            color="#fb923c"
            icon={<IconTrendDown size={18} />}
          />
        </div>
        <div className="span-3">
          <KpiTile
            label="Подушка"
            value={money(cushion, cur)}
            hint={data?.cushionManual ? "ручной режим" : "из истории"}
            color="#a855f7"
            icon={<IconWallet size={18} />}
          />
        </div>

        <div className="span-6">
          <form onSubmit={saveSalary} className="panel h-full space-y-3">
            <WidgetHead title="Зарплата" tone="green" />
            <input
              className="field"
              inputMode="decimal"
              value={salaryEdit}
              onChange={(e) => setSalaryEdit(e.target.value)}
              placeholder="Сумма ЗП"
            />
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn" disabled={busy}>
                Сохранить
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => void paySalary()}
              >
                Начислить ЗП
              </button>
            </div>
          </form>
        </div>

        <div className="span-6">
          <form onSubmit={saveCushion} className="panel h-full space-y-3">
            <WidgetHead title="Подушка" tone="blue" />
            <input
              className="field"
              inputMode="decimal"
              value={cushionEdit}
              onChange={(e) => setCushionEdit(e.target.value)}
            />
            <p className="text-[12px] font-medium text-[var(--ink-faint)]">
              {data?.cushionManual
                ? "Ручной режим: история «В подушку» не меняет цифру"
                : "Считается из записей «В подушку»"}
            </p>
            <div className="flex flex-wrap gap-2">
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
            </div>
          </form>
        </div>

        <div className="span-5">
          <form onSubmit={addTx} className="panel h-full space-y-3">
            <WidgetHead title="Новая запись" tone="orange" />
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
            <input
              className="field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: продукты / такси"
              required
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className="field"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Сумма"
                required
              />
              <input
                type="date"
                className="field"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              Добавить
            </button>
          </form>
        </div>

        <div className="span-7">
          <section className="panel h-full">
            <WidgetHead
              title="История"
              tone="violet"
              action={
                <span className="text-[12px] text-[var(--ink-faint)]">{txs.length} записей</span>
              }
            />
            {txs.length === 0 ? (
              <p className="py-6 text-center text-[14px] text-[var(--ink-soft)]">
                Пока пусто — добавь первую запись.
              </p>
            ) : (
              <ul className="max-h-[22rem] space-y-2 overflow-y-auto">
                {txs.map((tx) => {
                  const meta = typeMeta(tx.type);
                  const sign = tx.type === "income" || tx.type === "savings" ? "+" : "−";
                  return (
                    <li key={tx.id} className="signal-row">
                      <span
                        className="signal-ico flex h-8 w-8 items-center justify-center rounded-xl"
                        style={{ background: meta.soft, color: meta.color }}
                      >
                        <IconTarget size={14} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold">{tx.title}</p>
                        <p className="text-[11px] font-medium" style={{ color: meta.color }}>
                          {meta.label} · {tx.date}
                        </p>
                      </div>
                      <p
                        className="shrink-0 text-[13px] font-bold tabular-nums"
                        style={{ color: meta.color }}
                      >
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
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
