"use client";

import { useEffect, useState } from "react";

/** Click-to-edit text — saves on blur/Enter, cancels on Escape. */
export function EditableText({
  value,
  onSave,
  className = "",
  inputClassName = "field",
  multiline = false,
  placeholder = "Нажми, чтобы изменить",
  disabled = false,
}: {
  value: string;
  onSave: (next: string) => void | Promise<void>;
  className?: string;
  inputClassName?: string;
  multiline?: boolean;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  async function commit() {
    const next = draft.trim();
    setEditing(false);
    if (next === value.trim()) return;
    await onSave(next);
  }

  if (editing) {
    if (multiline) {
      return (
        <textarea
          className={inputClassName}
          rows={3}
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setDraft(value);
              setEditing(false);
            }
          }}
        />
      );
    }
    return (
      <input
        className={inputClassName}
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void commit();
          }
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      className={`editable-text ${className}`}
      onClick={() => !disabled && setEditing(true)}
      title="Изменить"
    >
      {value.trim() || <span className="text-[var(--ink-faint)]">{placeholder}</span>}
    </button>
  );
}
