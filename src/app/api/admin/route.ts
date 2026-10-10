import { NextResponse } from "next/server";
import {
  createAccount,
  findAccountByLogin,
  generateClientPassword,
  listAccounts,
  updateAccount,
  type AccountStatus,
} from "@/lib/accounts";
import { isAdminRequest, ownerLogin } from "@/lib/auth";
import { ensureSnapshot, wipeTenantSnapshot } from "@/lib/cloud-store";
import { createEmptyStore } from "@/lib/seed";
import { migrateStore } from "@/lib/migrate";
import { isSupabaseConfigured } from "@/lib/supabase";
import { clearTenantCache } from "@/lib/store";

export const runtime = "nodejs";

function deny() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

function blankClientStore() {
  const seed = migrateStore(createEmptyStore());
  seed.revision = 1;
  return seed;
}

function isOwnerAccountLogin(login: string) {
  return login.trim().toLocaleLowerCase("ru-RU") === ownerLogin();
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return deny();
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase не настроен" }, { status: 503 });
  }
  const login = ownerLogin();
  let accounts = await listAccounts();
  let owner = accounts.find((a) => isOwnerAccountLogin(a.login)) ?? null;
  let myPassword: string | null = null;

  // First open: create your login+password automatically (same form as clients).
  if (!owner) {
    const password =
      process.env.MINDOS_OWNER_PASSWORD?.trim() || generateClientPassword(7);
    const created = await createAccount({
      login,
      password,
      displayName: "Admin",
    });
    if (created.ok) {
      await ensureSnapshot(created.account.id, blankClientStore());
      myPassword = password;
      accounts = await listAccounts();
      owner = accounts.find((a) => isOwnerAccountLogin(a.login)) ?? created.account;
    }
  }

  return NextResponse.json({
    accounts,
    ownerLogin: login,
    hasOwner: Boolean(owner),
    owner,
    /** Only set when owner was just created — save it. */
    myLogin: myPassword ? login : null,
    myPassword,
  });
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return deny();
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase не настроен" }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "create");

  if (action === "create") {
    const loginRaw = String(body.login ?? "");
    if (isOwnerAccountLogin(loginRaw)) {
      return NextResponse.json(
        { error: `Логин «${ownerLogin()}» зарезервирован — это твой вход` },
        { status: 400 }
      );
    }
    const password =
      String(body.password ?? "").trim() || generateClientPassword(7);
    const result = await createAccount({
      login: loginRaw,
      password,
      displayName: body.displayName ? String(body.displayName) : undefined,
      planUntil: body.planUntil ? String(body.planUntil) : null,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const snap = await ensureSnapshot(result.account.id, blankClientStore());
    if (!snap.ok) {
      return NextResponse.json(
        {
          error: `Аккаунт создан, но snapshot не записался: ${snap.error ?? "unknown"}`,
          account: result.account,
        },
        { status: 500 }
      );
    }
    return NextResponse.json({
      ok: true,
      account: result.account,
      password,
    });
  }

  if (action === "setStatus") {
    const id = String(body.id ?? "");
    const status = String(body.status ?? "") as AccountStatus;
    if (!id || (status !== "active" && status !== "paused")) {
      return NextResponse.json({ error: "id и status обязательны" }, { status: 400 });
    }
    const result = await updateAccount(id, { status });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, account: result.account });
  }

  if (action === "resetPassword") {
    const id = String(body.id ?? "");
    const password =
      String(body.password ?? "").trim() || generateClientPassword(7);
    if (!id) {
      return NextResponse.json({ error: "id обязателен" }, { status: 400 });
    }
    const result = await updateAccount(id, { password });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, account: result.account, password });
  }

  if (action === "update") {
    const id = String(body.id ?? "");
    if (!id) return NextResponse.json({ error: "id обязателен" }, { status: 400 });
    const result = await updateAccount(id, {
      displayName: body.displayName !== undefined ? String(body.displayName || "") || null : undefined,
      planUntil: body.planUntil !== undefined ? String(body.planUntil || "") || null : undefined,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, account: result.account });
  }

  if (action === "resetData") {
    const id = String(body.id ?? "");
    if (!id) return NextResponse.json({ error: "id обязателен" }, { status: 400 });
    const accounts = await listAccounts();
    const acc = accounts.find((a) => a.id === id);
    if (!acc) return NextResponse.json({ error: "Аккаунт не найден" }, { status: 404 });
    if (isOwnerAccountLogin(acc.login)) {
      return NextResponse.json({ error: "Нельзя обнулить кабинет админа" }, { status: 400 });
    }
    const wiped = await wipeTenantSnapshot(id, blankClientStore());
    if (!wiped.ok) {
      return NextResponse.json(
        { error: wiped.error ?? "Не удалось обнулить данные" },
        { status: 500 }
      );
    }
    clearTenantCache(id);
    return NextResponse.json({ ok: true, account: acc });
  }

  if (action === "wipeClients") {
    const accounts = await listAccounts();
    const targets = accounts.filter((a) => !isOwnerAccountLogin(a.login));
    const results: { id: string; login: string; ok: boolean; error?: string }[] = [];
    for (const a of targets) {
      const wiped = await wipeTenantSnapshot(a.id, blankClientStore());
      if (wiped.ok) clearTenantCache(a.id);
      results.push({
        id: a.id,
        login: a.login,
        ok: Boolean(wiped.ok),
        error: wiped.ok ? undefined : wiped.error,
      });
    }
    const failed = results.filter((r) => !r.ok).length;
    return NextResponse.json({
      ok: failed === 0,
      wiped: results.filter((r) => r.ok).length,
      failed,
      results,
    });
  }

  if (action === "suggestPassword") {
    return NextResponse.json({ ok: true, password: generateClientPassword(7) });
  }

  /** Create or reset the product-owner admin login (same login form as clients). */
  if (action === "ensureOwner") {
    const login = ownerLogin();
    const password =
      String(body.password ?? "").trim() ||
      process.env.MINDOS_OWNER_PASSWORD?.trim() ||
      generateClientPassword(7);
    if (password.length < 6) {
      return NextResponse.json({ error: "Пароль минимум 6 символов" }, { status: 400 });
    }
    const existing = await findAccountByLogin(login);
    if (existing) {
      const updated = await updateAccount(existing.id, {
        password,
        status: "active",
        displayName: body.displayName ? String(body.displayName) : existing.display_name,
      });
      if (!updated.ok) {
        return NextResponse.json({ error: updated.error }, { status: 400 });
      }
      return NextResponse.json({
        ok: true,
        created: false,
        account: updated.account,
        password,
        login,
      });
    }
    const created = await createAccount({
      login,
      password,
      displayName: body.displayName ? String(body.displayName) : "Admin",
    });
    if (!created.ok) {
      return NextResponse.json({ error: created.error }, { status: 400 });
    }
    const snap = await ensureSnapshot(created.account.id, blankClientStore());
    if (!snap.ok) {
      return NextResponse.json(
        {
          error: `Owner создан, но snapshot не записался: ${snap.error ?? "unknown"}`,
          account: created.account,
        },
        { status: 500 }
      );
    }
    return NextResponse.json({
      ok: true,
      created: true,
      account: created.account,
      password,
      login,
    });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
