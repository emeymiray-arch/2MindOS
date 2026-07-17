import { NextResponse } from "next/server";
import { neighborhood } from "@/lib/linker";
import { getStore } from "@/lib/store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const store = await getStore();
  const node = store.nodes.find((n) => n.id === id);
  if (!node) return NextResponse.json({ error: "not found" }, { status: 404 });

  const graph = neighborhood(store, id, 2);
  const sphere = store.spheres.find((s) => s.id === node.sphereId);
  const project = store.projects.find((p) => p.nodeId === id);
  const goal = store.goals.find((g) => g.nodeId === id);
  const habit = store.habits.find((h) => h.nodeId === id);
  const book = store.books.find((b) => b.nodeId === id);
  const skill = store.skills.find((s) => s.nodeId === id);
  const wish = store.wishBlocks?.find((w) => w.nodeId === id);

  return NextResponse.json({
    node,
    sphere,
    neighborhood: graph,
    project,
    goal,
    habit,
    book,
    skill,
    wish,
  });
}
