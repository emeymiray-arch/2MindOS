"use client";

import { useEffect, useState } from "react";
import type { AppSettings } from "@/lib/types";

export default function SettingsPage() {
  const [s, setS] = useState<AppSettings | null>(null);
  const [token, setToken] = useState("");
  const [origin, setOrigin] = useState("");
  const [db, setDb] = useState({ configured: false, url: "missing", anonKey: "missing" });

  useEffect(() => {
    setOrigin(window.location.origin);
    fetch("/api/state")
      .then((r) => r.json())
      .then((data) => {
        setS(data.settings);
        setToken(data.settings?.shortcutsToken ?? "");
        document.documentElement.setAttribute(
          "data-theme",
          data.settings?.theme === "dark" ? "dark" : "light"
        );
      });
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setDb(d.supabase ?? db))
      .catch(() => undefined);
  }, []);

  async function save(patch: Partial<AppSettings>) {
    const next = { ...s!, ...patch };
    setS(next);
    if (patch.theme) document.documentElement.setAttribute("data-theme", patch.theme);
    await fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "settings", settings: patch }),
    });
  }

  async function reset() {
    if (!confirm("Сбросить данные?")) return;
    await fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    });
    window.location.href = "/";
  }

  async function exportData() {
    const res = await fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "export" }),
    });
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `2mindos-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importData(file: File) {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const store = parsed.store ?? parsed;
    if (!confirm("Импорт заменит текущие данные. Продолжить?")) return;
    await fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "import", store }),
    });
    window.location.reload();
  }

  if (!s) return <div className="text-[var(--ink-faint)]">…</div>;

  return (
    <div className="fade-in mx-auto max-w-xl space-y-4">
      <h1 className="font-display text-3xl">Настройки</h1>

      <section className="card space-y-3 p-5">
        <p className="font-semibold">Профиль</p>
        <input
          value={s.name}
          onChange={(e) => setS({ ...s, name: e.target.value })}
          onBlur={() => save({ name: s.name })}
        />
        <input
          type="email"
          value={s.email}
          onChange={(e) => setS({ ...s, email: e.target.value })}
          onBlur={() => save({ email: s.email })}
        />
      </section>

      <section className="card space-y-3 p-5">
        <p className="font-semibold">Тема</p>
        <div className="flex gap-2">
          <button
            type="button"
            className={`btn ${s.theme === "light" ? "btn-ink" : "btn-soft"}`}
            onClick={() => save({ theme: "light" })}
          >
            Светлая
          </button>
          <button
            type="button"
            className={`btn ${s.theme === "dark" ? "btn-ink" : "btn-soft"}`}
            onClick={() => save({ theme: "dark" })}
          >
            Тёмная
          </button>
        </div>
      </section>

      <section className="card space-y-3 p-5">
        <p className="font-semibold">Общие</p>
        <label className="flex items-center justify-between text-[14px]">
          Уведомления
          <input
            type="checkbox"
            checked={s.notifications}
            onChange={(e) => save({ notifications: e.target.checked })}
          />
        </label>
        <label className="flex items-center justify-between text-[14px]">
          Звук
          <input
            type="checkbox"
            checked={s.sound}
            onChange={(e) => save({ sound: e.target.checked })}
          />
        </label>
        <label className="flex items-center justify-between text-[14px]">
          Меньше анимации
          <input
            type="checkbox"
            checked={s.reduceMotion}
            onChange={(e) => save({ reduceMotion: e.target.checked })}
          />
        </label>
        <label className="flex items-center justify-between text-[14px]">
          Компактный режим
          <input
            type="checkbox"
            checked={s.compactMode}
            onChange={(e) => save({ compactMode: e.target.checked })}
          />
        </label>
        <label className="flex items-center justify-between text-[14px]">
          Показывать архив
          <input
            type="checkbox"
            checked={s.showArchived}
            onChange={(e) => save({ showArchived: e.target.checked })}
          />
        </label>
        <label className="flex items-center justify-between text-[14px]">
          Неделя с
          <select
            value={s.startOfWeek}
            onChange={(e) => save({ startOfWeek: Number(e.target.value) as 0 | 1 })}
          >
            <option value={1}>Понедельника</option>
            <option value={0}>Воскресенья</option>
          </select>
        </label>
        <label className="flex items-center justify-between text-[14px]">
          Язык
          <select value={s.language} onChange={(e) => save({ language: e.target.value })}>
            <option value="ru">Русский</option>
            <option value="en">English</option>
          </select>
        </label>
      </section>

      <section className="card space-y-2 p-5">
        <p className="font-semibold">Shortcuts</p>
        <pre className="overflow-x-auto rounded-[12px] bg-[var(--bg)] p-3 text-[11px] text-[var(--ink-soft)]">
{`${origin}/api/shortcuts
token: ${token}`}
        </pre>
      </section>

      <section className="card space-y-2 p-5">
        <p className="font-semibold">База</p>
        <p className="analytics-line">
          Supabase: <strong>{db.configured ? "ключи есть" : "ожидает"}</strong>
          {" · "}url {db.url}
          {" · "}anon {db.anonKey}
        </p>
        <p className="meta-quiet">Пока данные в локальном JSON. После ключей подключим Postgres.</p>
      </section>

      <section className="card space-y-2 p-5">
        <p className="font-semibold">Данные</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-soft" onClick={exportData}>
            Экспорт
          </button>
          <label className="btn btn-soft cursor-pointer">
            Импорт
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importData(f);
              }}
            />
          </label>
          <button type="button" className="btn btn-ghost" onClick={reset}>
            Сбросить
          </button>
        </div>
      </section>

      <section className="card p-5 text-[12px] text-[var(--ink-faint)]">2MindOS · v0.1</section>
    </div>
  );
}
