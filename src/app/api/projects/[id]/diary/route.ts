import { NextResponse } from "next/server";
import { id, now } from "@/lib/id";
import { getStore, updateStore } from "@/lib/store";
import type { ProjectDiaryEntry } from "@/lib/types";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await context.params;
  const store = await getStore();
  const project = store.projects.find((p) => p.id === projectId || p.nodeId === projectId);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ diary: project.diary ?? [] });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await context.params;
  const body = await request.json();
  const action = String(body.action ?? "add");

  if (action === "add") {
    const title = String(body.title ?? "").trim();
    const text = String(body.body ?? "").trim();
    if (!title) return NextResponse.json({ error: "title" }, { status: 400 });
    const store = await updateStore((s) => {
      const project = s.projects.find((p) => p.id === projectId || p.nodeId === projectId);
      if (!project) return;
      if (!project.diary) project.diary = [];
      const entry: ProjectDiaryEntry = {
        id: id(),
        kind: (body.kind as ProjectDiaryEntry["kind"]) ?? "note",
        title,
        body: text,
        createdAt: now(),
      };
      project.diary.unshift(entry);
    });
    const project = store.projects.find((p) => p.id === projectId || p.nodeId === projectId);
    return NextResponse.json({ diary: project?.diary ?? [] });
  }

  if (action === "delete") {
    const store = await updateStore((s) => {
      const project = s.projects.find((p) => p.id === projectId || p.nodeId === projectId);
      if (!project?.diary) return;
      project.diary = project.diary.filter((d) => d.id !== body.id);
    });
    const project = store.projects.find((p) => p.id === projectId || p.nodeId === projectId);
    return NextResponse.json({ diary: project?.diary ?? [] });
  }

  return NextResponse.json({ error: "unknown" }, { status: 400 });
}
