"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/client-api";
import { toast } from "@/components/ui/Toast";
import type { WishBlock, WishBucket } from "@/lib/types";

type Tab = "material" | "skill" | "custom";

const TABS: { id: Tab; label: string; color: string }[] = [
  { id: "material", label: "Вещи", color: "var(--c-orange)" },
  { id: "skill", label: "Навыки", color: "var(--c-violet)" },
  { id: "custom", label: "Свои", color: "var(--c-pink)" },
];

function normalizeBucket(b: WishBucket): Tab {
  if (b === "skill") return "skill";
  if (b === "material" || b === "shopping") return "material";
  return "custom";
}

function money(n: number) {
  return n.toLocaleString("ru-RU");
}

export default function WishlistPage() {
  const [blocks, setBlocks] = useState<WishBlock[]>([]);
  const [tab, setTab] = useState<Tab>("material");
  const [category, setCategory] = useState("");
  const [itemTitle, setItemTitle] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [addFor, setAddFor] = useState<string | null>(null);
  const [saveFor, setSaveFor] = useState<{ blockId: string; itemId: string; title: string } | null>(
    null
  );
  const [saveAmount, setSaveAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await apiGet("/api/wishes");
    if (res.ok) setBlocks((res.data.blocks as WishBlock[]) ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () => blocks.filter((b) => !b.archived && normalizeBucket(b.bucket) === tab),
    [blocks, tab]
  );

  async function createCategory(e: React.FormEvent) {
    e.preventDefault();
    const hashtag = category.trim().replace(/^#/, "");
    if (!hashtag) return;
    const bucket: WishBucket = tab === "skill" ? "skill" : tab === "material" ? "material" : "wishlist";
    const res = await apiPost("/api/wishes", { action: "createBlock", hashtag, bucket });
    if (!res.ok) {
      toast(res.error ?? "Не удалось создать", "warn");
      return;
    }
    setCategory("");
    toast("Категория добавлена", "ok");
    await load();
  }

  async function addItem(blockId: string) {
    const title = itemTitle.trim();
    if (!title) return;
    const price = Number(String(itemPrice).replace(",", "."));
    const res = await apiPost("/api/wishes", {
      action: "addItem",
      blockId,
      title,
      targetAmount: price > 0 ? price : undefined,
    });
    if (!res.ok) {
      toast(res.error ?? "Ошибка", "warn");
      return;
    }
    setItemTitle("");
    setItemPrice("");
    setAddFor(null);
    toast("Добавлено", "ok");
    await load();
  }

  async function toggleItem(blockId: string, itemId: string) {
    await apiPost("/api/wishes", { action: "toggleItem", blockId, itemId });
    await load();
  }

  async function setPrice(blockId: string, itemId: string, raw: string) {
    const n = Number(String(raw).replace(",", "."));
    await apiPost("/api/wishes", {
      action: "updateItem",
      blockId,
      itemId,
      targetAmount: n > 0 ? n : null,
    });
    await load();
  }

  async function saveToward(e: React.FormEvent) {
    e.preventDefault();
    if (!saveFor || busy) return;
    const amount = Number(String(saveAmount).replace(",", "."));
    if (!(amount > 0)) {
      toast("Нужна сумма", "warn");
      return;
    }
    setBusy(true);
    const res = await apiPost("/api/finance", {
      action: "add",
      type: "savings",
      title: `В копилку: ${saveFor.title}`,
      amount,
      wishItemId: saveFor.itemId,
      wishBlockId: saveFor.blockId,
    });
    setBusy(false);
    if (!res.ok) {
      toast(res.error ?? "Не удалось", "warn");
      return;
    }
    setSaveAmount("");
    setSaveFor(null);
    toast("В подушку и к покупке", "ok");
    await load();
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-[34px]">Wishlist</h1>
      </header>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`btn ${tab === t.id ? "btn-primary" : ""}`}
            style={tab === t.id ? { background: t.color, boxShadow: `0 8px 20px ${t.color}44` } : undefined}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={createCategory} className="surface flex gap-2 p-4">
        <input
          className="field min-w-0 flex-1"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder={
            tab === "skill"
              ? "Категория навыка, напр. excel"
              : tab === "material"
                ? "Категория вещей, напр. tech"
                : "Своя категория"
          }
        />
        <button type="submit" className="btn btn-primary shrink-0">
          + Категория
        </button>
      </form>

      {saveFor ? (
        <form onSubmit={saveToward} className="surface flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[12rem] flex-1">
            <p className="text-[13px] font-bold text-[var(--c-pink)]">Коплю на: {saveFor.title}</p>
            <input
              className="field mt-2"
              inputMode="decimal"
              value={saveAmount}
              onChange={(e) => setSaveAmount(e.target.value)}
              placeholder="Сумма в подушку"
              autoFocus
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            Отложить
          </button>
          <button type="button" className="btn" onClick={() => setSaveFor(null)}>
            Отмена
          </button>
        </form>
      ) : null}

      {visible.length === 0 ? (
        <p className="text-[14px] font-semibold text-[var(--accent)]">Пока пусто — добавь категорию.</p>
      ) : (
        <div className="space-y-3">
          {visible.map((b, i) => {
            const accents = ["var(--c-blue)", "var(--c-green)", "var(--c-orange)", "var(--c-violet)", "var(--c-pink)"];
            const accent = accents[i % accents.length];
            return (
              <div
                key={b.id}
                className="surface overflow-hidden"
                style={{ borderLeft: `4px solid ${accent}` }}
              >
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <p className="font-bold" style={{ color: accent }}>
                    #{b.hashtag}
                  </p>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setAddFor(addFor === b.id ? null : b.id)}
                  >
                    +
                  </button>
                </div>
                <div className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
                  {b.items
                    .filter((it) => !it.archived)
                    .map((it) => {
                      const target = it.targetAmount ?? 0;
                      const saved = it.savedToward ?? 0;
                      return (
                        <div key={it.id} className="flex items-center gap-3 px-4 py-3">
                          <button
                            type="button"
                            className="flex min-w-0 flex-1 items-center gap-3 text-left"
                            onClick={() => void toggleItem(b.id, it.id)}
                          >
                            <span
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-black text-white"
                              style={{ background: it.done ? "var(--ahead)" : accent }}
                            >
                              {it.done ? "✓" : "◇"}
                            </span>
                            <span className="min-w-0">
                              <span className={`block font-semibold ${it.done ? "opacity-50" : ""}`}>
                                {it.title}
                              </span>
                              {target > 0 ? (
                                <span className="text-[12px] font-semibold" style={{ color: accent }}>
                                  {money(saved)} / {money(target)} ₽
                                </span>
                              ) : null}
                            </span>
                          </button>
                          {tab === "material" && !it.done ? (
                            <button
                              type="button"
                              className="shrink-0 text-[12px] font-bold"
                              style={{ color: accent }}
                              onClick={() =>
                                setSaveFor({ blockId: b.id, itemId: it.id, title: it.title })
                              }
                            >
                              +коплю
                            </button>
                          ) : null}
                          {tab === "material" && !it.done ? (
                            <input
                              className="field w-[5.5rem] shrink-0 py-1 text-[12px]"
                              inputMode="decimal"
                              defaultValue={target > 0 ? String(target) : ""}
                              placeholder="цена"
                              onBlur={(e) => void setPrice(b.id, it.id, e.target.value)}
                            />
                          ) : null}
                        </div>
                      );
                    })}
                </div>
                {addFor === b.id ? (
                  <form
                    className="flex flex-wrap gap-2 border-t border-[var(--line)] p-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void addItem(b.id);
                    }}
                  >
                    <input
                      className="field min-w-0 flex-1"
                      value={itemTitle}
                      onChange={(e) => setItemTitle(e.target.value)}
                      placeholder="Что добавить"
                      autoFocus
                    />
                    {tab === "material" ? (
                      <input
                        className="field w-[7rem]"
                        inputMode="decimal"
                        value={itemPrice}
                        onChange={(e) => setItemPrice(e.target.value)}
                        placeholder="Цена"
                      />
                    ) : null}
                    <button type="submit" className="btn btn-primary">
                      Ок
                    </button>
                  </form>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
