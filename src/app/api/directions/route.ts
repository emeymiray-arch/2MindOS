import { NextResponse } from "next/server";
import {
  activeDirections,
  ensureDirectionCatalog,
  ensurePeriodFocus,
  mergeDirections,
  monthKeyFromDate,
  setFocusLevel,
} from "@/lib/directions";
import { id } from "@/lib/id";
import { getStore, updateStore } from "@/lib/store";
import type { LifeLayer, PeriodFocusLevel, PriorityLevel } from "@/lib/types";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const monthKey = url.searchParams.get("month") || monthKeyFromDate();

  const store = await updateStore((s) => {
    ensureDirectionCatalog(s);
    ensurePeriodFocus(s, monthKey);
    if ((s.version ?? 0) < 19) s.version = 19;
  });

  const row = store.periodFocus.find((p) => p.monthKey === monthKey)!;
  const dirs = activeDirections(store).map((d) => ({
    ...d,
    focus: (row.levels[d.id] ?? "background") as PeriodFocusLevel,
    goals: store.goals.filter((g) => g.active && !g.archived && g.lifeAreaId === d.id)
      .length,
  }));

  return NextResponse.json({
    monthKey,
    directions: dirs,
    focus: row,
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "");

  if (action === "create") {
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "name" }, { status: 400 });
    const store = await updateStore((s) => {
      const order = Math.max(0, ...activeDirections(s).map((d) => d.order)) + 1;
      const slug =
        String(body.slug ?? "")
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_]+/g, "_") || `dir_${id().slice(0, 8)}`;
      s.spheres.push({
        id: id(),
        slug,
        name,
        description: body.description ? String(body.description) : undefined,
        order,
        priority: (body.priority as PriorityLevel) || "medium",
        layerBias: (body.layerBias as LifeLayer | "both") || "both",
      });
      ensurePeriodFocus(s);
    });
    return NextResponse.json({ ok: true, directions: activeDirections(store) });
  }

  if (action === "update") {
    const dirId = String(body.id ?? "");
    if (!dirId) return NextResponse.json({ error: "id" }, { status: 400 });
    const store = await updateStore((s) => {
      const d = s.spheres.find((x) => x.id === dirId);
      if (!d) return;
      if (body.name != null) d.name = String(body.name).trim() || d.name;
      if (body.description != null) d.description = String(body.description);
      if (body.order != null) d.order = Number(body.order) || d.order;
      if (body.priority != null) d.priority = body.priority as PriorityLevel;
      if (body.layerBias != null) d.layerBias = body.layerBias as LifeLayer | "both";
      if (body.archived != null) d.archived = Boolean(body.archived);
    });
    return NextResponse.json({ ok: true, directions: activeDirections(store) });
  }

  if (action === "setFocus") {
    const dirId = String(body.id ?? body.directionId ?? "");
    const level = String(body.level ?? "") as PeriodFocusLevel;
    if (!dirId || !["main", "support", "background"].includes(level)) {
      return NextResponse.json({ error: "fields" }, { status: 400 });
    }
    const monthKey = body.monthKey ? String(body.monthKey) : monthKeyFromDate();
    const store = await updateStore((s) => {
      setFocusLevel(s, dirId, level, monthKey);
    });
    const focus = store.periodFocus.find((p) => p.monthKey === monthKey);
    return NextResponse.json({ ok: true, focus });
  }

  if (action === "merge") {
    const keepId = String(body.keepId ?? "");
    const absorbId = String(body.absorbId ?? "");
    if (!keepId || !absorbId) {
      return NextResponse.json({ error: "ids" }, { status: 400 });
    }
    const store = await updateStore((s) => {
      mergeDirections(s, keepId, absorbId);
    });
    return NextResponse.json({ ok: true, directions: activeDirections(store) });
  }

  if (action === "reorder") {
    const ids = Array.isArray(body.ids) ? (body.ids as string[]) : [];
    if (!ids.length) return NextResponse.json({ error: "ids" }, { status: 400 });
    const store = await updateStore((s) => {
      ids.forEach((dirId, i) => {
        const d = s.spheres.find((x) => x.id === dirId);
        if (d) d.order = i + 1;
      });
    });
    return NextResponse.json({ ok: true, directions: activeDirections(store) });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
