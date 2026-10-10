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

type Creds = { login: string; password: string };

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
  const [lastIssued, setLastIssued] = useState<Creds | null>(null);
  const [myCreds, setMyCreds] = useState<Creds | null>(null);
  const [ownerLoginName, setOwnerLoginName] = useState("owner");

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
    setOwnerLoginName(String(data.ownerLogin ?? "owner"));
    if (data.myLogin && data.myPassword) {
      setMyCreds({ login: String(data.myLogin), password: String(data.myPassword) });
    }
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

  async function suggestPassword() {
    const res = await fetch("/api/admin", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "suggestPassword" }),
    });
    const data = await res.json();
    if (res.ok && data.password) setPassword(String(data.password));
  }

  async function resetMyPassword() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ensureOwner" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(String(data.error ?? "Ошибка"));
        return;
      }
      setMyCreds({
        login: String(data.login ?? ownerLoginName),
        password: String(data.password),
      });
      setNote("Новый пароль готов — сохрани.");
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
          password: password || undefined,
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
      setNote("Клиент создан. Скопируй логин и пароль.");
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
    const next = window.prompt(`Новый пароль для ${loginName} (пусто = сгенерировать)`, "");
    if (next === null) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resetPassword",
          id,
          password: next.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(String(data.error ?? "Ошибка"));
        return;
      }
      setLastIssued({ login: loginName, password: String(data.password ?? next) });
      setNote("Пароль обновлён.");
    } finally {
      setBusy(false);
    }
  }

  async function resetData(id: string, loginName: string) {
    if (!window.confirm(`Обнулить все данные «${loginName}»?`)) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resetData", id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(String(data.error ?? "Ошибка"));
        return;
      }
      setNote(`«${loginName}» обнулён.`);
    } finally {
      setBusy(false);
    }
  }

  async function wipeAllClients() {
    if (!window.confirm("Обнулить данные всех клиентов? Твой кабинет не тронется.")) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "wipeClients" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(String(data.error ?? "Ошибка"));
        return;
      }
      setNote(`Обнулено: ${data.wiped ?? 0}`);
    } finally {
      setBusy(false);
    }
  }

  function copyCreds(c: Creds) {
    void navigator.clipboard.writeText(
      `2Mind OS\nлогин: ${c.login}\nпароль: ${c.password}\nвход: ${window.location.origin}`
    );
  }

  if (!authed) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center px-6">
        <form onSubmit={adminLogin} className="surface w-full max-w-sm space-y-4 p-8">
          <h1 className="font-display text-2xl">Админ</h1>
          <p className="text-[14px] text-[var(--ink-soft)]">Ключ из Vercel: MINDOS_ADMIN_SECRET</p>
          <input
            type="password"
            className="field"
            value={adminSecret}
            onChange={(e) => setAdminSecret(e.target.value)}
            placeholder="Ключ"
            autoFocus
          />
          {error ? <p className="text-[13px] text-[var(--bad)]">{error}</p> : null}
          <button className="btn btn-primary w-full" disabled={busy || !adminSecret.trim()}>
            Войти
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-6 py-10">
      <header>
        <h1 className="font-display text-3xl">Клиенты</h1>
      </header>

      {error ? <p className="text-[13px] text-[var(--bad)]">{error}</p> : null}
      {note ? <p className="text-[13px] text-[var(--ok)]">{note}</p> : null}

      <section className="surface space-y-3 p-5">
        <p className="text-[12px] uppercase tracking-[0.12em] text-[var(--ink-faint)]">Твой вход</p>
        <p className="font-mono text-[1.05rem]">
          логин: <strong>{myCreds?.login ?? ownerLoginName}</strong>
        </p>
        {myCreds ? (
          <p className="font-mono text-[1.05rem]">
            пароль: <strong>{myCreds.password}</strong>
          </p>
        ) : (
          <p className="text-[13px] text-[var(--ink-soft)]">
            Пароль уже был выдан раньше. Если забыла — нажми «Новый пароль».
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {myCreds ? (
            <button type="button" className="btn btn-primary" onClick={() => copyCreds(myCreds)}>
              Скопировать
            </button>
          ) : null}
          <button type="button" className="btn" disabled={busy} onClick={() => void resetMyPassword()}>
            Новый пароль
          </button>
        </div>
        <p className="text-[12px] text-[var(--ink-faint)]">
          Заходишь на главную этим логином и паролем — как клиенты.
        </p>
      </section>

      {lastIssued ? (
        <div className="surface space-y-2 p-5">
          <p className="text-[12px] uppercase tracking-[0.12em] text-[var(--ink-faint)]">Клиенту</p>
          <p className="font-mono text-[15px]">
            логин: <strong>{lastIssued.login}</strong>
          </p>
          <p className="font-mono text-[15px]">
            пароль: <strong>{lastIssued.password}</strong>
          </p>
          <button type="button" className="btn" onClick={() => copyCreds(lastIssued)}>
            Скопировать
          </button>
        </div>
      ) : null}

      <form onSubmit={create} className="surface grid gap-3 p-5 sm:grid-cols-2">
        <h2 className="font-display text-xl sm:col-span-2">Новый клиент</h2>
        <input
          className="field"
          placeholder="логин · солнышко"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          autoComplete="off"
        />
        <div className="flex gap-2">
          <input
            className="field min-w-0 flex-1"
            placeholder="пароль · или пусто"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="off"
          />
          <button type="button" className="btn shrink-0" disabled={busy} onClick={() => void suggestPassword()}>
            Сген.
          </button>
        </div>
        <input
          className="field"
          placeholder="имя (необяз.)"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <input className="field" type="date" value={planUntil} onChange={(e) => setPlanUntil(e.target.value)} />
        <button className="btn btn-primary sm:col-span-2" disabled={busy || !login.trim()}>
          Создать
        </button>
      </form>

      <section className="surface flex flex-wrap items-center justify-between gap-3 p-5">
        <p className="text-[13px] text-[var(--ink-soft)]">Обнулить данные всех клиентов</p>
        <button type="button" className="btn" disabled={busy} onClick={() => void wipeAllClients()}>
          Обнулить всех
        </button>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Список · {accounts.length}</h2>
        {accounts.length === 0 ? (
          <p className="text-[14px] text-[var(--ink-soft)]">Пока пусто.</p>
        ) : (
          <ul className="space-y-2">
            {accounts.map((a) => (
              <li key={a.id} className="surface flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">
                    {a.login}
                    {a.login === ownerLoginName ? (
                      <span className="ml-2 text-[12px] text-[var(--ink-faint)]">ты</span>
                    ) : null}
                  </p>
                  <p className="text-[12px] text-[var(--ink-faint)]">
                    {a.status}
                    {a.plan_until ? ` · до ${a.plan_until}` : ""}
                  </p>
                </div>
                {a.login === ownerLoginName ? null : (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn"
                      disabled={busy}
                      onClick={() => void setStatus(a.id, a.status === "active" ? "paused" : "active")}
                    >
                      {a.status === "active" ? "Пауза" : "Вкл"}
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={busy}
                      onClick={() => void resetPassword(a.id, a.login)}
                    >
                      Пароль
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={busy}
                      onClick={() => void resetData(a.id, a.login)}
                    >
                      Обнулить
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
