"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ActionMode, ActionOption, PageToolbar } from "@/components/ui/PageToolbar";
import type { PasswordEntry } from "@/lib/types";

const emptyForm = {
  projectName: "",
  title: "",
  username: "",
  secret: "",
  url: "",
  notes: "",
};

export default function PasswordsPage() {
  const [items, setItems] = useState<PasswordEntry[]>([]);
  const [q, setQ] = useState("");
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [form, setForm] = useState(emptyForm);
  const [mode, setMode] = useState<ActionMode>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (query = "") => {
    const res = await fetch(`/api/passwords?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    setItems(data.passwords ?? []);
  }, []);

  useEffect(() => {
    load("");
  }, [load]);

  const visible = useMemo(() => items.filter((x) => !x.archived), [items]);

  const grouped = useMemo(() => {
    const map = new Map<string, PasswordEntry[]>();
    for (const p of visible) {
      const list = map.get(p.projectName) ?? [];
      list.push(p);
      map.set(p.projectName, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "ru"));
  }, [visible]);

  const options: ActionOption[] = useMemo(
    () =>
      visible.map((p) => ({
        id: p.id,
        label: p.title,
        group: p.projectName,
      })),
    [visible]
  );

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const { apiPost } = await import("@/lib/client-api");
      const result = await apiPost("/api/passwords", body);
      if (!result.ok && result.error) setError(result.error);
      await load(q);
    } catch {
      setError("Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  }

  async function fetchSecret(id: string) {
    const res = await fetch("/api/passwords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reveal", id }),
    });
    const data = await res.json();
    if (data.secret) {
      setSecrets((s) => ({ ...s, [id]: data.secret }));
      return String(data.secret);
    }
    return "";
  }

  async function startEdit(p: PasswordEntry) {
    const secret = await fetchSecret(p.id);
    setEditId(p.id);
    setForm({
      projectName: p.projectName,
      title: p.title,
      username: p.username ?? "",
      secret,
      url: p.url ?? "",
      notes: p.notes ?? "",
    });
  }

  async function toggleReveal(id: string) {
    if (reveal[id]) {
      setReveal((r) => ({ ...r, [id]: false }));
      return;
    }
    await fetchSecret(id);
    setReveal((r) => ({ ...r, [id]: true }));
  }

  async function save() {
    if (!form.projectName.trim() || !form.title.trim() || !form.secret.trim()) {
      setError("Проект, название и значение обязательны");
      return;
    }
    if (editId) {
      await post({ action: "update", id: editId, ...form });
      setEditId(null);
    } else {
      await post({ action: "create", ...form });
    }
    setForm(emptyForm);
  }

  async function onPick(id: string, action: Exclude<ActionMode, null>) {
    const p = visible.find((x) => x.id === id);
    if (!p) return;
    if (action === "edit") {
      await startEdit(p);
      setMode(null);
      return;
    }
    if (action === "archive") await post({ action: "archive", id });
    else await post({ action: "delete", id });
    setMode(null);
  }

  return (
    <div className="fade-in mx-auto max-w-3xl space-y-6 pb-8">
      <h1 className="font-display text-3xl">Пароли</h1>

      {error && <p className="text-[13px] text-[var(--bad)]">{error}</p>}

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") load(q);
        }}
      />

      <div className="card grid gap-2 p-4 sm:grid-cols-2">
        <input
          value={form.projectName}
          disabled={busy}
          onChange={(e) => setForm({ ...form, projectName: e.target.value })}
        />
        <input
          value={form.title}
          disabled={busy}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <input
          value={form.username}
          disabled={busy}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
        />
        <input
          type={editId ? "text" : "password"}
          value={form.secret}
          disabled={busy}
          onChange={(e) => setForm({ ...form, secret: e.target.value })}
        />
        <input
          className="sm:col-span-2"
          value={form.url}
          disabled={busy}
          onChange={(e) => setForm({ ...form, url: e.target.value })}
        />
        <input
          className="sm:col-span-2"
          value={form.notes}
          disabled={busy}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button type="button" className="btn btn-ink" disabled={busy} onClick={save}>
            +
          </button>
          {editId && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setEditId(null);
                setForm(emptyForm);
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="space-y-5">
        {grouped.map(([project, rows]) => (
          <section key={project}>
            <p className="meta-quiet mb-2">{project}</p>
            <div className="space-y-2">
              {rows.map((p) => (
                <div key={p.id} className="card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="item-title">{p.title}</p>
                      {p.username && <p className="meta-quiet mt-1">{p.username}</p>}
                      <p className="mt-2 break-all font-mono text-[13px] text-[var(--ink-soft)]">
                        {reveal[p.id] ? secrets[p.id] ?? "…" : "••••••••••••"}
                      </p>
                      {p.url && (
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noreferrer"
                          className="meta-quiet mt-1 block break-all underline"
                        >
                          {p.url}
                        </a>
                      )}
                    </div>
                    <button type="button" className="icon-btn" onClick={() => toggleReveal(p.id)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <PageToolbar
        mode={mode}
        onMode={(m) => {
          setMode(m);
          if (m) {
            setEditId(null);
            setForm(emptyForm);
          }
        }}
        options={options}
        onPick={onPick}
      />
    </div>
  );
}
