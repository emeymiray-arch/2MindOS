"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ActionMode, ActionOption, PageToolbar } from "@/components/ui/PageToolbar";
import type { Project } from "@/lib/types";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [mode, setMode] = useState<ActionMode>(null);
  const [edit, setEdit] = useState<{
    id: string;
    name: string;
    tagline: string;
    status: Project["status"];
    kpiLabel: string;
    kpiValue: string;
  } | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/projects");
    const data = await res.json();
    setProjects(data.projects ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function post(body: Record<string, unknown>) {
    setError("");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || data.error) setError(String(data.error ?? "Ошибка"));
      await load();
    } catch {
      setError("Не удалось сохранить");
    }
  }

  const options: ActionOption[] = useMemo(
    () => projects.map((p) => ({ id: p.id, label: p.name, group: p.status })),
    [projects]
  );

  async function onPick(id: string, action: Exclude<ActionMode, null>) {
    const p = projects.find((x) => x.id === id);
    if (!p) return;
    if (action === "edit") {
      setEdit({
        id: p.id,
        name: p.name,
        tagline: p.tagline ?? "",
        status: p.status,
        kpiLabel: p.kpi[0]?.label ?? "",
        kpiValue: p.kpi[0]?.value ?? "",
      });
      setMode(null);
      return;
    }
    if (action === "archive") await post({ action: "archive", id });
    else await post({ action: "delete", id });
    setMode(null);
  }

  return (
    <div className="fade-in mx-auto max-w-3xl space-y-5 pb-8">
      <h1 className="font-display text-3xl">Проекты</h1>

      {error && <p className="text-[13px] text-[var(--bad)]">{error}</p>}

      <div className="card flex flex-wrap gap-2 p-3">
        <input className="min-w-[140px] flex-1" value={name} onChange={(e) => setName(e.target.value)} />
        <input
          className="min-w-[120px] flex-1"
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
        />
        <button
          type="button"
          className="btn btn-ink"
          onClick={() => {
            if (!name.trim()) return;
            post({ action: "create", name, tagline: tagline || undefined });
            setName("");
            setTagline("");
          }}
        >
          +
        </button>
      </div>

      <div className="space-y-3">
        {projects.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`} className="card block p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="item-title text-[18px]">{p.name}</h2>
              <span className="meta-quiet">{p.status}</span>
            </div>
            {p.tagline && <p className="meta-quiet mt-1">{p.tagline}</p>}
            {p.kpi[0] && (
              <p className="analytics-line mt-3">
                <strong>{p.kpi[0].value}</strong>
                <span className="meta-quiet"> · {p.kpi[0].label}</span>
              </p>
            )}
          </Link>
        ))}
      </div>

      {edit && (
        <div className="edit-sheet">
          <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
          <input
            value={edit.tagline}
            onChange={(e) => setEdit({ ...edit, tagline: e.target.value })}
          />
          <select
            value={edit.status}
            onChange={(e) =>
              setEdit({ ...edit, status: e.target.value as Project["status"] })
            }
          >
            <option value="active">active</option>
            <option value="paused">paused</option>
          </select>
          <input
            value={edit.kpiLabel}
            onChange={(e) => setEdit({ ...edit, kpiLabel: e.target.value })}
          />
          <input
            value={edit.kpiValue}
            onChange={(e) => setEdit({ ...edit, kpiValue: e.target.value })}
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-ink"
              onClick={async () => {
                await post({
                  action: "update",
                  id: edit.id,
                  name: edit.name,
                  tagline: edit.tagline,
                  status: edit.status,
                  kpiLabel: edit.kpiLabel,
                  kpiValue: edit.kpiValue,
                });
                setEdit(null);
              }}
            >
              +
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setEdit(null)}>
              ×
            </button>
          </div>
        </div>
      )}

      <PageToolbar
        mode={mode}
        onMode={(m) => {
          setMode(m);
          setEdit(null);
        }}
        options={options}
        onPick={onPick}
      />
    </div>
  );
}
