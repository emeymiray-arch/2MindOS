import { NextResponse } from "next/server";
import { findAccountByLogin, isAccountUsable, verifyPassword } from "@/lib/accounts";
import {
  ADMIN_COOKIE,
  AUTH_COOKIE,
  SESSION_COOKIE,
  apiSecret,
  authRequired,
  getSession,
  hashSecret,
  isAdminRequest,
  isAuthenticated,
  isOpenLocalDev,
  isTenantMode,
  sessionSecret,
  signAdminCookie,
  signSession,
  verifyAdminSecret,
  verifySecret,
} from "@/lib/auth";
import { apiJson } from "@/lib/api-response";
import { parseValue, readJson, validationErrorResponse } from "@/lib/api-validate";
import { authSchemas } from "@/lib/schemas/auth";
import { isSupabaseConfigured } from "@/lib/supabase";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function cookieOptions(secure: boolean, maxAge = COOKIE_MAX_AGE) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge,
  };
}

export async function GET(request: Request) {
  const session = getSession(request);
  const tenant = isTenantMode();
  return apiJson({
    configured: tenant
      ? isSupabaseConfigured() &&
        Boolean(process.env.MINDOS_ADMIN_SECRET || process.env.MINDOS_SESSION_SECRET)
      : true,
    openLocal: isOpenLocalDev(request),
    authenticated: isAuthenticated(request),
    needsSetup: tenant && (!isSupabaseConfigured() || !sessionSecret()),
    authRequired: authRequired(),
    tenantMode: tenant,
    login: session?.login ?? null,
    accountId: session?.accountId ?? null,
    isAdmin: isAdminRequest(request),
  });
}

export async function POST(request: Request) {
  try {
    const raw = await readJson(request).catch(() => ({}));
    const action = String((raw as { action?: string } | null)?.action ?? "login");
    const secure = process.env.NODE_ENV === "production";

    if (action === "logout") {
      parseValue(raw, authSchemas.logout);
      const res = NextResponse.json({ ok: true });
      res.cookies.set(SESSION_COOKIE, "", { ...cookieOptions(secure, 0), maxAge: 0 });
      res.cookies.set(AUTH_COOKIE, "", { ...cookieOptions(secure, 0), maxAge: 0 });
      res.cookies.set(ADMIN_COOKIE, "", { ...cookieOptions(secure, 0), maxAge: 0 });
      return res;
    }

    if (action === "adminLogin") {
      const body = parseValue(raw, authSchemas.adminLogin);
      const secret = String(body.secret ?? body.adminSecret ?? "");
      if (!verifyAdminSecret(secret)) {
        return apiJson({ error: "Неверный админ-ключ" }, { status: 401 });
      }
      const token = signAdminCookie();
      if (!token) {
        return apiJson({ error: "MINDOS_ADMIN_SECRET не задан" }, { status: 500 });
      }
      const res = NextResponse.json({ ok: true, isAdmin: true });
      res.cookies.set(ADMIN_COOKIE, token, cookieOptions(secure));
      return res;
    }

    const body = parseValue(raw, authSchemas.login);

    // ——— Multi-tenant login ———
    if (isTenantMode()) {
      const login = String(body.login ?? "").trim();
      const password = String(body.password ?? body.secret ?? "");
      if (!login || !password) {
        return apiJson({ error: "Введи логин и пароль" }, { status: 400 });
      }
      if (!isSupabaseConfigured()) {
        return apiJson({ error: "Сервер не настроен (Supabase)" }, { status: 503 });
      }
      const account = await findAccountByLogin(login);
      if (!account || !verifyPassword(password, account.password_hash)) {
        return apiJson({ error: "Неверный логин или пароль" }, { status: 401 });
      }
      const usable = isAccountUsable(account);
      if (!usable.ok) {
        return apiJson({ error: usable.error }, { status: 403 });
      }
      const token = signSession({ accountId: account.id, login: account.login });
      if (!token) {
        return apiJson({ error: "MINDOS_SESSION_SECRET не задан" }, { status: 500 });
      }
      const res = NextResponse.json({
        ok: true,
        login: account.login,
        accountId: account.id,
        displayName: account.display_name,
      });
      res.cookies.set(SESSION_COOKIE, token, cookieOptions(secure));
      return res;
    }

    // ——— Legacy local / single-secret ———
    if (isOpenLocalDev(request)) {
      return apiJson({ ok: true, mode: "local-dev" });
    }

    const secret = apiSecret();
    if (!secret) {
      return apiJson({ ok: true, mode: "no-secret" });
    }

    const candidate = String(body.secret ?? body.password ?? "");
    if (!verifySecret(candidate)) {
      return apiJson({ error: "Неверный ключ доступа" }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(AUTH_COOKIE, hashSecret(candidate), cookieOptions(secure));
    return res;
  } catch (e) {
    return validationErrorResponse(e) ?? apiJson({ error: "auth failed" }, { status: 500 });
  }
}
