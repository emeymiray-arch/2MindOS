"use client";

import { useCallback, useEffect, useState } from "react";

/** Compact capture → life graph (used on Mind). */
export function CaptureInbox() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = useCallback(async () => {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value }),
      });
      setText("");
    } finally {
      setBusy(false);
    }
  }, [text, busy]);

  useEffect(() => {
    // warm capture list once (keeps graph fresh)
    fetch("/api/capture").catch(() => undefined);
  }, []);

  return (
    <div className="card flex gap-2 p-3">
      <textarea
        rows={2}
        className="min-w-0 flex-1 resize-none border-0 bg-transparent p-1 outline-none"
        value={text}
        disabled={busy}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
      />
      <button type="button" className="btn btn-ink self-end" disabled={busy || !text.trim()} onClick={submit}>
        +
      </button>
    </div>
  );
}
