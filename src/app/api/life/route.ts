import { NextResponse } from "next/server";
import { activeDirections, monthKeyFromDate } from "@/lib/directions";
import { id, todayKey } from "@/lib/id";
import { getStore, updateStore } from "@/lib/store";
import type { LifeLayer, Review } from "@/lib/types";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") || "all";
  const store = await getStore();

  if (kind === "principles") {
    return NextResponse.json({
      principles: (store.principles ?? []).filter((p) => !p.archived),
      directions: activeDirections(store).map((d) => ({ id: d.id, name: d.name })),
      goals: store.goals
        .filter((g) => g.active && !g.archived)
        .map((g) => ({ id: g.id, title: g.title })),
      habits: store.habits
        .filter((h) => h.active && !h.archived)
        .map((h) => ({ id: h.id, title: h.title })),
    });
  }

  if (kind === "outcomes") {
    return NextResponse.json({
      outcomes: (store.outcomes ?? []).filter((o) => !o.archived).slice().reverse(),
      goals: store.goals
        .filter((g) => g.active && !g.archived)
        .map((g) => ({ id: g.id, title: g.title })),
    });
  }

  if (kind === "reviews") {
    return NextResponse.json({
      reviews: (store.reviews ?? []).slice().reverse().slice(0, 40),
    });
  }

  if (kind === "inbox") {
    return NextResponse.json({
      captures: (store.captures ?? []).slice().reverse(),
      directions: activeDirections(store).map((d) => ({ id: d.id, name: d.name })),
      goals: store.goals
        .filter((g) => g.active && !g.archived)
        .map((g) => ({ id: g.id, title: g.title })),
      principles: (store.principles ?? [])
        .filter((p) => !p.archived)
        .map((p) => ({ id: p.id, title: p.title })),
    });
  }

  return NextResponse.json({
    principles: (store.principles ?? []).filter((p) => !p.archived).length,
    outcomes: (store.outcomes ?? []).filter((o) => !o.archived).length,
    reviews: (store.reviews ?? []).length,
    pendingInbox: (store.captures ?? []).filter((c) => c.status === "pending").length,
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "");

  if (action === "createPrinciple") {
    const title = String(body.title ?? "").trim();
    if (!title) return NextResponse.json({ error: "title" }, { status: 400 });
    const store = await updateStore((s) => {
      if (!s.principles) s.principles = [];
      const now = new Date().toISOString();
      s.principles.push({
        id: id(),
        title,
        body: body.body ? String(body.body) : undefined,
        layer: (body.layer as LifeLayer) || "inner",
        lifeAreaId: body.lifeAreaId ? String(body.lifeAreaId) : undefined,
        supportsGoalIds: Array.isArray(body.supportsGoalIds)
          ? body.supportsGoalIds.map(String)
          : [],
        supportsHabitIds: Array.isArray(body.supportsHabitIds)
          ? body.supportsHabitIds.map(String)
          : [],
        createdAt: now,
        updatedAt: now,
      });
    });
    return NextResponse.json({
      ok: true,
      principles: store.principles.filter((p) => !p.archived),
    });
  }

  if (action === "updatePrinciple") {
    const pid = String(body.id ?? "");
    if (!pid) return NextResponse.json({ error: "id" }, { status: 400 });
    const store = await updateStore((s) => {
      const p = (s.principles ?? []).find((x) => x.id === pid);
      if (!p) return;
      if (body.title != null) p.title = String(body.title).trim() || p.title;
      if (body.body != null) p.body = String(body.body);
      if (body.layer != null) p.layer = body.layer as LifeLayer;
      if (body.lifeAreaId != null) p.lifeAreaId = String(body.lifeAreaId) || undefined;
      if (body.archived != null) p.archived = Boolean(body.archived);
      if (Array.isArray(body.supportsGoalIds)) p.supportsGoalIds = body.supportsGoalIds.map(String);
      if (Array.isArray(body.supportsHabitIds)) {
        p.supportsHabitIds = body.supportsHabitIds.map(String);
      }
      p.updatedAt = new Date().toISOString();
    });
    return NextResponse.json({
      ok: true,
      principles: store.principles.filter((p) => !p.archived),
    });
  }

  if (action === "createOutcome") {
    const text = String(body.text ?? "").trim();
    if (!text) return NextResponse.json({ error: "text" }, { status: 400 });
    const store = await updateStore((s) => {
      if (!s.outcomes) s.outcomes = [];
      s.outcomes.push({
        id: id(),
        text,
        metric: body.metric ? String(body.metric) : undefined,
        goalId: body.goalId ? String(body.goalId) : undefined,
        phaseId: body.phaseId ? String(body.phaseId) : undefined,
        lifeAreaId: body.lifeAreaId ? String(body.lifeAreaId) : undefined,
        monthKey: body.monthKey ? String(body.monthKey) : monthKeyFromDate(),
        createdAt: new Date().toISOString(),
      });
    });
    return NextResponse.json({
      ok: true,
      outcomes: store.outcomes.filter((o) => !o.archived),
    });
  }

  if (action === "deleteOutcome") {
    const oid = String(body.id ?? "");
    if (!oid) return NextResponse.json({ error: "id" }, { status: 400 });
    await updateStore((s) => {
      const o = (s.outcomes ?? []).find((x) => x.id === oid);
      if (o) o.archived = true;
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "upsertReview") {
    const cadence = String(body.cadence ?? "day") as Review["cadence"];
    if (!["day", "week", "month"].includes(cadence)) {
      return NextResponse.json({ error: "cadence" }, { status: 400 });
    }
    const periodKey = String(body.periodKey ?? todayKey());
    const store = await updateStore((s) => {
      if (!s.reviews) s.reviews = [];
      let row = s.reviews.find((r) => r.cadence === cadence && r.periodKey === periodKey);
      const now = new Date().toISOString();
      if (!row) {
        row = {
          id: id(),
          cadence,
          periodKey,
          createdAt: now,
          updatedAt: now,
        };
        s.reviews.push(row);
      }
      if (body.happened != null) row.happened = String(body.happened);
      if (body.worked != null) row.worked = String(body.worked);
      if (body.failed != null) row.failed = String(body.failed);
      if (body.why != null) row.why = String(body.why);
      if (body.learned != null) row.learned = String(body.learned);
      if (body.nextChange != null) row.nextChange = String(body.nextChange);
      row.updatedAt = now;
    });
    return NextResponse.json({
      ok: true,
      review: store.reviews.find((r) => r.cadence === cadence && r.periodKey === periodKey),
    });
  }

  if (action === "capture") {
    const raw = String(body.raw ?? body.text ?? "").trim();
    if (!raw) return NextResponse.json({ error: "raw" }, { status: 400 });
    const store = await updateStore((s) => {
      if (!s.captures) s.captures = [];
      s.captures.push({
        id: id(),
        raw,
        status: "pending",
        nodeIds: [],
        edgeIds: [],
        createdAt: new Date().toISOString(),
        directionId: body.directionId ? String(body.directionId) : undefined,
        goalId: body.goalId ? String(body.goalId) : undefined,
        principleId: body.principleId ? String(body.principleId) : undefined,
        note: body.note ? String(body.note) : undefined,
      });
    });
    return NextResponse.json({
      ok: true,
      captures: store.captures.slice().reverse(),
    });
  }

  if (action === "linkCapture") {
    const cid = String(body.id ?? "");
    if (!cid) return NextResponse.json({ error: "id" }, { status: 400 });
    const store = await updateStore((s) => {
      const c = (s.captures ?? []).find((x) => x.id === cid);
      if (!c) return;
      if (body.directionId !== undefined) {
        c.directionId = body.directionId ? String(body.directionId) : undefined;
      }
      if (body.goalId !== undefined) {
        c.goalId = body.goalId ? String(body.goalId) : undefined;
      }
      if (body.principleId !== undefined) {
        c.principleId = body.principleId ? String(body.principleId) : undefined;
      }
      if (body.note != null) c.note = String(body.note);
      if (body.status != null) c.status = body.status as typeof c.status;
      else if (c.directionId || c.goalId || c.principleId) c.status = "processed";
    });
    return NextResponse.json({
      ok: true,
      captures: store.captures.slice().reverse(),
    });
  }

  if (action === "setGoalLayer") {
    const gid = String(body.goalId ?? body.id ?? "");
    const layer = String(body.layer ?? "") as LifeLayer;
    if (!gid || !["outer", "inner"].includes(layer)) {
      return NextResponse.json({ error: "fields" }, { status: 400 });
    }
    await updateStore((s) => {
      const g = s.goals.find((x) => x.id === gid);
      if (g) g.layer = layer;
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "setVision") {
    const visionNote = String(body.visionNote ?? body.vision ?? "");
    await updateStore((s) => {
      s.settings.visionNote = visionNote;
    });
    return NextResponse.json({ ok: true, visionNote });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
