"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/client-api";
import { toast } from "@/components/ui/Toast";

type VaultInfo = {
  weight: number;
  goals: number;
  sparse: boolean;
  cloudOk: boolean | null;
  backupCount: number;
  lastBackup: string | null;
  dataPath: string;
};

export default function SettingsPage() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [capacity, setCapacity] = useState("6");
  const [capacityMin, setCapacityMin] = useState("270");
  const [vision, setVision] = useState("");
  const [busy, setBusy] = useState(false);
  const [vault, setVault] = useState<VaultInfo | null>(null);

  const loadVault = useCallback(async () => {
    const res = await apiGet("/api/health?ping=0");
    if (!res.ok) return;
    const d = res.data.durability as VaultInfo | undefined;
    if (d) setVault(d);
  }, []);

  useEffect(() => {
    void apiGet("/api/state").then((res) => {
      if (res.ok) {
        const s = res.data.settings as {
          theme?: string;
          dailyCapacity?: number;
          dailyCapacityMinutes?: number;
          visionNote?: string;
        };
        if (s?.theme === "dark" || s?.theme === "light") setTheme(s.theme);
        if (s?.dailyCapacity != null) setCapacity(String(s.dailyCapacity));
        if (s?.dailyCapacityMinutes != null) setCapacityMin(String(s.dailyCapacityMinutes));
        if (s?.visionNote != null) setVision(s.visionNote);
      }
    });
    void loadVault();
  }, [loadVault]);

  async function saveVision(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const res = await apiPost("/api/life", { action: "setVision", visionNote: vision.trim() });
    setBusy(false);
    if (!res.ok) toast(res.error ?? "Не сохранилось", "warn");
    else toast("Видение сохранено", "ok");
  }

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

  async function restoreSafest() {
    if (busy) return;
    setBusy(true);
    const res = await apiPost("/api/state", { action: "restoreSafest" });
    setBusy(false);
    if (!res.ok) {
      toast(res.error ?? "Не удалось восстановить", "warn");
      return;
    }
    if (res.data.restored) {
      toast(`Восстановила (вес ${res.data.weight})`, "ok");
      window.location.href = "/";
      return;
    }
    toast("Уже лучшая копия", "ok");
    await loadVault();
  }

  async function syncCloud() {
    if (busy) return;
    setBusy(true);
    const res = await apiPost("/api/state", { action: "syncCloud" });
    setBusy(false);
    if (!res.ok || res.data.ok === false) {
      toast(String(res.data.error ?? res.data.skipped ?? res.error ?? "Cloud не принял"), "warn");
      return;
    }
    toast(`В облако · ${res.data.goals ?? "?"} целей`, "ok");
    await loadVault();
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="page-kicker">Настройки</p>
        <h1 className="page-title text-[2.2rem] md:text-[2.6rem]">Система</h1>
        <p className="page-lede">Локальный vault. Облако — только по кнопке.</p>
      </header>

      <section className="panel panel-tint-blue space-y-3">
        <p className="text-[13px] font-bold" style={{ color: "var(--c-blue)" }}>
          Vault
        </p>
        {vault ? (
          <>
            <p className="font-display text-[1.6rem]">
              {vault.sparse ? "Vault пустоват" : "Vault OK"}
              <span className="ml-2 text-[1rem] font-semibold text-[var(--ink-soft)]">
                · {vault.goals} целей · вес {vault.weight}
              </span>
            </p>
            <p className="break-all text-[12px] font-semibold text-[var(--ink-faint)]">
              {vault.dataPath}
            </p>
            <p className="text-[13px] font-semibold text-[var(--ink-soft)]">
              Бэкапов: {vault.backupCount}
              {vault.lastBackup ? ` · последний ${vault.lastBackup}` : ""}
            </p>
          </>
        ) : (
          <p className="text-[14px] text-[var(--ink-faint)]">Проверяю vault…</p>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void restoreSafest()}>
            Восстановить лучшую копию
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => void syncCloud()}>
            Синхронизировать в облако
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => void loadVault()}>
            Обновить статус
          </button>
        </div>
      </section>

      <form onSubmit={saveVision} className="panel panel-tint-pink space-y-3">
        <p className="text-[13px] font-bold" style={{ color: "var(--c-pink)" }}>
          Фокус периода
        </p>
        <p className="text-[13px] font-semibold text-[var(--ink-faint)]">
          Короткая формулировка фокуса. Показывается на Сегодня и Карте.
        </p>
        <textarea
          className="field resize-none"
          rows={2}
          value={vision}
          onChange={(e) => setVision(e.target.value)}
          placeholder="Например: спокойная сильная женщина с ясным телом, речью и делом"
        />
        <button type="submit" className="btn btn-primary" disabled={busy}>
          Сохранить видение
        </button>
      </form>

      <section className="panel panel-tint-violet space-y-3">
        <p className="text-[13px] font-bold" style={{ color: "var(--c-violet)" }}>
          Тема
        </p>
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

      <form onSubmit={saveCapacity} className="panel panel-tint-cyan space-y-4">
        <p className="text-[13px] font-bold" style={{ color: "var(--c-cyan)" }}>
          Ёмкость дня
        </p>
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
