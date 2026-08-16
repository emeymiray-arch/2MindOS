"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ActionMode, ActionOption, PageToolbar } from "@/components/ui/PageToolbar";
import type { WishBlock, WishBucket } from "@/lib/types";

const TABS: { id: WishBucket; label: string }[] = [
  { id: "shopping", label: "Покупки" },
  { id: "wishlist", label: "Wishlist" },
  { id: "ideas", label: "Идеи" },
  { id: "someday", label: "Когда-нибудь" },
];

export default function ThingsPage() {
  const [blocks, setBlocks] = useState<WishBlock[]>([]);
  const [tab, setTab] = useState<WishBucket>("shopping");
  const [hashtag, setHashtag] = useState("");
  const [itemTitle, setItemTitle] = useState("");
  const [addFor, setAddFor] = useState<string | null>(null);
  const [mode, setMode] = useState<ActionMode>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/wishes");
    const data = await res.json();
    setBlocks(data.blocks ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const { apiPost } = await import("@/lib/client-api");
      const result = await apiPost("/api/wishes", body);
      if (!result.ok && result.error) setError(String(result.error));
      await load();
    } catch {
      setError("Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  }

  const visible = useMemo(
    () =>
      blocks.filter((b) => {
        const bucket = b.bucket === "material" ? "shopping" : b.bucket === "plans" ? "wishlist" : b.bucket === "skill" ? "ideas" : b.bucket;
        return !b.archived && bucket === tab;
      }),
    [blocks, tab]
  );

  const options: ActionOption[] = useMemo(() => {
    const list: ActionOption[] = [];
    for (const b of visible) {
      list.push({ id: `block:${b.id}`, label: b.hashtag, group: "List" });
      for (const it of b.items.filter((i) => !i.archived)) {
        list.push({ id: `item:${b.id}:${it.id}`, label: it.title, group: b.hashtag });
      }
    }
    return list;
  }, [visible]);

  return (
    <div className="fade-in mx-auto max-w-2xl space-y-10 pb-16">
      <header className="space-y-2">
        <h1 className="font-display text-3xl">Вещи</h1>
        <p className="text-[13px] text-[var(--ink-faint)]">Покупки и идеи — отдельно от целей.</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`chip ${tab === t.id ? "chip-on" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? <p className="text-[13px] text-[var(--ink-soft)]">{error}</p> : null}

      <div className="card flex gap-2 p-4">
        <input
          className="min-w-0 flex-1"
          value={hashtag}
          placeholder="Список / тег"
          disabled={busy}
          onChange={(e) => setHashtag(e.target.value)}
        />
        <button
          type="button"
          className="btn btn-ink"
          disabled={busy || !hashtag.trim()}
          onClick={() => {
            post({ action: "createBlock", hashtag: hashtag.trim(), bucket: tab });
            setHashtag("");
          }}
        >
          +
        </button>
      </div>

      <div className="space-y-3">
        {visible.map((b) => (
          <section key={b.id} className="card space-y-2 p-4">
            <p className="font-semibold">#{b.hashtag}</p>
            <ul className="space-y-2">
              {b.items
                .filter((i) => !i.archived)
                .map((it) => (
                  <li key={it.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      className={`check ${it.done ? "check-on" : "check-off"}`}
                      disabled={busy}
                      onClick={() =>
                        post({
                          action: "toggleItem",
                          blockId: b.id,
                          itemId: it.id,
                          done: !it.done,
                        })
                      }
                    >
                      {it.done ? "✓" : "×"}
                    </button>
                    <span className="text-[14px]">{it.title}</span>
                  </li>
                ))}
            </ul>
            {addFor === b.id ? (
              <div className="flex gap-2">
                <input
                  className="min-w-0 flex-1"
                  value={itemTitle}
                  onChange={(e) => setItemTitle(e.target.value)}
                  placeholder="Item"
                />
                <button
                  type="button"
                  className="btn btn-ink"
                  disabled={busy || !itemTitle.trim()}
                  onClick={() => {
                    post({
                      action: "addItem",
                      blockId: b.id,
                      title: itemTitle.trim(),
                    });
                    setItemTitle("");
                    setAddFor(null);
                  }}
                >
                  +
                </button>
              </div>
            ) : (
              <button type="button" className="btn btn-ghost text-[12px]" onClick={() => setAddFor(b.id)}>
                + item
              </button>
            )}
          </section>
        ))}
      </div>

      <PageToolbar
        mode={mode}
        onMode={setMode}
        options={options}
        onPick={async (id, action) => {
          if (id.startsWith("block:")) {
            const blockId = id.slice(6);
            if (action === "archive") await post({ action: "archiveBlock", id: blockId });
            else if (action === "delete") await post({ action: "deleteBlock", id: blockId });
          } else if (id.startsWith("item:")) {
            const [, blockId, itemId] = id.split(":");
            if (action === "archive") await post({ action: "archiveItem", blockId, itemId });
            else if (action === "delete") await post({ action: "deleteItem", blockId, itemId });
          }
          setMode(null);
        }}
      />
    </div>
  );
}
