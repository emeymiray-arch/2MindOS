import { NextResponse } from "next/server";
import {
  createAccount,
  listAccounts,
  updateAccount,
  type AccountStatus,
} from "@/lib/accounts";
import { isAdminRequest, adminSecret } from "@/lib/auth";
import { ensureSnapshot } from "@/lib/cloud-store";
import { createEmptyStore } from "@/lib/seed";
import { migrateStore } from "@/lib/migrate";
import { isSupabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";

function deny() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export async function GET(request: Request) {
  if (!adminSecret()) {
    return NextResponse.json({ error: "MINDOS_ADMIN_SECRET не задан" }, { status: 503 });
  }
  if (!isAdminRequest(request)) return deny();
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase не настроен" }, { status: 503 });
  }
  const accounts = await listAccounts();
  return NextResponse.json({ accounts });
}

export async function POST(request: Request) {
  if (!adminSecret()) {
    return NextResponse.json({ error: "MINDOS_ADMIN_SECRET не задан" }, { status: 503 });
  }
  if (!isAdminRequest(request)) return deny();
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase не настроен" }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "create");

  if (action === "create") {
    const result = await createAccount({
      login: String(body.login ?? ""),
      password: String(body.password ?? ""),
      displayName: body.displayName ? String(body.displayName) : undefined,
      planUntil: body.planUntil ? String(body.planUntil) : null,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const seed = migrateStore(createEmptyStore());
    seed.revision = 1;
    const snap = await ensureSnapshot(result.account.id, seed);
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
      password: String(body.password ?? ""),
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
    const password = String(body.password ?? "");
    if (!id || !password) {
      return NextResponse.json({ error: "id и password обязательны" }, { status: 400 });
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

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
