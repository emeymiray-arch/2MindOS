import { NextResponse } from "next/server";
import { extractFromText, decaySalience } from "@/lib/extractor";
import { id, now } from "@/lib/id";
import { getTodayVitals } from "@/lib/oracle";
import { getStore, updateStore } from "@/lib/store";
import type { Capture } from "@/lib/types";

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

async function authorize(request: Request) {
  const store = await getStore();
  const header = request.headers.get("x-shortcuts-token");
  const { searchParams } = new URL(request.url);
  const token = header ?? searchParams.get("token");
  return token && token === store.settings.shortcutsToken;
}

/** Apple Shortcuts entry: POST text capture or vitals action */
export async function POST(request: Request) {
  if (!(await authorize(request))) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "capture");

  if (action === "water") {
    const delta = Number(body.delta ?? 250);
    const store = await updateStore((s) => {
      const v = getTodayVitals(s);
      v.waterMl += delta;
    });
    return NextResponse.json({ ok: true, vitals: getTodayVitals(store) });
  }

  if (action === "prayer") {
    const prayer = String(body.prayer ?? "");
    const store = await updateStore((s) => {
      const v = getTodayVitals(s);
      if (prayer in v.prayers) {
        v.prayers[prayer as keyof typeof v.prayers] = true;
      }
    });
    return NextResponse.json({ ok: true, vitals: getTodayVitals(store) });
  }

  if (action === "sleep") {
    const hours = Number(body.hours ?? 0);
    const store = await updateStore((s) => {
      getTodayVitals(s).sleepHours = hours;
    });
    return NextResponse.json({ ok: true, vitals: getTodayVitals(store) });
  }

  const text = String(body.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }

  const store = await updateStore((s) => {
    decaySalience(s);
    const extracted = extractFromText(s, text);
    for (const n of extracted.nodes) s.nodes.unshift(n);
    for (const e of extracted.edges) s.edges.push(e);
    const capture: Capture = {
      id: id(),
      raw: text,
      status: "processed",
      nodeIds: extracted.nodes.map((n) => n.id),
      edgeIds: extracted.edges.map((e) => e.id),
      createdAt: now(),
    };
    s.captures.unshift(capture);
  });

  return NextResponse.json({
    ok: true,
    capture: store.captures[0],
    linked: store.captures[0].edgeIds.length,
  });
}

export async function GET(request: Request) {
  if (!(await authorize(request))) return unauthorized();
  const store = await getStore();
  return NextResponse.json({
    mit: store.settings.mit,
    vitals: getTodayVitals(store),
    tokenHint: "Use header x-shortcuts-token",
  });
}
