import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const store = await getStore();
  const project = store.projects.find((p) => p.id === id || p.nodeId === id);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });
  const node = store.nodes.find((n) => n.id === project.nodeId);
  const relatedEdges = store.edges.filter(
    (e) => e.sourceId === project.nodeId || e.targetId === project.nodeId
  );
  const relatedNodes = store.nodes.filter((n) =>
    relatedEdges.some((e) => e.sourceId === n.id || e.targetId === n.id)
  );
  return NextResponse.json({ project, node, relatedNodes, relatedEdges });
}
