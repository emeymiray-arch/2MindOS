import { NextResponse } from "next/server";
import { id, now } from "@/lib/id";
import { getStore, updateStore } from "@/lib/store";
import type { Project } from "@/lib/types";

function emptyModules(): Project["modules"] {
  return {
    docs: [],
    tasks: [],
    ideas: [],
    financeNotes: [],
    team: [],
    marketing: [],
    sales: [],
    files: [],
    changelog: [],
  };
}

export async function GET() {
  const store = await getStore();
  return NextResponse.json({
    projects: store.projects.filter((p) => p.status !== "archived"),
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const action = String(body.action ?? "create");

  if (action === "create") {
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "name" }, { status: 400 });
    const store = await updateStore((s) => {
      const t = now();
      const nodeId = id();
      s.nodes.unshift({
        id: nodeId,
        kind: "project",
        title: name,
        body: body.tagline ? String(body.tagline) : undefined,
        metadata: {},
        salience: 0.85,
        createdAt: t,
        updatedAt: t,
      });
      const project: Project = {
        id: id(),
        nodeId,
        name,
        tagline: body.tagline ? String(body.tagline) : undefined,
        status: "active",
        kpi: body.kpiLabel
          ? [{ label: String(body.kpiLabel), value: String(body.kpiValue ?? "—") }]
          : [],
        modules: emptyModules(),
        diary: [],
      };
      s.projects.unshift(project);
    });
    return NextResponse.json({
      projects: store.projects.filter((p) => p.status !== "archived"),
    });
  }

  if (action === "update") {
    const store = await updateStore((s) => {
      const p = s.projects.find((x) => x.id === body.id);
      if (!p) return;
      if (body.name != null) p.name = String(body.name).trim() || p.name;
      if (body.tagline !== undefined) p.tagline = body.tagline || undefined;
      if (body.status === "active" || body.status === "paused" || body.status === "archived") {
        p.status = body.status;
      }
      if (body.kpiLabel != null || body.kpiValue != null) {
        const label = String(body.kpiLabel ?? p.kpi[0]?.label ?? "KPI");
        const value = String(body.kpiValue ?? p.kpi[0]?.value ?? "—");
        p.kpi = [{ label, value }];
      }
      const node = s.nodes.find((n) => n.id === p.nodeId);
      if (node) {
        node.title = p.name;
        node.body = p.tagline;
        node.updatedAt = now();
      }
    });
    return NextResponse.json({
      projects: store.projects.filter((x) => x.status !== "archived"),
    });
  }

  if (action === "archive") {
    const store = await updateStore((s) => {
      const p = s.projects.find((x) => x.id === body.id);
      if (p) p.status = "archived";
    });
    return NextResponse.json({
      projects: store.projects.filter((p) => p.status !== "archived"),
    });
  }

  if (action === "delete") {
    const store = await updateStore((s) => {
      const p = s.projects.find((x) => x.id === body.id);
      if (p) s.nodes = s.nodes.filter((n) => n.id !== p.nodeId);
      s.projects = s.projects.filter((x) => x.id !== body.id);
    });
    return NextResponse.json({
      projects: store.projects.filter((p) => p.status !== "archived"),
    });
  }

  return NextResponse.json({ error: "unknown" }, { status: 400 });
}
