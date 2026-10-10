"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/client-api";
import { displayCurrency } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import { KpiTile, PageHero, WidgetHead } from "@/components/ui/Widgets";
import { Dialog } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/ui/Toast";
import type { FinanceCategory } from "@/lib/types";

type Tx = {
  id: string;
  type: FinanceCategory["kind"];
  categoryId?: string;
  title: string;
  amount: number;
  date: string;
};

type Finance = {
  incomeMonth: number;
  expensesMonth: number;
  mandatoryMonth?: number;
  salary?: number;
  cushion: number;
  currency?: string;
  categories?: FinanceCategory[];
  transactions: Tx[];
};

const KIND_LABEL: Record<FinanceCategory["kind"], string> = {
  income: "Доход",
  expense: "Расход",
  mandatory: "Обязательное",
  savings: "В подушку",
};

const KIND_OPTIONS = (Object.keys(KIND_LABEL) as FinanceCategory["kind"][]).map((k) => ({
  value: k,
  label: KIND_LABEL[k],
}));

const COLORS = ["#34d399", "#fb923c", "#a855f7", "#38bdf8", "#f472b6", "#fbbf24"];

function money(n: number, cur: string) {
  return `${n.toLocaleString("ru-RU")} ${cur}`;
}

async function fetchFinance(): Promise<Finance | null> {
  const res = await apiGet("/api/finance");
  if (!res.ok) throw new Error("Не удалось загрузить финансы");
  return (res.data.finance as Finance) ?? null;
}

export default function FinancePage() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [addOpen, setAddOpen] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [newKind, setNewKind] = useState<FinanceCategory["kind"]>("expense");
  const [kind, setKind] = useState<FinanceCategory["kind"]>("expense");

  const { data = null, isLoading: loading } = useQuery({
    queryKey: queryKeys.finance,
    queryFn: fetchFinance,
  });

  const load = async () => {
    await qc.invalidateQueries({ queryKey: queryKeys.finance });
  };

  const categories = useMemo(
    () => (data?.categories ?? []).filter((c) => !c.archived),
    [data]
  );
  const kindCats = useMemo(
    () => categories.filter((c) => c.kind === kind),
    [categories, kind]
  );
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  useEffect(() => {
    if (kindCats.length && !kindCats.some((c) => c.id === categoryId)) {
      setCategoryId(kindCats[0].id);
    }
    if (!kindCats.length) setCategoryId("");
  }, [kindCats, categoryId]);

  async function addTx(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const amt = Number(String(amount).replace(",", "."));
    if (!title.trim() || !(amt > 0) || !categoryId) {
      toast("Нужны категория, название и сумма", "warn");
      return;
    }
    setBusy(true);
    const res = await apiPost("/api/finance", {
      action: "add",
      categoryId,
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

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    const name = newCat.trim();
    if (!name || busy) return;
    setBusy(true);
    const res = await apiPost("/api/finance", {
      action: "addCategory",
      name,
      kind: newKind,
      color: COLORS[categories.length % COLORS.length],
    });
    setBusy(false);
    if (!res.ok) {
      toast(res.error ?? "Не создалось", "warn");
      return;
    }
    const created = ((res.data.finance as Finance)?.categories ?? []).filter((c) => !c.archived);
    const last = created[created.length - 1];
    if (last) setCategoryId(last.id);
    setNewCat("");
    setAddOpen(false);
    toast("Категория добавлена", "ok");
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

  if (loading) {
    return (
      <div className="page-stack">
        <PageHero title="Финансы" />
        <section className="panel">
          <p className="text-[var(--ink-faint)]">Секунду…</p>
        </section>
      </div>
    );
  }

  const cur = displayCurrency(data?.currency);
  const txs = data?.transactions ?? [];
  const income = data?.incomeMonth ?? 0;
  const expenses = data?.expensesMonth ?? 0;
  const cushion = data?.cushion ?? 0;
  const salary = data?.salary ?? 0;
  const net = income - expenses;

  return (
    <div className="page-stack">
      <PageHero
        title="Финансы"
        action={
          <div className="home-hero-action">
            <p className="home-clock-time" style={{ fontSize: "1.55rem" }}>
              {money(net, cur)}
            </p>
            <p className="home-clock-meta">баланс месяца</p>
          </div>
        }
      />

      <div className="bento">
        <div className="span-3">
          <KpiTile label="Подушка" value={money(cushion, cur)} color="#38bdf8" />
        </div>
        <div className="span-3">
          <KpiTile label="Доходы" value={money(income, cur)} color="#34d399" />
        </div>
        <div className="span-3">
          <KpiTile label="Расходы" value={money(expenses, cur)} color="#fb923c" />
        </div>
        <div className="span-3">
          <KpiTile label="ЗП" value={money(salary, cur)} color="#a855f7" />
        </div>

        <div className="span-12">
          <form onSubmit={addTx} className="panel space-y-4">
            <WidgetHead title="Новая запись" tone="orange" />
            <div className="flex flex-wrap items-center gap-2">
              {(Object.keys(KIND_LABEL) as FinanceCategory["kind"][]).map((k) => (
                <button
                  key={k}
                  type="button"
                  className="chip-soft"
                  data-active={kind === k}
                  onClick={() => {
                    setKind(k);
                    setNewKind(k);
                  }}
                >
                  {KIND_LABEL[k]}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {kindCats.map((c) => {
                const on = categoryId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategoryId(c.id)}
                    className="chip-soft"
                    data-active={on}
                    style={
                      on
                        ? { background: `${c.color}44`, color: c.color, borderColor: `${c.color}66` }
                        : { color: c.color }
                    }
                  >
                    {c.name}
                  </button>
                );
              })}
              <button
                type="button"
                className="chip-soft finance-cat-plus"
                aria-label="Добавить категорию"
                onClick={() => {
                  setNewKind(kind);
                  setAddOpen(true);
                }}
                title="Новая категория"
              >
                +
              </button>
            </div>
            <input
              className="field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Название"
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

        <div className="span-12">
          <section className="panel">
            <WidgetHead
              title="История"
              tone="blue"
              action={<span className="text-[12px] text-[var(--ink-faint)]">{txs.length}</span>}
            />
            {txs.length === 0 ? (
              <p className="py-4 text-[14px] text-[var(--ink-soft)]">Пока пусто.</p>
            ) : (
              <ul className="stack-tight max-h-[26rem] overflow-y-auto">
                {txs.map((tx) => {
                  const cat = tx.categoryId ? catMap.get(tx.categoryId) : undefined;
                  const color = cat?.color ?? "var(--accent)";
                  const label = cat?.name ?? KIND_LABEL[tx.type];
                  const sign = tx.type === "income" || tx.type === "savings" ? "+" : "−";
                  return (
                    <li key={tx.id} className="signal-row">
                      <span className="signal-ico" style={{ background: `${color}22`, color }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold">{tx.title}</p>
                        <p className="text-[11px] font-medium text-[var(--ink-faint)]">
                          {label} · {tx.date}
                        </p>
                      </div>
                      <p className="shrink-0 text-[14px] font-bold tabular-nums" style={{ color }}>
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

      <Dialog open={addOpen} onOpenChange={setAddOpen} title="Новая категория">
        <form onSubmit={addCategory} className="space-y-3">
          <input
            className="field"
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            placeholder="Название"
            autoFocus
          />
          <Select
            value={newKind}
            onValueChange={(v) => setNewKind(v as FinanceCategory["kind"])}
            options={KIND_OPTIONS}
            ariaLabel="Тип"
          />
          <button type="submit" className="btn btn-primary w-full" disabled={busy || !newCat.trim()}>
            Создать
          </button>
        </form>
      </Dialog>
    </div>
  );
}
