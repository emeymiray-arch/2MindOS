"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ACCENT_COLORS,
  ACCENT_HEX,
  ACCENT_LABELS,
  isAccentColor,
  persistAccent,
  type AccentColor,
} from "@/lib/accent";
import { apiGet, apiPost } from "@/lib/client-api";
import { PageHero, WidgetHead } from "@/components/ui/Widgets";
import { toast } from "@/components/ui/Toast";

export default function SettingsPage() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [accent, setAccent] = useState<AccentColor>("green");
  const [capacity, setCapacity] = useState("6");
  const [capacityMin, setCapacityMin] = useState("270");
  const [vision, setVision] = useState("");
  const [busy, setBusy] = useState(false);
  const [login, setLogin] = useState<string | null>(null);
  const [tenantMode, setTenantMode] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [goals, setGoals] = useState<number | null>(null);

  useEffect(() => {
    void apiGet("/api/auth").then((res) => {
      if (!res.ok) return;
      const d = res.data as {
        login?: string | null;
        tenantMode?: boolean;
        isAdmin?: boolean;
      };
      setLogin(d.login ?? null);
      setTenantMode(Boolean(d.tenantMode));
      setIsAdmin(Boolean(d.isAdmin));
    });
    void apiGet("/api/state").then((res) => {
      if (!res.ok) return;
      const s = res.data.settings as {
        theme?: string;
        accentColor?: string;
        dailyCapacity?: number;
        dailyCapacityMinutes?: number;
        visionNote?: string;
      };
      if (s?.theme === "dark" || s?.theme === "light") setTheme(s.theme);
      if (isAccentColor(s?.accentColor)) {
        setAccent(s.accentColor);
        persistAccent(s.accentColor);
      }
      if (s?.dailyCapacity != null) setCapacity(String(s.dailyCapacity));
      if (s?.dailyCapacityMinutes != null) setCapacityMin(String(s.dailyCapacityMinutes));
      if (s?.visionNote != null) setVision(s.visionNote);
      const g = (res.data as { goals?: unknown[] }).goals;
      if (Array.isArray(g)) setGoals(g.filter((x) => !(x as { archived?: boolean }).archived).length);
    });
  }, []);

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

  async function saveAccent(next: AccentColor) {
    setAccent(next);
    persistAccent(next);
    const res = await apiPost("/api/state", {
      action: "settings",
      settings: { accentColor: next },
    });
    if (!res.ok) toast(res.error ?? "Не сохранилось", "warn");
    else toast("Акцент сохранён", "ok");
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

  async function logout() {
    setBusy(true);
    await fetch("/api/auth", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    window.location.href = "/";
  }

  async function exportJson() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await apiPost("/api/state", { action: "export" });
      if (!res.ok) {
        toast(res.error ?? "Не удалось экспортировать", "warn");
        return;
      }
      const blob = new Blob([JSON.stringify(res.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const day = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `2MindOS-${login || "export"}-${day}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast("JSON скачан", "ok");
    } finally {
      setBusy(false);
    }
  }

  async function restartOnboarding() {
    setBusy(true);
    const res = await apiPost("/api/state", {
      action: "settings",
      settings: { onboardingDone: false },
    });
    setBusy(false);
    if (!res.ok) {
      toast(res.error ?? "Не удалось", "warn");
      return;
    }
    window.location.href = "/";
  }

  return (
    <div className="page-stack">
      <PageHero
        title="Профиль"
      />

      {tenantMode ? (
        <section className="panel panel-tint-blue space-y-3 rise-in">
          <p className="text-[13px] font-bold" style={{ color: "var(--c-blue)" }}>
            Аккаунт
          </p>
          <p className="font-display text-[1.5rem]">{login ?? "…"}</p>
          <p className="text-[13px] font-semibold text-[var(--ink-soft)]">
            {goals != null ? `${goals} целей в профиле` : "Профиль синхронизирован"}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" className="btn" disabled={busy} onClick={() => void logout()}>
              Выйти
            </button>
            <Link href="/privacy" className="btn">
              Хранение данных
            </Link>
            {(isAdmin || login === "owner") && (
              <Link href="/admin" className="btn btn-primary">
                Клиенты
              </Link>
            )}
          </div>
        </section>
      ) : null}

      <section className="panel panel-tint-green space-y-3 rise-in">
        <p className="text-[13px] font-bold" style={{ color: "var(--c-green)" }}>
          Экспорт
        </p>
        <p className="text-[13px] font-semibold text-[var(--ink-faint)]">
          Скачайте копию своего профиля: Excel-сводка или JSON для резерва.
        </p>
        <div className="flex flex-wrap gap-2">
          <a href="/api/export" className="btn btn-primary" download>
            Excel · сводка
          </a>
          <button type="button" className="btn" disabled={busy} onClick={() => void exportJson()}>
            JSON · полный профиль
          </button>
        </div>
      </section>

      <form onSubmit={saveVision} className="panel panel-tint-pink space-y-3 rise-in">
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

      <section className="panel space-y-4 rise-in">
        <WidgetHead title="Акцент" tone="green" />
        <p className="text-[13px] text-[var(--ink-faint)]">
          Цвет кнопок, активной вкладки и акцентов по всему приложению.
        </p>
        <div className="flex flex-wrap gap-2">
          {ACCENT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className="chip-soft"
              data-active={accent === c}
              onClick={() => void saveAccent(c)}
              style={
                accent === c
                  ? {
                      background: ACCENT_HEX[c],
                      color: c === "yellow" ? "#111" : "#fff",
                      borderColor: ACCENT_HEX[c],
                    }
                  : { borderColor: `${ACCENT_HEX[c]}66`, color: ACCENT_HEX[c] }
              }
            >
              {ACCENT_LABELS[c]}
            </button>
          ))}
        </div>
      </section>

      <section className="panel space-y-3 rise-in">
        <WidgetHead title="Тема" tone="violet" />
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

      <form onSubmit={saveCapacity} className="panel panel-tint-cyan space-y-4 rise-in">
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

      <section className="panel space-y-3 rise-in">
        <p className="text-[13px] font-bold text-[var(--ink-soft)]">Знакомство</p>
        <p className="text-[13px] text-[var(--ink-faint)]">
          Короткий старт: фокус, первая цель и привычка.
        </p>
        <button type="button" className="btn" disabled={busy} onClick={() => void restartOnboarding()}>
          Пройти снова
        </button>
      </section>
    </div>
  );
}
