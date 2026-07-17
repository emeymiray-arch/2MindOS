import { NextResponse } from "next/server";
import { id, now } from "@/lib/id";
import { maskPassword } from "@/lib/sanitize";
import { getStore, updateStore } from "@/lib/store";
import type { PasswordEntry } from "@/lib/types";

function list(store: Awaited<ReturnType<typeof getStore>>, q: string) {
  let items = (store.passwords ?? []).filter((p) => !p.archived);
  if (q) {
    items = items.filter(
      (p) =>
        p.projectName.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q) ||
        (p.username ?? "").toLowerCase().includes(q) ||
        (p.url ?? "").toLowerCase().includes(q) ||
        (p.notes ?? "").toLowerCase().includes(q)
    );
  }
  return items.map(maskPassword);
}

export async function GET(request: Request) {
  const store = await getStore();
  const q = new URL(request.url).searchParams.get("q")?.toLowerCase() ?? "";
  return NextResponse.json({ passwords: list(store, q) });
}

export async function POST(request: Request) {
  const body = await request.json();
  const action = String(body.action ?? "create");
  const q = "";

  if (action === "reveal") {
    const store = await getStore();
    const p = store.passwords.find((x) => x.id === body.id && !x.archived);
    if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ id: p.id, secret: p.secret });
  }

  if (action === "create") {
    const projectName = String(body.projectName ?? "").trim();
    const title = String(body.title ?? "").trim();
    const secret = String(body.secret ?? "");
    if (!projectName || !title || !secret) {
      return NextResponse.json({ error: "fields" }, { status: 400 });
    }
    const store = await updateStore((s) => {
      const t = now();
      const row: PasswordEntry = {
        id: id(),
        projectName,
        title,
        username: body.username ? String(body.username) : undefined,
        secret,
        url: body.url ? String(body.url) : undefined,
        notes: body.notes ? String(body.notes) : undefined,
        createdAt: t,
        updatedAt: t,
      };
      s.passwords.unshift(row);
    });
    return NextResponse.json({ passwords: list(store, q) });
  }

  if (action === "update") {
    const store = await updateStore((s) => {
      const p = s.passwords.find((x) => x.id === body.id);
      if (!p) return;
      if (body.projectName != null) p.projectName = String(body.projectName);
      if (body.title != null) p.title = String(body.title);
      if (body.username !== undefined) p.username = body.username || undefined;
      if (body.secret != null && String(body.secret) && !String(body.secret).startsWith("••••")) {
        p.secret = String(body.secret);
      }
      if (body.url !== undefined) p.url = body.url || undefined;
      if (body.notes !== undefined) p.notes = body.notes || undefined;
      p.updatedAt = now();
    });
    return NextResponse.json({ passwords: list(store, q) });
  }

  if (action === "delete") {
    const store = await updateStore((s) => {
      s.passwords = s.passwords.filter((x) => x.id !== body.id);
    });
    return NextResponse.json({ passwords: list(store, q) });
  }

  if (action === "archive") {
    const store = await updateStore((s) => {
      const p = s.passwords.find((x) => x.id === body.id);
      if (p) p.archived = true;
    });
    return NextResponse.json({ passwords: list(store, q) });
  }

  return NextResponse.json({ error: "unknown" }, { status: 400 });
}
