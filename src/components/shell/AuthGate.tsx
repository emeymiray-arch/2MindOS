"use client";

import { useCallback, useEffect, useState } from "react";

type AuthStatus = {
  configured: boolean;
  openLocal: boolean;
  authenticated: boolean;
  needsSetup: boolean;
};

export function AuthGate({ children }: { children: React.ReactNode }) {
  // Optimistic open — avoid blocking the whole app on /api/auth.
  // If the server actually requires login, we swap to the form below.
  const [status, setStatus] = useState<AuthStatus | null>({
    configured: true,
    openLocal: true,
    authenticated: true,
    needsSetup: false,
  });
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/auth", { cache: "no-store", credentials: "include" });
    const data = (await res.json()) as AuthStatus;
    setStatus(data);
    setChecked(true);
    return data;
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "login", secret }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(String(data.error ?? "Не удалось войти"));
        return;
      }
      setSecret("");
      await refresh();
    } finally {
      setBusy(false);
    }
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

  // Don't flash the login form until we've heard from the server.
  if (!checked) {
    return children;
  }

  if (status.needsSetup) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-6">
        <div className="surface max-w-md space-y-3 p-8">
          <h1 className="font-display text-2xl">Сервер не настроен</h1>
          <p className="text-[14px] text-[var(--ink-soft)]">
            Нужна переменная <code>MINDOS_API_SECRET</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-6">
      <form onSubmit={login} className="surface w-full max-w-sm space-y-5 p-8">
        <div>
          <p className="font-display text-[32px]">2Mind</p>
          <p className="mt-1 text-[14px] text-[var(--ink-soft)]">Введи ключ доступа</p>
        </div>
        <input
          type="password"
          autoFocus
          value={secret}
          placeholder="Ключ"
          onChange={(e) => setSecret(e.target.value)}
          className="field"
        />
        {error ? <p className="text-[13px] text-[var(--bad)]">{error}</p> : null}
        <button type="submit" className="btn btn-primary w-full" disabled={busy || !secret.trim()}>
          Войти
        </button>
      </form>
    </div>
  );
}
