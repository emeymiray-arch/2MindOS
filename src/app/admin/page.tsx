"use client";

import { useCallback, useEffect, useState } from "react";

type Account = {
  id: string;
  login: string;
  status: "active" | "paused";
  display_name: string | null;
  plan_until: string | null;
  created_at: string;
  updated_at: string;
};

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [adminSecret, setAdminSecret] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [planUntil, setPlanUntil] = useState("");
  const [lastIssued, setLastIssued] = useState<{ login: string; password: string } | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin", { credentials: "include", cache: "no-store" });
    if (res.status === 401) {
      setAuthed(false);
      return;
    }
    const data = await res.json();
    if (!res.ok) {
      setError(String(data.error ?? "Ошибка"));
      return;
    }
    setAuthed(true);
    setAccounts(data.accounts ?? []);
    setError("");
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function adminLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "adminLogin", secret: adminSecret }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(String(data.error ?? "Неверный ключ"));
        return;
      }
      setAdminSecret("");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNote("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          login,
          password,
          displayName: displayName || undefined,
          planUntil: planUntil || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(String(data.error ?? "Не создано"));
        return;
      }
      setLastIssued({ login: data.account.login, password: String(data.password ?? password) });
      setLogin("");
      setPassword("");
      setDisplayName("");
      setPlanUntil("");
      setNote("Клиент создан. Скопируй логин и пароль — пароль больше не покажется.");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: "active" | "paused") {
    setBusy(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setStatus", id, status }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(String(data.error ?? "Ошибка"));
        return;
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(id: string, loginName: string) {
    const next = window.prompt(`Новый пароль для ${loginName}`, "");
    if (!next) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resetPassword", id, password: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(String(data.error ?? "Ошибка"));
        return;
      }
      setLastIssued({ login: loginName, password: next });
      setNote("Пароль обновлён.");
    } finally {
      setBusy(false);
    }
  }

  if (!authed) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center px-6">
        <form onSubmit={adminLogin} className="surface w-full max-w-sm space-y-4 p-8">
          <h1 className="font-display text-2xl">Клиенты</h1>
          <p className="text-[14px] text-[var(--ink-soft)]">
            Войди как <code>owner</code> в основном приложении и открой эту страницу снова — или
            введи админ-ключ.
          </p>
          <input
            type="password"
            className="field"
            value={adminSecret}
            onChange={(e) => setAdminSecret(e.target.value)}
            placeholder="Админ-ключ"
            autoFocus
          />
          {error ? <p className="text-[13px] text-[var(--bad)]">{error}</p> : null}
          <button className="btn btn-primary w-full" disabled={busy || !adminSecret.trim()}>
            Войти
          </button>
          <a href="/" className="btn w-full text-center">
            На главную
          </a>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-6 py-10">
      <header className="space-y-1">
        <p className="text-[12px] uppercase tracking-[0.14em] text-[var(--ink-faint)]">Админ</p>
        <h1 className="font-display text-3xl">Клиенты</h1>
        <p className="text-[14px] text-[var(--ink-soft)]">
          Выдача логинов. Саморегистрации нет.
        </p>
      </header>

      {error ? <p className="text-[13px] text-[var(--bad)]">{error}</p> : null}
      {note ? <p className="text-[13px] text-[var(--ok)]">{note}</p> : null}

      {lastIssued ? (
        <div className="surface space-y-2 p-5">
          <p className="text-[12px] uppercase tracking-[0.12em] text-[var(--ink-faint)]">Выдано</p>
          <p className="font-mono text-[15px]">
            логин: <strong>{lastIssued.login}</strong>
          </p>
          <p className="font-mono text-[15px]">
            пароль: <strong>{lastIssued.password}</strong>
          </p>
          <button
            type="button"
            className="btn"
            onClick={() =>
              void navigator.clipboard.writeText(
                `2MindOS\nлогин: ${lastIssued.login}\nпароль: ${lastIssued.password}\nвход: ${window.location.origin}`
              )
            }
          >
            Скопировать в буфер
          </button>
        </div>
      ) : null}

      <form onSubmit={create} className="surface grid gap-3 p-5 sm:grid-cols-2">
        <h2 className="font-display text-xl sm:col-span-2">Новый клиент</h2>
        <input className="field" placeholder="логин" value={login} onChange={(e) => setLogin(e.target.value)} />
        <input
          className="field"
          placeholder="пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <input
          className="field"
          placeholder="имя (необязательно)"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <input
          className="field"
          type="date"
          placeholder="plan until"
          value={planUntil}
          onChange={(e) => setPlanUntil(e.target.value)}
        />
        <button className="btn btn-primary sm:col-span-2" disabled={busy || !login || !password}>
          Создать доступ
        </button>
      </form>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Список · {accounts.length}</h2>
        {accounts.length === 0 ? (
          <p className="text-[14px] text-[var(--ink-soft)]">Пока никого нет.</p>
        ) : (
          <ul className="space-y-2">
            {accounts.map((a) => (
              <li key={a.id} className="surface flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{a.login}</p>
                  <p className="text-[12px] text-[var(--ink-faint)]">
                    {a.display_name ? `${a.display_name} · ` : ""}
                    {a.status}
                    {a.plan_until ? ` · до ${a.plan_until}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {a.status === "active" ? (
                    <button type="button" className="btn" disabled={busy} onClick={() => void setStatus(a.id, "paused")}>
                      Пауза
                    </button>
                  ) : (
                    <button type="button" className="btn" disabled={busy} onClick={() => void setStatus(a.id, "active")}>
                      Включить
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn"
                    disabled={busy}
                    onClick={() => void resetPassword(a.id, a.login)}
                  >
                    Новый пароль
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
