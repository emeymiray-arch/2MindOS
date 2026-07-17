import { NextResponse } from "next/server";
import { id, now, todayKey } from "@/lib/id";
import { getStore, updateStore } from "@/lib/store";
import type { ThoughtEntry, ThoughtJournal } from "@/lib/types";

export async function GET() {
  const store = await getStore();
  const journals = (store.thoughtJournals ?? []).filter((j) => !j.archived);
  return NextResponse.json({ journals });
}

export async function POST(request: Request) {
  const body = await request.json();
  const action = String(body.action ?? "createJournal");

  if (action === "createJournal") {
    const title = String(body.title ?? "").trim();
    if (!title) return NextResponse.json({ error: "title" }, { status: 400 });
    const store = await updateStore((s) => {
      if (!s.thoughtJournals) s.thoughtJournals = [];
      const j: ThoughtJournal = {
        id: id(),
        title,
        entries: [],
        createdAt: now(),
      };
      s.thoughtJournals.push(j);
    });
    return NextResponse.json({ journals: store.thoughtJournals.filter((j) => !j.archived) });
  }

  if (action === "renameJournal") {
    const store = await updateStore((s) => {
      const j = s.thoughtJournals.find((x) => x.id === body.id);
      if (j && body.title) j.title = String(body.title);
    });
    return NextResponse.json({ journals: store.thoughtJournals });
  }

  if (action === "archiveJournal") {
    const store = await updateStore((s) => {
      const j = s.thoughtJournals.find((x) => x.id === body.id);
      if (j) j.archived = true;
    });
    return NextResponse.json({ journals: store.thoughtJournals.filter((j) => !j.archived) });
  }

  if (action === "deleteJournal") {
    const store = await updateStore((s) => {
      s.thoughtJournals = s.thoughtJournals.filter((x) => x.id !== body.id);
    });
    return NextResponse.json({ journals: store.thoughtJournals.filter((j) => !j.archived) });
  }

  if (action === "addEntry") {
    const journalId = String(body.journalId ?? "");
    const word = String(body.word ?? "").trim();
    if (!journalId || !word) return NextResponse.json({ error: "fields" }, { status: 400 });
    const store = await updateStore((s) => {
      const j = s.thoughtJournals.find((x) => x.id === journalId);
      if (!j) return;
      const entry: ThoughtEntry = {
        id: id(),
        word,
        body: body.body ? String(body.body) : "",
        date: String(body.date ?? todayKey()),
      };
      j.entries.push(entry);
    });
    return NextResponse.json({ journals: store.thoughtJournals });
  }

  if (action === "updateEntry") {
    const store = await updateStore((s) => {
      const j = s.thoughtJournals.find((x) => x.id === body.journalId);
      const e = j?.entries.find((x) => x.id === body.entryId);
      if (!e) return;
      if (body.word != null) e.word = String(body.word);
      if (body.body !== undefined) e.body = String(body.body);
      if (body.date != null) e.date = String(body.date);
    });
    return NextResponse.json({ journals: store.thoughtJournals });
  }

  if (action === "archiveEntry") {
    const store = await updateStore((s) => {
      const j = s.thoughtJournals.find((x) => x.id === body.journalId);
      const e = j?.entries.find((x) => x.id === body.entryId);
      if (e) e.archived = true;
    });
    return NextResponse.json({ journals: store.thoughtJournals });
  }

  if (action === "deleteEntry") {
    const store = await updateStore((s) => {
      const j = s.thoughtJournals.find((x) => x.id === body.journalId);
      if (!j) return;
      j.entries = j.entries.filter((x) => x.id !== body.entryId);
    });
    return NextResponse.json({ journals: store.thoughtJournals });
  }

  return NextResponse.json({ error: "unknown" }, { status: 400 });
}
