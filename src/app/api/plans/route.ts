import { NextResponse } from "next/server";
import { id, now } from "@/lib/id";
import { activePlan, createDefaultPlan, ensureActivePlan } from "@/lib/lifeos";
import { getStore, updateStore } from "@/lib/store";
import type { SixMonthPlan } from "@/lib/types";

export async function GET() {
  const store = await getStore();
  const plan = activePlan(store) ?? createDefaultPlan();
  return NextResponse.json({
    plans: store.plans ?? [],
    active: store.plans?.find((p) => p.status === "active") ?? plan,
    areas: store.spheres,
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "ensure");

  if (action === "ensure") {
    const store = await updateStore((s) => {
      ensureActivePlan(s);
    });
    return NextResponse.json({
      plans: store.plans,
      active: activePlan(store),
      areas: store.spheres,
    });
  }

  if (action === "create") {
    const store = await updateStore((s) => {
      for (const p of s.plans ?? []) p.status = "archived";
      if (!s.plans) s.plans = [];
      const plan: SixMonthPlan = {
        id: id(),
        title: String(body.title ?? "").trim() || createDefaultPlan().title,
        startDate: String(body.startDate ?? now().slice(0, 10)),
        endDate: String(body.endDate ?? createDefaultPlan().endDate),
        status: "active",
        createdAt: now(),
      };
      s.plans.push(plan);
    });
    return NextResponse.json({ plans: store.plans, active: activePlan(store) });
  }

  if (action === "update") {
    const store = await updateStore((s) => {
      const p = (s.plans ?? []).find((x) => x.id === body.id);
      if (!p) return;
      if (body.title != null) p.title = String(body.title);
      if (body.startDate != null) p.startDate = String(body.startDate);
      if (body.endDate != null) p.endDate = String(body.endDate);
    });
    return NextResponse.json({ plans: store.plans, active: activePlan(store) });
  }

  return NextResponse.json({ error: "unknown" }, { status: 400 });
}
