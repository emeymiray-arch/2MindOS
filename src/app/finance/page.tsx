"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/client-api";
import { displayCurrency } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import { EditableText } from "@/components/ui/EditableText";
import { Select } from "@/components/ui/Select";
import { PageHero, WidgetHead } from "@/components/ui/Widgets";
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
  cushion: number;
  currency?: string;
  categories?: FinanceCategory[];
  transactions: Tx[];
};

const KIND_LABEL: Record<FinanceCategory["kind"], string> = {
  income: "Доход",
  expense: "Расход",
  mandatory: "Обязат.",
  savings: "Подушка",
};

const COLORS = ["#34d399", "#fb923c", "#a855f7", "#38bdf8", "#f472b6", "#fbbf24"];

function money(n: number, cur: string) {
  return `${n.toLocaleString("ru-RU")} ${cur}`;
}

const KIND_OPTIONS = (Object.keys(KIND_LABEL) as FinanceCategory["kind"][]).map((k) => ({
  value: k,
  label: KIND_LABEL[k],
}));

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
  const [newCat, setNewCat] = useState("");
  const [newKind, setNewKind] = useState<FinanceCategory["kind"]>("expense");

  const { data = null, isLoading: loading } = useQuery({
    queryKey: queryKeys.finance,
    queryFn: fetchFinance,
  });

  const load = async () => {
    await qc.invalidateQueries({ queryKey: queryKeys.finance });
  };

  useEffect(() => {
    const cats = (data?.categories ?? []).filter((c) => !c.archived);
    if (cats.length && !cats.some((c) => c.id === categoryId)) {
      setCategoryId(cats[0].id);
    }
  }, [data, categoryId]);

  const categories = useMemo(
    () => (data?.categories ?? []).filter((c) => !c.archived),
    [data]
  );
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

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
    setNewCat("");
    toast("Категория добавлена", "ok");
    await load();
  }

  async function renameCategory(id: string, name: string) {
    if (!name.trim()) return;
    const res = await apiPost("/api/finance", {
      action: "updateCategory",
      id,
      name: name.trim(),
    });
    if (!res.ok) toast(res.error ?? "Не сохранилось", "warn");
    else await load();
  }

  async function setCategoryKind(id: string, kind: FinanceCategory["kind"]) {
    const res = await apiPost("/api/finance", { action: "updateCategory", id, kind });
    if (!res.ok) toast(res.error ?? "Не сохранилось", "warn");
    else await load();
  }

  async function removeCategory(id: string, name: string) {
    if (!window.confirm(`Удалить категорию «${name}»?`)) return;
    setBusy(true);
    const res = await apiPost("/api/finance", { action: "deleteCategory", id });
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
  const net = (data?.incomeMonth ?? 0) - (data?.expensesMonth ?? 0);

  return (
    <div className="page-stack">
      <PageHero
        title="Финансы"
        action={
          <div className="home-hero-action">
            <p className="home-clock-time" style={{ fontSize: "1.55rem" }}>
              {money(net, cur)}
            </p>
            <p className="home-clock-meta">месяц</p>
          </div>
        }
      />

      <div className="bento">
        <div className="span-7">
          <form onSubmit={addTx} className="panel h-full space-y-4 rise-in">
            <WidgetHead title="Новая запись" tone="orange" />
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => {
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

        <div className="span-5">
          <section className="panel h-full space-y-3 rise-in">
            <WidgetHead title="Категории" tone="violet" />
            <ul className="stack-tight">
              {categories.map((c) => (
                <li key={c.id} className="signal-row row-in">
                  <span
                    className="signal-ico"
                    style={{ background: `${c.color}22`, color: c.color }}
                  >
                    ●
                  </span>
                  <div className="min-w-0 flex-1">
                    <EditableText
                      value={c.name}
                      className="font-semibold"
                      inputClassName="field py-1 text-[14px] font-semibold"
                      onSave={(name) => renameCategory(c.id, name)}
                    />
                    <div className="mt-1">
                      <Select
                        value={c.kind}
                        onValueChange={(v) =>
                          void setCategoryKind(c.id, v as FinanceCategory["kind"])
                        }
                        options={KIND_OPTIONS}
                        ariaLabel="Тип категории"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-[14px] font-bold text-[var(--behind)]"
                    disabled={busy}
                    onClick={() => void removeCategory(c.id, c.name)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <form onSubmit={addCategory} className="flex flex-wrap gap-2 border-t border-[var(--line)] pt-3">
              <input
                className="field min-w-0 flex-1"
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                placeholder="Новая категория"
              />
              <Select
                value={newKind}
                onValueChange={(v) => setNewKind(v as FinanceCategory["kind"])}
                options={KIND_OPTIONS}
                ariaLabel="Тип новой категории"
              />
              <button type="submit" className="btn btn-primary" disabled={busy}>
                +
              </button>
            </form>
          </section>
        </div>

        <div className="span-12">
          <section className="panel rise-in">
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
                  const color = cat?.color ?? "#a855f7";
                  const label = cat?.name ?? KIND_LABEL[tx.type];
                  const sign = tx.type === "income" || tx.type === "savings" ? "+" : "−";
                  return (
                    <li key={tx.id} className="signal-row row-in">
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
    </div>
  );
}
