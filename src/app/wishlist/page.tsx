"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/client-api";
import { EditableText } from "@/components/ui/EditableText";
import { IconCoin, IconHabits, IconTarget, IconWish } from "@/components/ui/Icons";
import { KpiTile, PageHero, WidgetHead } from "@/components/ui/Widgets";
import { toast } from "@/components/ui/Toast";
import type { WishBlock, WishBucket } from "@/lib/types";

type Tab = "material" | "skill" | "custom";

const TABS: { id: Tab; label: string; color: string; tone: "orange" | "violet" | "pink" }[] = [
  { id: "material", label: "Вещи", color: "#fb923c", tone: "orange" },
  { id: "skill", label: "Навыки", color: "#a855f7", tone: "violet" },
  { id: "custom", label: "Свои", color: "#f472b6", tone: "pink" },
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

  const stats = useMemo(() => {
    const active = blocks.filter((b) => !b.archived);
    const items = active.flatMap((b) => b.items.filter((it) => !it.archived));
    const done = items.filter((it) => it.done).length;
    const target = items.reduce((s, it) => s + (it.targetAmount ?? 0), 0);
    const saved = items.reduce((s, it) => s + (it.savedToward ?? 0), 0);
    return { categories: active.length, items: items.length, done, target, saved };
  }, [blocks]);

  const tabMeta = TABS.find((t) => t.id === tab) ?? TABS[0];

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

  async function removeItem(blockId: string, itemId: string, title: string) {
    if (!window.confirm(`Удалить «${title}»?`)) return;
    const res = await apiPost("/api/wishes", { action: "deleteItem", blockId, itemId });
    if (!res.ok) {
      toast(res.error ?? "Не удалось удалить", "warn");
      return;
    }
    toast("Удалила", "ok");
    await load();
  }

  async function removeBlock(blockId: string, hashtag: string) {
    if (!window.confirm(`Удалить категорию #${hashtag} и все её пункты?`)) return;
    const res = await apiPost("/api/wishes", { action: "deleteBlock", id: blockId });
    if (!res.ok) {
      toast(res.error ?? "Не удалось удалить", "warn");
      return;
    }
    toast("Категория удалена", "ok");
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

  async function renameBlock(id: string, hashtag: string) {
    const clean = hashtag.trim().replace(/^#/, "");
    if (!clean) return;
    const res = await apiPost("/api/wishes", { action: "renameBlock", id, hashtag: clean });
    if (!res.ok) toast(res.error ?? "Не сохранилось", "warn");
    else await load();
  }

  async function renameItem(blockId: string, itemId: string, title: string) {
    if (!title.trim()) return;
    const res = await apiPost("/api/wishes", {
      action: "updateItem",
      blockId,
      itemId,
      title: title.trim(),
    });
    if (!res.ok) toast(res.error ?? "Не сохранилось", "warn");
    else await load();
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
    <div className="space-y-4">
      <PageHero
        kicker="Wishlist"
        title="Желания"
        lede="Вещи, навыки и свои списки — с копилками."
        meta={TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className="chip-soft"
            data-active={tab === t.id}
            style={
              tab === t.id
                ? { background: `${t.color}33`, color: t.color, borderColor: `${t.color}66` }
                : undefined
            }
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      />

      <div className="bento">
        <div className="span-3">
          <KpiTile
            label="Категории"
            value={stats.categories}
            hint="всего"
            color="#a855f7"
            icon={<IconWish size={18} />}
          />
        </div>
        <div className="span-3">
          <KpiTile
            label="Пункты"
            value={stats.items}
            hint={`${stats.done} готово`}
            color="#38bdf8"
            icon={<IconTarget size={18} />}
          />
        </div>
        <div className="span-3">
          <KpiTile
            label="Цель"
            value={`${money(stats.target)} ₽`}
            hint="сумма цен"
            color="#fb923c"
            icon={<IconCoin size={18} />}
          />
        </div>
        <div className="span-3">
          <KpiTile
            label="Накоплено"
            value={`${money(stats.saved)} ₽`}
            hint={
              stats.target > 0
                ? `${Math.min(100, Math.round((stats.saved / stats.target) * 100))}%`
                : "в копилках"
            }
            color="#34d399"
            icon={<IconHabits size={18} />}
          />
        </div>

        <div className="span-12">
          <form onSubmit={createCategory} className="panel flex flex-wrap items-end gap-3">
            <div className="min-w-[12rem] flex-1">
              <WidgetHead title={`Новая категория · ${tabMeta.label}`} tone={tabMeta.tone} />
              <input
                className="field"
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
            </div>
            <button type="submit" className="btn btn-primary shrink-0">
              + Категория
            </button>
          </form>
        </div>

        {saveFor ? (
          <div className="span-12">
            <form onSubmit={saveToward} className="panel flex flex-wrap items-end gap-3">
              <div className="min-w-[12rem] flex-1">
                <WidgetHead title={`Коплю · ${saveFor.title}`} tone="pink" />
                <input
                  className="field"
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
          </div>
        ) : null}

        {visible.length === 0 ? (
          <div className="span-12">
            <section className="panel">
              <p className="text-[14px] text-[var(--ink-soft)]">Пока пусто — добавь категорию.</p>
            </section>
          </div>
        ) : (
          visible.map((b, i) => {
            const accents = ["#38bdf8", "#34d399", "#fb923c", "#a855f7", "#f472b6"];
            const accent = accents[i % accents.length];
            const items = b.items.filter((it) => !it.archived);
            return (
              <div key={b.id} className="span-6">
                <section className="panel h-full">
                  <WidgetHead
                    title={`#${b.hashtag}`}
                    tone={tabMeta.tone}
                    action={
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="btn"
                          style={{ minHeight: "2rem", padding: "0.35rem 0.7rem" }}
                          onClick={() => setAddFor(addFor === b.id ? null : b.id)}
                        >
                          +
                        </button>
                        <button
                          type="button"
                          className="btn"
                          style={{
                            minHeight: "2rem",
                            padding: "0.35rem 0.7rem",
                            color: "var(--behind)",
                          }}
                          onClick={() => void removeBlock(b.id, b.hashtag)}
                          aria-label="Удалить категорию"
                        >
                          ×
                        </button>
                      </div>
                    }
                  />
                  <div className="mb-2 font-bold" style={{ color: accent }}>
                    <span className="mr-0.5">#</span>
                    <EditableText
                      value={b.hashtag}
                      className="font-bold"
                      inputClassName="field inline-block w-auto min-w-[8rem] py-1 font-bold"
                      onSave={(hashtag) => renameBlock(b.id, hashtag)}
                    />
                  </div>
                  <ul className="space-y-2">
                    {items.map((it) => {
                      const target = it.targetAmount ?? 0;
                      const saved = it.savedToward ?? 0;
                      return (
                        <li key={it.id} className="signal-row">
                          <button
                            type="button"
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white"
                            style={{ background: it.done ? "#34d399" : accent }}
                            onClick={() => void toggleItem(b.id, it.id)}
                            aria-label={it.done ? "Снять" : "Готово"}
                          >
                            {it.done ? "✓" : "◇"}
                          </button>
                          <div className={`min-w-0 flex-1 ${it.done ? "opacity-50" : ""}`}>
                            <EditableText
                              value={it.title}
                              className="font-semibold"
                              inputClassName="field py-1 text-[14px] font-semibold"
                              onSave={(title) => renameItem(b.id, it.id, title)}
                            />
                            {target > 0 ? (
                              <p className="text-[11px] font-semibold" style={{ color: accent }}>
                                {money(saved)} / {money(target)} ₽
                              </p>
                            ) : null}
                          </div>
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
                          <button
                            type="button"
                            className="shrink-0 px-1 text-[16px] font-bold text-[var(--ink-soft)] hover:text-[var(--behind)]"
                            onClick={() => void removeItem(b.id, it.id, it.title)}
                            aria-label="Удалить"
                          >
                            ×
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {addFor === b.id ? (
                    <form
                      className="mt-3 flex flex-wrap gap-2 border-t border-[var(--line)] pt-3"
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
                </section>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
