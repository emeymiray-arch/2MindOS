"use client";

import { useEffect, useState } from "react";
import type { OracleMessage } from "@/lib/types";

export default function OraclePage() {
  const [messages, setMessages] = useState<OracleMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [contextUsed, setContextUsed] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/oracle")
      .then((r) => r.json())
      .then((d) => setMessages(d.messages ?? []));
  }, []);

  async function ask() {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    const res = await fetch("/api/oracle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q }),
    });
    const data = await res.json();
    setMessages(data.messages ?? []);
    setContextUsed(data.contextUsed ?? []);
    setQuestion("");
    setBusy(false);
  }

  return (
    <div className="fade-in mx-auto grid max-w-5xl gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-4">
        <p className="eyebrow">Oracle</p>
        <h1 className="font-display text-2xl">Стратег</h1>
        <p className="text-[13px] text-[var(--ink-soft)]">
          Цели, vitals, финансы, граф — без воды.
        </p>
        {contextUsed.length > 0 && (
          <div className="panel p-3">
            <p className="eyebrow">Учтено</p>
            <p className="mt-1 text-[13px]">{contextUsed.join(" · ")}</p>
          </div>
        )}
      </aside>

      <div className="space-y-4">
        <div className="max-h-[52vh] space-y-3 overflow-y-auto scroll-thin">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`rounded-[12px] px-4 py-3 ${
                m.role === "assistant" ? "card" : "panel"
              }`}
            >
              <p className="eyebrow">{m.role === "assistant" ? "Oracle" : "Вы"}</p>
              <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed">{m.content}</p>
            </div>
          ))}
        </div>

        <div className="card p-4">
          <textarea
            rows={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                ask();
              }
            }}
            placeholder="Спросите систему…"
            className="w-full resize-none bg-transparent outline-none placeholder:text-[var(--ink-faint)]"
          />
          <div className="mt-3 flex justify-between border-t border-[var(--line)] pt-3">
            <span className="text-[11px] text-[var(--ink-faint)]">⌘ Enter</span>
            <button
              type="button"
              disabled={busy || !question.trim()}
              onClick={ask}
              className="btn btn-ink"
            >
              {busy ? "…" : "Спросить"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
