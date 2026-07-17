import { NextResponse } from "next/server";
import { id, now } from "@/lib/id";
import { normalizeHashtag } from "@/lib/format";
import { getStore, updateStore } from "@/lib/store";
import type { WishBlock, WishBucket, WishItem } from "@/lib/types";

export async function GET(request: Request) {
  const store = await getStore();
  const q = new URL(request.url).searchParams.get("q")?.toLowerCase() ?? "";
  const showArchived = new URL(request.url).searchParams.get("archived") === "1";
  let blocks = (store.wishBlocks ?? []).filter((b) => (showArchived ? b.archived : !b.archived));
  if (q) {
    const tag = normalizeHashtag(q);
    blocks = blocks.filter(
      (b) =>
        b.hashtag.includes(tag) ||
        b.items.some((i) => i.title.toLowerCase().includes(q) || (i.description ?? "").toLowerCase().includes(q))
    );
  }
  return NextResponse.json({ blocks });
}

export async function POST(request: Request) {
  const body = await request.json();
  const action = String(body.action ?? "createBlock");

  if (action === "createBlock") {
    const hashtag = normalizeHashtag(String(body.hashtag ?? ""));
    const bucket = (body.bucket as WishBucket) ?? "material";
    if (!hashtag) return NextResponse.json({ error: "hashtag" }, { status: 400 });
    const store = await updateStore((s) => {
      if (!s.wishBlocks) s.wishBlocks = [];
      const existing = s.wishBlocks.find((b) => b.hashtag === hashtag && !b.archived);
      if (existing) return;
      const t = now();
      const nodeId = id();
      s.nodes.unshift({
        id: nodeId,
        kind: "wish",
        title: `#${hashtag}`,
        metadata: { bucket },
        salience: 0.7,
        createdAt: t,
        updatedAt: t,
      });
      const block: WishBlock = {
        id: id(),
        hashtag,
        bucket,
        nodeId,
        items: [],
        createdAt: t,
      };
      s.wishBlocks.unshift(block);
    });
    const created = store.wishBlocks.find((b) => b.hashtag === hashtag && !b.archived);
    return NextResponse.json({ blocks: store.wishBlocks.filter((b) => !b.archived), block: created });
  }

  if (action === "addItem") {
    const blockId = String(body.blockId ?? "");
    const title = String(body.title ?? "").trim();
    if (!blockId || !title) return NextResponse.json({ error: "fields" }, { status: 400 });
    const store = await updateStore((s) => {
      const b = s.wishBlocks.find((x) => x.id === blockId);
      if (!b) return;
      const item: WishItem = {
        id: id(),
        title,
        description: body.description ? String(body.description) : undefined,
        photoDataUrl: body.photoDataUrl ? String(body.photoDataUrl) : undefined,
        done: false,
      };
      b.items.push(item);
    });
    return NextResponse.json({ blocks: store.wishBlocks });
  }

  if (action === "toggleItem") {
    const store = await updateStore((s) => {
      const b = s.wishBlocks.find((x) => x.id === body.blockId);
      const item = b?.items.find((i) => i.id === body.itemId);
      if (item) item.done = Boolean(body.done ?? !item.done);
    });
    return NextResponse.json({ blocks: store.wishBlocks });
  }

  if (action === "updateItem") {
    const store = await updateStore((s) => {
      const b = s.wishBlocks.find((x) => x.id === body.blockId);
      const item = b?.items.find((i) => i.id === body.itemId);
      if (!item) return;
      if (body.title != null) item.title = String(body.title);
      if (body.description !== undefined) item.description = body.description || undefined;
      if (body.photoDataUrl !== undefined) item.photoDataUrl = body.photoDataUrl || undefined;
    });
    return NextResponse.json({ blocks: store.wishBlocks });
  }

  if (action === "archiveItem") {
    const store = await updateStore((s) => {
      const b = s.wishBlocks.find((x) => x.id === body.blockId);
      const item = b?.items.find((i) => i.id === body.itemId);
      if (item) item.archived = true;
    });
    return NextResponse.json({ blocks: store.wishBlocks });
  }

  if (action === "deleteItem") {
    const store = await updateStore((s) => {
      const b = s.wishBlocks.find((x) => x.id === body.blockId);
      if (!b) return;
      b.items = b.items.filter((i) => i.id !== body.itemId);
    });
    return NextResponse.json({ blocks: store.wishBlocks });
  }

  if (action === "archiveBlock") {
    const store = await updateStore((s) => {
      const b = s.wishBlocks.find((x) => x.id === body.id);
      if (b) b.archived = true;
    });
    return NextResponse.json({ blocks: store.wishBlocks.filter((b) => !b.archived) });
  }

  if (action === "deleteBlock") {
    const store = await updateStore((s) => {
      s.wishBlocks = s.wishBlocks.filter((x) => x.id !== body.id);
    });
    return NextResponse.json({ blocks: store.wishBlocks.filter((b) => !b.archived) });
  }

  if (action === "renameBlock") {
    const store = await updateStore((s) => {
      const b = s.wishBlocks.find((x) => x.id === body.id);
      if (!b) return;
      const hashtag = normalizeHashtag(String(body.hashtag ?? ""));
      if (hashtag) b.hashtag = hashtag;
    });
    return NextResponse.json({ blocks: store.wishBlocks.filter((b) => !b.archived) });
  }

  return NextResponse.json({ error: "unknown" }, { status: 400 });
}
