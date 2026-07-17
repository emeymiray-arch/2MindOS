"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { LifeEdge, LifeNode, Sphere } from "@/lib/types";

interface GraphPayload {
  nodes: LifeNode[];
  edges: LifeEdge[];
  spheres: Sphere[];
}

interface SimNode extends LifeNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/* Soft Studio canvas — Apple */
const CANVAS = {
  bg: "#F2F2F7",
  edgeDim: "rgba(28, 28, 30, 0.15)",
  edgeBright: "rgba(28, 28, 30, 0.35)",
  nodeDefault: "#1C1C1E",
  nodeActive: "#FF3B30",
  label: "#1C1C1E",
};

export function LifeGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [data, setData] = useState<GraphPayload | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<string>("all");
  const simRef = useRef<SimNode[]>([]);
  const edgesRef = useRef<LifeEdge[]>([]);

  const load = useCallback(async (focusId?: string | null) => {
    const q = focusId ? `?focus=${focusId}` : "";
    const res = await fetch(`/api/graph${q}`);
    setData(await res.json());
  }, []);

  useEffect(() => {
    load(focus);
  }, [load, focus]);

  const filteredNodes = useMemo(() => {
    if (!data) return [];
    if (kindFilter === "all") return data.nodes;
    return data.nodes.filter((n) => n.kind === kindFilter);
  }, [data, kindFilter]);

  useEffect(() => {
    if (!data) return;
    const w = 900;
    const h = 560;
    const ids = new Set(filteredNodes.map((n) => n.id));
    simRef.current = filteredNodes.map((n, i) => {
      const angle = (i / Math.max(filteredNodes.length, 1)) * Math.PI * 2;
      const r = 120 + (1 - n.salience) * 160;
      return {
        ...n,
        x: w / 2 + Math.cos(angle) * r,
        y: h / 2 + Math.sin(angle) * r,
        vx: 0,
        vy: 0,
      };
    });
    edgesRef.current = data.edges.filter(
      (e) => ids.has(e.sourceId) && ids.has(e.targetId)
    );
  }, [data, filteredNodes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let timer = 0;
    let settled = false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const nodeIndex = new Map<string, SimNode>();

    function resize() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      settled = false;
    }
    resize();
    window.addEventListener("resize", resize);

    function draw() {
      if (!canvas || !ctx) return;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const nodes = simRef.current;
      const edges = edgesRef.current;

      nodeIndex.clear();
      for (const n of nodes) nodeIndex.set(n.id, n);

      if (!settled) {
        let energy = 0;
        const nCount = nodes.length;
        const step = nCount > 40 ? 2 : 1;
        for (let i = 0; i < nCount; i += step) {
          for (let j = i + 1; j < nCount; j += step) {
            const a = nodes[i];
            const b = nodes[j];
            let dx = a.x - b.x;
            let dy = a.y - b.y;
            const dist = Math.hypot(dx, dy) || 1;
            const force = 700 / (dist * dist);
            dx = (dx / dist) * force;
            dy = (dy / dist) * force;
            a.vx += dx;
            a.vy += dy;
            b.vx -= dx;
            b.vy -= dy;
          }
        }

        for (const e of edges) {
          const a = nodeIndex.get(e.sourceId);
          const b = nodeIndex.get(e.targetId);
          if (!a || !b) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 1;
          const target = 110 + (1 - e.confidence) * 40;
          const f = (dist - target) * 0.012 * e.weight;
          a.vx += (dx / dist) * f;
          a.vy += (dy / dist) * f;
          b.vx -= (dx / dist) * f;
          b.vy -= (dy / dist) * f;
        }

        for (const n of nodes) {
          n.vx += (w / 2 - n.x) * 0.002;
          n.vy += (h / 2 - n.y) * 0.002;
          n.vx *= 0.84;
          n.vy *= 0.84;
          n.x += n.vx;
          n.y += n.vy;
          n.x = Math.max(24, Math.min(w - 24, n.x));
          n.y = Math.max(24, Math.min(h - 24, n.y));
          energy += Math.abs(n.vx) + Math.abs(n.vy);
        }
        if (energy < 0.35) settled = true;
      }

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = CANVAS.bg;
      ctx.fillRect(0, 0, w, h);

      for (const e of edges) {
        const a = nodeIndex.get(e.sourceId);
        const b = nodeIndex.get(e.targetId);
        if (!a || !b) continue;
        const dim = e.confidence < 0.7;
        ctx.strokeStyle = dim ? CANVAS.edgeDim : CANVAS.edgeBright;
        ctx.lineWidth = dim ? 0.75 : 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      for (const n of nodes) {
        const active = hover === n.id || focus === n.id;
        const r = 3 + n.salience * 4.5;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = active ? CANVAS.nodeActive : CANVAS.nodeDefault;
        ctx.globalAlpha = 0.75 + n.salience * 0.25;
        ctx.fill();
        ctx.globalAlpha = 1;

        if (active || n.salience > 0.75 || nodes.length < 25) {
          ctx.font = "400 12px -apple-system, BlinkMacSystemFont, system-ui";
          ctx.fillStyle = CANVAS.label;
          ctx.globalAlpha = 0.8;
          ctx.fillText(n.title.slice(0, 28), n.x + r + 6, n.y + 3);
          ctx.globalAlpha = 1;
        }
      }

      timer = window.setTimeout(draw, settled ? 400 : 50);
    }

    draw();
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", resize);
    };
  }, [hover, focus, filteredNodes.length]);

  function onClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    let best: SimNode | null = null;
    let bestDist = 16;
    for (const n of simRef.current) {
      const d = Math.hypot(n.x - x, n.y - y);
      if (d < bestDist) {
        best = n;
        bestDist = d;
      }
    }
    if (best) {
      if (e.detail === 2) setFocus(best.id);
      else setHover(best.id);
    }
  }

  function onMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    let found: string | null = null;
    for (const n of simRef.current) {
      if (Math.hypot(n.x - x, n.y - y) < 14) {
        found = n.id;
        break;
      }
    }
    setHover(found);
  }

  const kinds = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.nodes.map((n) => n.kind))).sort();
  }, [data]);

  const selected = simRef.current.find((n) => n.id === (hover || focus));

  return (
    <div className="fade-in mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Graph</p>
          <h1 className="font-display mt-1 text-3xl">Карта жизни</h1>
          <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
            Двойной клик — focus. Indigo узлы, coral — активный.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setFocus(null)} className="btn btn-ghost">
            Вся карта
          </button>
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value)}
            className="rounded-[10px] border border-[var(--line)] bg-white px-3 py-2 text-[13px] outline-none"
          >
            <option value="all">Все виды</option>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card relative overflow-hidden">
        <canvas
          ref={canvasRef}
          className="h-[560px] w-full cursor-crosshair"
          onClick={onClick}
          onMouseMove={onMove}
        />
        {selected && (
          <div className="absolute bottom-4 left-4 right-4 rounded-[12px] border border-[var(--line)] bg-white/95 px-4 py-3 shadow-[var(--shadow)] backdrop-blur md:left-auto md:right-4 md:w-72">
            <p className="eyebrow">{selected.kind}</p>
            <p className="mt-1 text-[16px] font-semibold">{selected.title}</p>
            <Link
              href={`/nodes/${selected.id}`}
              className="mt-2 inline-block text-[13px] font-semibold text-[var(--indigo)]"
            >
              Открыть →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
