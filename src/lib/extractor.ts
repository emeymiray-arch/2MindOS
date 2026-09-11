import { id, now } from "./id";
import type { EdgeType, LifeEdge, LifeNode, LifeStore, NodeKind } from "./types";

export interface ExtractResult {
  nodes: LifeNode[];
  edges: LifeEdge[];
  primaryNodeId: string;
}

const PLACE_HINTS = [
  "домбай",
  "москва",
  "дубай",
  "стамбул",
  "париж",
  "горы",
  "море",
  "кафе",
  "ресторан",
];

const PERSON_HINTS = ["с ", "встреч", "подруг", "друг", "мама", "папа", "муж", "жена"];

function detectKind(text: string): NodeKind {
  const lower = text.toLowerCase();
  if (/хочу|мечта|когда-нибудь|wishlist/.test(lower)) return "dream";
  if (/купить|платье|купить|заказ/.test(lower)) return "dream";
  if (/книг|читаю|глава/.test(lower)) return "book";
  if (/привычк|каждый день|streak/.test(lower)) return "habit";
  if (/проект|mvp|запуск/.test(lower)) return "project";
  if (/идея|можно|что если/.test(lower)) return "idea";
  if (/reels|контент|пост|сьём|съём/.test(lower)) return "idea";
  if (PLACE_HINTS.some((p) => lower.includes(p)) || /еду в |в [А-ЯA-Z]/.test(text))
    return "place";
  if (PERSON_HINTS.some((p) => lower.includes(p))) return "person";
  if (/цел[ьи]|к концу|до конца/.test(lower)) return "goal";
  return "thought";
}

function titleFrom(text: string): string {
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (cleaned.length <= 80) return cleaned;
  return `${cleaned.slice(0, 77)}…`;
}

function findSphereId(store: LifeStore, kind: NodeKind, text: string): string | undefined {
  const lower = text.toLowerCase();
  const bySlug = (slug: string) => store.spheres.find((s) => s.slug === slug)?.id;

  if (/коран|намаз|таджвид/.test(lower)) return bySlug("tajweed") ?? bySlug("quran");
  if (/английск|english/.test(lower)) return bySlug("english");
  if (/код|программ|typescript|next/.test(lower)) return bySlug("programming");
  if (/здоров|сон|вод|позвоноч/.test(lower)) return bySlug("health");
  if (/деньг|финанс|доход|расход/.test(lower)) return bySlug("finance");
  if (/ресторан|меню|qsr/.test(lower)) return bySlug("restaurant");
  if (/ai|ии|нейро|агент|2mind/.test(lower)) return bySlug("ai-company");
  if (/книг|читаю|литератур/.test(lower)) return bySlug("reading");
  if (kind === "dream" || /фотосесс|путеше|домбай|горы/.test(lower)) return bySlug("dreams");
  if (kind === "habit") return bySlug("habits");
  return bySlug("knowledge");
}

function suggestEdgeType(a: NodeKind, b: NodeKind, text: string): EdgeType {
  const lower = text.toLowerCase();
  if (a === "dream" && b === "place") return "leads_to";
  if (a === "place" && (b === "dream" || b === "idea")) return "leads_to";
  if (/reels|контент/.test(lower)) return "part_of";
  if (a === "thought" && b !== "thought") return "mentions";
  if (a === "idea" && b === "project") return "supports";
  return "leads_to";
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function similarity(a: string, b: string): number {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter += 1;
  return inter / Math.sqrt(ta.size * tb.size);
}

/** Rule-based extractor — works offline; AI can enrich later. */
export function extractFromText(store: LifeStore, raw: string): ExtractResult {
  const text = raw.trim();
  const t = now();
  const kind = detectKind(text);
  const primary: LifeNode = {
    id: id(),
    kind,
    title: titleFrom(text),
    body: text,
    sphereId: findSphereId(store, kind, text),
    metadata: { source: "capture" },
    salience: 0.85,
    createdAt: t,
    updatedAt: t,
  };

  const nodes: LifeNode[] = [primary];
  const edges: LifeEdge[] = [];

  // Extract nested entities from compound thoughts
  const placeMatch = text.match(/(?:в|во|на)\s+([А-ЯЁA-Z][\p{L}-]+)/u);
  if (placeMatch && kind !== "place") {
    const placeTitle = placeMatch[1];
    const placeNode: LifeNode = {
      id: id(),
      kind: "place",
      title: placeTitle,
      body: `Упомянуто в: ${text}`,
      sphereId: findSphereId(store, "place", placeTitle),
      metadata: { extracted: true },
      salience: 0.7,
      createdAt: t,
      updatedAt: t,
    };
    nodes.push(placeNode);
    edges.push({
      id: id(),
      sourceId: primary.id,
      targetId: placeNode.id,
      type: "mentions",
      weight: 1,
      provenance: "rule",
      confidence: 0.86,
      createdAt: t,
    });
  }

  // Link to similar existing nodes
  const candidates = store.nodes
    .map((n) => ({
      node: n,
      score: Math.max(
        similarity(text, n.title),
        similarity(text, n.body ?? ""),
        thematicBoost(text, n)
      ),
    }))
    .filter((c) => c.score >= 0.28)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  for (const c of candidates) {
    if (c.node.id === primary.id) continue;
    const confidence = Math.min(0.95, 0.55 + c.score);
    if (confidence < 0.7) {
      // still create as suggestion-level edge but mark lower confidence
    }
    edges.push({
      id: id(),
      sourceId: primary.id,
      targetId: c.node.id,
      type: suggestEdgeType(primary.kind, c.node.kind, text),
      weight: c.score,
      provenance: "rule",
      confidence,
      createdAt: t,
    });
  }

  // Cluster logic: dreams/travel/content chain
  if (/фотосесс|съём|сьем/.test(text.toLowerCase())) {
    linkToTitle(store, edges, primary, ["Домбай", "Контент", "Reels", "платье"], t);
  }
  if (/домбай/.test(text.toLowerCase())) {
    linkToTitle(store, edges, primary, ["фотосесс", "платье", "Reels", "Контент"], t);
  }
  if (/платье/.test(text.toLowerCase())) {
    linkToTitle(store, edges, primary, ["фотосесс", "Домбай", "Reels"], t);
  }
  if (/reels/.test(text.toLowerCase())) {
    linkToTitle(store, edges, primary, ["Контент", "фотосесс", "Домбай"], t);
  }
  if (/контент/.test(text.toLowerCase())) {
    linkToTitle(store, edges, primary, ["Reels", "фотосесс"], t);
  }

  return { nodes, edges, primaryNodeId: primary.id };
}

function thematicBoost(text: string, node: LifeNode): number {
  const lower = text.toLowerCase();
  const title = node.title.toLowerCase();
  const pairs: [RegExp, RegExp][] = [
    [/фотосесс|горы|домбай/, /фотосесс|домбай|горы|платье|reels|контент/],
    [/ai|2mind|жизн/, /ai|2mind|компани|граф/],
    [/сон|вод|здоров/, /сон|вод|здоров|намаз/],
  ];
  for (const [a, b] of pairs) {
    if (a.test(lower) && b.test(title)) return 0.55;
  }
  return 0;
}

function linkToTitle(
  store: LifeStore,
  edges: LifeEdge[],
  primary: LifeNode,
  needles: string[],
  t: string
) {
  for (const needle of needles) {
    const target = store.nodes.find((n) =>
      n.title.toLowerCase().includes(needle.toLowerCase())
    );
    if (!target) continue;
    if (edges.some((e) => e.targetId === target.id && e.sourceId === primary.id)) continue;
    edges.push({
      id: id(),
      sourceId: primary.id,
      targetId: target.id,
      type: "leads_to",
      weight: 0.9,
      provenance: "rule",
      confidence: 0.84,
      createdAt: t,
    });
  }
}

export function decaySalience(store: LifeStore): void {
  const nowMs = Date.now();
  for (const node of store.nodes) {
    const ageDays = (nowMs - new Date(node.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    const decay = Math.exp(-ageDays / 45);
    node.salience = Math.max(0.05, node.salience * 0.998 * (0.7 + 0.3 * decay));
  }
}
