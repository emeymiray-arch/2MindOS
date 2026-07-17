"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ActionMode, ActionOption, PageToolbar } from "@/components/ui/PageToolbar";
import { CaptureInbox } from "@/components/mind/CaptureInbox";
import { formatDateShort } from "@/lib/format";
import type { ThoughtEntry, ThoughtJournal } from "@/lib/types";

export default function MindPage() {
  const [journals, setJournals] = useState<ThoughtJournal[]>([]);
  const [open, setOpen] = useState<{ journalId: string; entry?: ThoughtEntry } | null>(null);
  const [word, setWord] = useState("");
  const [body, setBody] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newJournal, setNewJournal] = useState("");
  const [mode, setMode] = useState<ActionMode>(null);
  const [editJournal, setEditJournal] = useState<{ id: string; title: string } | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/thoughts");
    const data = await res.json();
    setJournals(data.journals ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function post(payload: Record<string, unknown>) {
    setError("");
    try {
      const res = await fetch("/api/thoughts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.error) setError(String(data.error ?? "Ошибка"));
      await load();
    } catch {
      setError("Не удалось сохранить");
    }
  }

  function openEntry(journalId: string, entry?: ThoughtEntry) {
    setOpen({ journalId, entry });
    setWord(entry?.word ?? "");
    setBody(entry?.body ?? "");
    setDate(entry?.date ?? new Date().toISOString().slice(0, 10));
  }

  async function save() {
    if (!open || !word.trim()) return;
    if (open.entry) {
      await post({
        action: "updateEntry",
        journalId: open.journalId,
        entryId: open.entry.id,
        word,
        body,
        date,
      });
    } else {
      await post({
        action: "addEntry",
        journalId: open.journalId,
        word,
        body,
        date,
      });
    }
    setOpen(null);
  }

  const options: ActionOption[] = useMemo(() => {
    const list: ActionOption[] = [];
    for (const j of journals) {
      list.push({ id: `journal:${j.id}`, label: j.title, group: "Раздел" });
      for (const e of j.entries.filter((x) => !x.archived)) {
        list.push({ id: `entry:${j.id}:${e.id}`, label: e.word, group: j.title });
      }
    }
    return list;
  }, [journals]);

  async function onPick(id: string, action: Exclude<ActionMode, null>) {
    if (id.startsWith("journal:")) {
      const journalId = id.slice(8);
      const j = journals.find((x) => x.id === journalId);
      if (!j) return;
      if (action === "edit") {
        setEditJournal({ id: journalId, title: j.title });
        setMode(null);
        return;
      }
      if (action === "archive") await post({ action: "archiveJournal", id: journalId });
      else await post({ action: "deleteJournal", id: journalId });
      setMode(null);
      return;
    }
    if (id.startsWith("entry:")) {
      const [, journalId, entryId] = id.split(":");
      const j = journals.find((x) => x.id === journalId);
      const e = j?.entries.find((x) => x.id === entryId);
      if (!j || !e) return;
      if (action === "edit") {
        openEntry(journalId, e);
        setMode(null);
        return;
      }
      if (action === "archive") await post({ action: "archiveEntry", journalId, entryId });
      else await post({ action: "deleteEntry", journalId, entryId });
      setMode(null);
    }
  }

  return (
    <div className="fade-in mx-auto max-w-4xl space-y-8 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl">Мысли</h1>
        <div className="flex gap-2">
          <input value={newJournal} onChange={(e) => setNewJournal(e.target.value)} />
          <button
            type="button"
            className="btn btn-ink"
            onClick={() => {
              if (!newJournal.trim()) return;
              post({ action: "createJournal", title: newJournal });
              setNewJournal("");
            }}
          >
            +
          </button>
        </div>
      </div>

      {error && <p className="text-[13px] text-[var(--bad)]">{error}</p>}

      <CaptureInbox />

      {journals.map((j) => {
        const entries = [...j.entries]
          .filter((e) => !e.archived)
          .sort((a, b) => a.date.localeCompare(b.date));
        return (
          <section key={j.id}>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="item-title text-[17px]">{j.title}</h2>
              <button
                type="button"
                className="meta-quiet hover:underline"
                onClick={() => openEntry(j.id)}
              >
                +
              </button>
            </div>
            <div className="flex flex-wrap gap-4">
              {entries.map((e) => (
                <div key={e.id} className="flex w-[72px] flex-col items-center gap-1">
                  <button type="button" className="thought-circle" onClick={() => openEntry(j.id, e)}>
                    {e.word}
                  </button>
                  <span className="meta-quiet">{formatDateShort(e.date)}</span>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {editJournal && (
        <div className="edit-sheet max-w-md">
          <input
            value={editJournal.title}
            autoFocus
            onChange={(e) => setEditJournal({ ...editJournal, title: e.target.value })}
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-ink"
              onClick={async () => {
                await post({ action: "renameJournal", id: editJournal.id, title: editJournal.title });
                setEditJournal(null);
              }}
            >
              +
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditJournal(null)}>
              ×
            </button>
          </div>
        </div>
      )}

      <PageToolbar
        mode={mode}
        onMode={(m) => {
          setMode(m);
          setEditJournal(null);
        }}
        options={options}
        onPick={onPick}
      />

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
          <div className="card w-full max-w-md space-y-3 p-5">
            <input value={word} onChange={(e) => setWord(e.target.value)} autoFocus />
            <textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-ink" onClick={save}>
                +
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(null)}>
                ×
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
