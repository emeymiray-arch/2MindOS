"use client";

import type { ReactNode } from "react";

export type ActionMode = "edit" | "archive" | "delete" | null;

export interface ActionOption {
  id: string;
  label: string;
  group?: string;
}

function IconPencil() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function IconArchive() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 8v13H3V8" />
      <path d="M1 3h22v5H1z" />
      <path d="M10 12h4" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
    </svg>
  );
}

export function PageToolbar({
  mode,
  onMode,
  options,
  onPick,
  onAdd,
  addActive,
  addMenu,
  extra,
}: {
  mode: ActionMode;
  onMode: (m: ActionMode) => void;
  options: ActionOption[];
  onPick: (id: string, mode: Exclude<ActionMode, null>) => void;
  onAdd?: () => void;
  addActive?: boolean;
  addMenu?: ReactNode;
  extra?: ReactNode;
}) {
  function toggle(next: Exclude<ActionMode, null>) {
    onMode(mode === next ? null : next);
  }

  return (
    <div className="page-toolbar">
      <div className="page-toolbar-bar">
        <button
          type="button"
          className={`icon-btn ${mode === "edit" ? "icon-btn-on" : ""}`}
          onClick={() => toggle("edit")}
        >
          <IconPencil />
        </button>
        <button
          type="button"
          className={`icon-btn ${mode === "archive" ? "icon-btn-on" : ""}`}
          onClick={() => toggle("archive")}
        >
          <IconArchive />
        </button>
        <button
          type="button"
          className={`icon-btn ${mode === "delete" ? "icon-btn-on" : ""}`}
          onClick={() => toggle("delete")}
        >
          <IconTrash />
        </button>
        {onAdd ? (
          <button type="button" className={`icon-btn ${addActive ? "icon-btn-on" : ""}`} onClick={onAdd}>
            +
          </button>
        ) : null}
        {extra}
      </div>

      {addMenu}

      {mode && (
        <div className="page-toolbar-pick">
          {options.length === 0 ? null : (
            <ul className="page-toolbar-list">
              {options.map((o) => (
                <li key={o.id}>
                  <button type="button" onClick={() => onPick(o.id, mode)}>
                    {o.group && <span className="pick-group">{o.group}</span>}
                    <span>{o.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="btn btn-ghost mt-2" onClick={() => onMode(null)}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}
