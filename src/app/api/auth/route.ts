import { NextResponse } from "next/server";
import {
  AUTH_COOKIE,
  apiSecret,
  authRequired,
  hashSecret,
  isAuthenticated,
  isOpenLocalDev,
  verifySecret,
} from "@/lib/auth";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function cookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
}

export async function GET(request: Request) {
  return NextResponse.json({
    configured: true,
    openLocal: isOpenLocalDev(request),
    authenticated: isAuthenticated(request),
    needsSetup: false,
    authRequired: authRequired(),
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "login");

  if (action === "logout") {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(AUTH_COOKIE, "", { ...cookieOptions(true), maxAge: 0 });
    return res;
  }

  if (isOpenLocalDev(request)) {
    return NextResponse.json({ ok: true, mode: "local-dev" });
  }

  const secret = apiSecret();
  if (!secret) {
    return NextResponse.json({ ok: true, mode: "no-secret" });
  }

  const candidate = String(body.secret ?? "");
  if (!verifySecret(candidate)) {
    return NextResponse.json({ error: "Неверный ключ доступа" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  const secure = process.env.NODE_ENV === "production";
  res.cookies.set(AUTH_COOKIE, hashSecret(candidate), cookieOptions(secure));
  return res;
}
