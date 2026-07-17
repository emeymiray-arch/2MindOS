import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export async function GET(request: Request) {
  const store = await getStore();
  const { searchParams } = new URL(request.url);
  const focus = searchParams.get("focus");
  const minConfidence = Number(searchParams.get("minConfidence") ?? "0");

  let nodes = store.nodes;
  let edges = store.edges.filter((e) => e.confidence >= minConfidence);

  if (focus) {
    const ids = new Set<string>([focus]);
    for (const e of store.edges) {
      if (e.sourceId === focus || e.targetId === focus) {
        ids.add(e.sourceId);
        ids.add(e.targetId);
      }
    }
    nodes = store.nodes.filter((n) => ids.has(n.id));
    edges = edges.filter((e) => ids.has(e.sourceId) && ids.has(e.targetId));
  }

  return NextResponse.json({
    nodes,
    edges,
    spheres: store.spheres,
  });
}
