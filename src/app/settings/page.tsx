"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/client-api";
import { toast } from "@/components/ui/Toast";

export default function SettingsPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [capacity, setCapacity] = useState("6");
  const [capacityMin, setCapacityMin] = useState("270");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void apiGet("/api/state").then((res) => {
      if (res.ok) {
        const s = res.data.settings as {
          theme?: string;
          dailyCapacity?: number;
          dailyCapacityMinutes?: number;
        };
        if (s?.theme === "dark" || s?.theme === "light") setTheme(s.theme);
        if (s?.dailyCapacity != null) setCapacity(String(s.dailyCapacity));
        if (s?.dailyCapacityMinutes != null) setCapacityMin(String(s.dailyCapacityMinutes));
      }
    });
  }, []);

  async function saveTheme(next: "light" | "dark") {
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("mindos-theme", next);
    } catch {
      /* ignore */
    }
    const res = await apiPost("/api/state", { action: "theme", theme: next });
    if (!res.ok) toast(res.error ?? "Не сохранилось", "warn");
    else toast("Тема сохранена", "ok");
  }

  async function saveCapacity(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const dailyCapacity = Math.max(1, Math.floor(Number(capacity) || 6));
    const dailyCapacityMinutes = Math.max(30, Math.floor(Number(capacityMin) || 270));
    setBusy(true);
    const res = await apiPost("/api/state", {
      action: "settings",
      settings: { dailyCapacity, dailyCapacityMinutes },
    });
    setBusy(false);
    if (!res.ok) {
      toast(res.error ?? "Не сохранилось", "warn");
      return;
    }
    setCapacity(String(dailyCapacity));
    setCapacityMin(String(dailyCapacityMinutes));
    toast("Ёмкость дня сохранена", "ok");
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-[34px]">Настройки</h1>
      </header>
      <section className="surface space-y-3 p-5">
        <p className="text-[13px] font-bold text-[var(--accent)]">Тема</p>
        <div className="flex gap-2">
          <button
            type="button"
            className={`btn ${theme === "light" ? "btn-primary" : ""}`}
            onClick={() => void saveTheme("light")}
          >
            Светлая
          </button>
          <button
            type="button"
            className={`btn ${theme === "dark" ? "btn-primary" : ""}`}
            onClick={() => void saveTheme("dark")}
          >
            Тёмная
          </button>
        </div>
      </section>

      <form onSubmit={saveCapacity} className="surface space-y-4 p-5">
        <p className="text-[13px] font-bold text-[var(--accent)]">Ёмкость дня</p>
        <p className="text-[13px] font-semibold text-[var(--ink-faint)]">
          Сколько слотов на Главной: привычки + шаги целей (минимум 1 слот цели)
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-[12px] font-bold text-[var(--c-blue)]">Задач в день</label>
            <input
              className="field mt-2"
              inputMode="numeric"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[12px] font-bold text-[var(--c-blue)]">Минут в день</label>
            <input
              className="field mt-2"
              inputMode="numeric"
              value={capacityMin}
              onChange={(e) => setCapacityMin(e.target.value)}
            />
          </div>
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          Сохранить
        </button>
      </form>
    </div>
  );
}
