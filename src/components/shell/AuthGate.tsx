"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type AuthStatus = {
  configured: boolean;
  openLocal: boolean;
  authenticated: boolean;
  needsSetup: boolean;
  tenantMode?: boolean;
  login?: string | null;
};

const DEV_OPEN: AuthStatus = {
  configured: true,
  openLocal: true,
  authenticated: true,
  needsSetup: false,
  tenantMode: false,
};

function isPublicPath(pathname: string | null) {
  if (!pathname) return false;
  return pathname.startsWith("/admin") || pathname.startsWith("/privacy");
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDev = process.env.NODE_ENV === "development";
  // Local/dev: paint the app immediately — never sit on a black loading screen.
  const [status, setStatus] = useState<AuthStatus | null>(isDev ? DEV_OPEN : null);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(isDev);
  const publicRoute = isPublicPath(pathname);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth", { cache: "no-store", credentials: "include" });
      const data = (await res.json()) as AuthStatus;
      setStatus(data);
      return data;
    } catch {
      setStatus((prev) => prev ?? DEV_OPEN);
      return DEV_OPEN;
    } finally {
      setChecked(true);
    }
  }, []);

  useEffect(() => {
    if (publicRoute) {
      setChecked(true);
      return;
    }
    void refresh();
  }, [refresh, publicRoute]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const tenant = status?.tenantMode;
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(
          tenant
            ? { action: "login", login, password }
            : { action: "login", secret: password || login }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(String(data.error ?? "Не удалось войти"));
        return;
      }
      setLogin("");
      setPassword("");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (publicRoute) {
    return children;
  }

  if (!checked || !status) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[var(--bg)] px-6">
        <p className="text-[1.1rem] font-semibold text-[var(--ink)]">2Mind OS</p>
        <p className="text-[14px] font-medium text-[var(--accent)]">Загрузка…</p>
      </div>
    );
  }

  if (status.authenticated || status.openLocal) {
    return children;
  }

  if (status.needsSetup) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-6">
        <div className="surface max-w-md space-y-3 p-8">
          <h1 className="font-display text-2xl">Сервер не настроен</h1>
          <p className="text-[14px] text-[var(--ink-soft)]">
            Нужны Supabase и секреты <code>MINDOS_ADMIN_SECRET</code> /{" "}
            <code>MINDOS_SESSION_SECRET</code>.
          </p>
        </div>
      </div>
    );
  }

  const tenant = Boolean(status.tenantMode);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-6">
      <form onSubmit={submit} className="surface w-full max-w-sm space-y-5 p-8">
        <div>
          <p className="font-display text-[2.1rem]">2Mind OS</p>
          <p className="mt-2 text-[15px] text-[var(--ink-soft)]">
            {tenant ? "Вход в личный кабинет" : "Введи ключ доступа"}
          </p>
        </div>
        {tenant ? (
          <>
            <input
              type="text"
              autoFocus
              autoComplete="username"
              value={login}
              placeholder="Логин"
              onChange={(e) => setLogin(e.target.value)}
              className="field"
            />
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              placeholder="Пароль"
              onChange={(e) => setPassword(e.target.value)}
              className="field"
            />
            <p className="text-[12px] text-[var(--ink-faint)]">
              Логин и пароль выдаёт администратор. Работает с любого устройства.
            </p>
          </>
        ) : (
          <input
            type="password"
            autoFocus
            value={password}
            placeholder="Ключ"
            onChange={(e) => setPassword(e.target.value)}
            className="field"
          />
        )}
        {error ? <p className="text-[13px] text-[var(--bad)]">{error}</p> : null}
        <button
          type="submit"
          className="btn btn-primary w-full"
          disabled={busy || (tenant ? !login.trim() || !password.trim() : !password.trim())}
        >
          Войти
        </button>
        <p className="text-center text-[12px] leading-relaxed text-[var(--ink-faint)]">
          Входя, вы соглашаетесь с{" "}
          <Link href="/privacy" className="font-semibold text-[var(--accent)] underline-offset-2 hover:underline">
            условиями хранения данных
          </Link>
          .
        </p>
      </form>
    </div>
  );
}
