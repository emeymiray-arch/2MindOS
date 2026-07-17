import { id, now } from "./id";
import type { LifeEdge, LifeStore } from "./types";

/** Propose additional edges between existing high-salience nodes. */
export function autoLinkPass(store: LifeStore): LifeEdge[] {
  const created: LifeEdge[] = [];
  const recent = [...store.nodes]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 40);

  for (let i = 0; i < recent.length; i++) {
    for (let j = i + 1; j < recent.length; j++) {
      const a = recent[i];
      const b = recent[j];
      if (a.sphereId && b.sphereId && a.sphereId === b.sphereId) {
        const exists = store.edges.some(
          (e) =>
            (e.sourceId === a.id && e.targetId === b.id) ||
            (e.sourceId === b.id && e.targetId === a.id)
        );
        if (exists) continue;
        if (a.kind === "thought" && b.kind === "thought") continue;

        const edge: LifeEdge = {
          id: id(),
          sourceId: a.id,
          targetId: b.id,
          type: "applies_to",
          weight: 0.4,
          provenance: "rule",
          confidence: 0.62,
          createdAt: now(),
        };
        // Only auto-commit high confidence; low ones still returned as proposals
        if (edge.confidence >= 0.7) {
          store.edges.push(edge);
          created.push(edge);
        } else {
          created.push(edge);
        }
      }
    }
  }

  return created;
}

export function neighborhood(store: LifeStore, nodeId: string, depth = 1) {
  const nodeIds = new Set<string>([nodeId]);
  let frontier = [nodeId];

  for (let d = 0; d < depth; d++) {
    const next: string[] = [];
    for (const fid of frontier) {
      for (const e of store.edges) {
        if (e.sourceId === fid && !nodeIds.has(e.targetId)) {
          nodeIds.add(e.targetId);
          next.push(e.targetId);
        }
        if (e.targetId === fid && !nodeIds.has(e.sourceId)) {
          nodeIds.add(e.sourceId);
          next.push(e.sourceId);
        }
      }
    }
    frontier = next;
  }

  const nodes = store.nodes.filter((n) => nodeIds.has(n.id));
  const edges = store.edges.filter(
    (e) => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId)
  );
  return { nodes, edges };
}
