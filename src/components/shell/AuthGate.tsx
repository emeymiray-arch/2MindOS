"use client";

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

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [status, setStatus] = useState<AuthStatus | null>({
    configured: true,
    openLocal: true,
    authenticated: true,
    needsSetup: false,
  });
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);
  const isAdminRoute = Boolean(pathname?.startsWith("/admin"));

  const refresh = useCallback(async () => {
    const res = await fetch("/api/auth", { cache: "no-store", credentials: "include" });
    const data = (await res.json()) as AuthStatus;
    setStatus(data);
    setChecked(true);
    return data;
  }, []);

  useEffect(() => {
    if (isAdminRoute) return;
    void refresh();
  }, [refresh, isAdminRoute]);

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

  // Admin has its own gate — don't require customer login.
  if (isAdminRoute) {
    return children;
  }

  if (!status) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
        <p className="text-[var(--ink-faint)]">…</p>
      </div>
    );
  }

  if (status.authenticated || status.openLocal) {
    return children;
  }

  if (!checked) {
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
          <p className="font-display text-[2.1rem]">2Mind</p>
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
      </form>
    </div>
  );
}
