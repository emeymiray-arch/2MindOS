"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ActionMode, ActionOption, PageToolbar } from "@/components/ui/PageToolbar";
import type { WishBlock, WishBucket } from "@/lib/types";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function WishesPage() {
  const [blocks, setBlocks] = useState<WishBlock[]>([]);
  const [q, setQ] = useState("");
  const [hashtag, setHashtag] = useState("");
  const [bucket, setBucket] = useState<WishBucket>("material");
  const [addFor, setAddFor] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", description: "", photoDataUrl: "" });
  const [mode, setMode] = useState<ActionMode>(null);
  const [edit, setEdit] = useState<{
    kind: "block" | "item";
    blockId: string;
    itemId?: string;
    title: string;
    description: string;
    photoDataUrl: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (query = "") => {
    const res = await fetch(`/api/wishes?q=${encodeURIComponent(query)}`);
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
      if (!result.ok && result.error) setError(result.error);
      await load(q);
    } catch {
      setError("Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  }

  const options: ActionOption[] = useMemo(() => {
    const list: ActionOption[] = [];
    for (const b of blocks) {
      list.push({ id: `block:${b.id}`, label: `#${b.hashtag}`, group: "Блок" });
      for (const item of b.items.filter((i) => !i.archived)) {
        list.push({ id: `item:${b.id}:${item.id}`, label: item.title, group: `#${b.hashtag}` });
      }
    }
    return list;
  }, [blocks]);

  async function onPick(id: string, action: Exclude<ActionMode, null>) {
    if (id.startsWith("block:")) {
      const blockId = id.slice(6);
      const b = blocks.find((x) => x.id === blockId);
      if (!b) return;
      if (action === "edit") {
        setEdit({
          kind: "block",
          blockId,
          title: b.hashtag,
          description: "",
          photoDataUrl: "",
        });
        setMode(null);
        return;
      }
      if (action === "archive") await post({ action: "archiveBlock", id: blockId });
      else await post({ action: "deleteBlock", id: blockId });
      setMode(null);
      return;
    }
    if (id.startsWith("item:")) {
      const [, blockId, itemId] = id.split(":");
      const b = blocks.find((x) => x.id === blockId);
      const item = b?.items.find((i) => i.id === itemId);
      if (!b || !item) return;
      if (action === "edit") {
        setEdit({
          kind: "item",
          blockId,
          itemId,
          title: item.title,
          description: item.description ?? "",
          photoDataUrl: item.photoDataUrl ?? "",
        });
        setMode(null);
        return;
      }
      if (action === "archive") await post({ action: "archiveItem", blockId, itemId });
      else await post({ action: "deleteItem", blockId, itemId });
      setMode(null);
    }
  }

  return (
    <div className="fade-in mx-auto max-w-3xl space-y-5 pb-8">
      <h1 className="font-display text-3xl">Wish list</h1>

      {error && <p className="text-[13px] text-[var(--bad)]">{error}</p>}

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") load(q);
        }}
      />

      <div className="card flex flex-wrap gap-2 p-3">
        <input
          className="min-w-[120px] flex-1"
          value={hashtag}
          disabled={busy}
          onChange={(e) => setHashtag(e.target.value)}
        />
        <select value={bucket} disabled={busy} onChange={(e) => setBucket(e.target.value as WishBucket)}>
          <option value="skill">навыки</option>
          <option value="plans">планы</option>
          <option value="material">материальное</option>
        </select>
        <button
          type="button"
          className="btn btn-ink"
          disabled={busy}
          onClick={() => {
            if (!hashtag.trim()) {
              setError("Укажите хештег");
              return;
            }
            post({ action: "createBlock", hashtag, bucket });
            setHashtag("");
          }}
        >
          +
        </button>
      </div>

      <div className="space-y-3">
        {blocks.map((b) => (
          <article key={b.id} className="card p-5">
            <div className="flex items-start justify-between gap-2">
              <h2 className="item-title text-[18px]">#{b.hashtag}</h2>
              <button
                type="button"
                className="icon-btn shrink-0"
                onClick={() => {
                  setAddFor(b.id);
                  setDraft({ title: "", description: "", photoDataUrl: "" });
                }}
              >
                +
              </button>
            </div>

            <ul className="mt-3 space-y-1">
              {b.items
                .filter((i) => !i.archived)
                .map((item) => (
                  <li key={item.id} className="task-row !px-1">
                    <button
                      type="button"
                      className={`check ${item.done ? "check-on" : "check-off"}`}
                      disabled={busy}
                      onClick={() =>
                        post({
                          action: "toggleItem",
                          blockId: b.id,
                          itemId: item.id,
                          done: !item.done,
                        })
                      }
                    >
                      {item.done ? "✓" : "×"}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="item-title">{item.title}</p>
                      {item.description && (
                        <p className="meta-quiet mt-0.5">{item.description}</p>
                      )}
                      {item.photoDataUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.photoDataUrl}
                          alt=""
                          className="mt-2 max-h-36 rounded-[16px] object-cover"
                        />
                      )}
                    </div>
                  </li>
                ))}
            </ul>

            {addFor === b.id && (
              <div className="mt-3 space-y-2">
                <input
                  value={draft.title}
                  autoFocus
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
                <textarea
                  rows={2}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const photoDataUrl = await readFileAsDataUrl(file);
                    setDraft((d) => ({ ...d, photoDataUrl }));
                  }}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-ink"
                    onClick={() => {
                      if (!draft.title.trim()) return;
                      post({
                        action: "addItem",
                        blockId: b.id,
                        title: draft.title,
                        description: draft.description || undefined,
                        photoDataUrl: draft.photoDataUrl || undefined,
                      });
                      setDraft({ title: "", description: "", photoDataUrl: "" });
                      setAddFor(null);
                    }}
                  >
                    +
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setAddFor(null)}>
                    ×
                  </button>
                </div>
              </div>
            )}
          </article>
        ))}
      </div>

      {edit && (
        <div className="edit-sheet">
          <input
            value={edit.title}
            autoFocus
            onChange={(e) => setEdit({ ...edit, title: e.target.value })}
          />
          {edit.kind === "item" && (
            <>
              <textarea
                rows={2}
                value={edit.description}
                onChange={(e) => setEdit({ ...edit, description: e.target.value })}
              />
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const photoDataUrl = await readFileAsDataUrl(file);
                  setEdit({ ...edit, photoDataUrl });
                }}
              />
            </>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-ink"
              onClick={async () => {
                if (edit.kind === "block") {
                  await post({ action: "renameBlock", id: edit.blockId, hashtag: edit.title });
                } else {
                  await post({
                    action: "updateItem",
                    blockId: edit.blockId,
                    itemId: edit.itemId,
                    title: edit.title,
                    description: edit.description || undefined,
                    photoDataUrl: edit.photoDataUrl || undefined,
                  });
                }
                setEdit(null);
              }}
            >
              +
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setEdit(null)}>
              ×
            </button>
          </div>
        </div>
      )}

      <PageToolbar
        mode={mode}
        onMode={(m) => {
          setMode(m);
          setEdit(null);
        }}
        options={options}
        onPick={onPick}
      />
    </div>
  );
}
