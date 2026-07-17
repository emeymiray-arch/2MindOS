import { NextResponse } from "next/server";
import { extractFromText, decaySalience } from "@/lib/extractor";
import { id, now } from "@/lib/id";
import { getStore, updateStore } from "@/lib/store";
import type { Capture } from "@/lib/types";

export async function GET() {
  const store = await getStore();
  return NextResponse.json({
    captures: store.captures.slice(0, 30),
    nodes: store.nodes
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 40),
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const text = String(body.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }

  const store = await updateStore((s) => {
    decaySalience(s);
    const extracted = extractFromText(s, text);
    for (const n of extracted.nodes) s.nodes.unshift(n);
    for (const e of extracted.edges) {
      if (e.confidence >= 0.7) s.edges.push(e);
      else s.edges.push(e); // keep proposals visible in graph with dim styling
    }

    const capture: Capture = {
      id: id(),
      raw: text,
      status: "processed",
      nodeIds: extracted.nodes.map((n) => n.id),
      edgeIds: extracted.edges.map((e) => e.id),
      createdAt: now(),
    };
    s.captures.unshift(capture);

    // bump salience on linked targets
    for (const e of extracted.edges) {
      const target = s.nodes.find((n) => n.id === e.targetId);
      if (target) target.salience = Math.min(1, target.salience + 0.05);
    }
  });

  const latest = store.captures[0];
  const nodes = store.nodes.filter((n) => latest.nodeIds.includes(n.id));
  const edges = store.edges.filter((e) => latest.edgeIds.includes(e.id));

  return NextResponse.json({ capture: latest, nodes, edges });
}
