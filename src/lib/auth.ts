import { createHash, createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import {
  ADMIN_COOKIE,
  AUTH_COOKIE,
  SESSION_COOKIE,
  adminSecret,
  apiSecret,
  hashSecretEdge,
  isTenantMode,
  sessionSecret,
  verifySessionValueEdge,
  type SessionPayload,
} from "./auth-edge";

export {
  ADMIN_COOKIE,
  AUTH_COOKIE,
  SESSION_COOKIE,
  adminSecret,
  apiSecret,
  hashSecretEdge,
  isTenantMode,
  sessionSecret,
  verifySessionValueEdge,
  type SessionPayload,
};

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function b64url(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf, "utf8") : buf;
  return b.toString("base64url");
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

export function signSession(
  payload: Omit<SessionPayload, "exp">,
  maxAgeSec = 60 * 60 * 24 * 30
): string | null {
  const secret = sessionSecret();
  if (!secret) return null;
  const body: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + maxAgeSec,
  };
  const data = b64url(JSON.stringify(body));
  const sig = createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifySessionValue(cookie: string | undefined): SessionPayload | null {
  if (!cookie) return null;
  const secret = sessionSecret();
  if (!secret) return null;
  const [data, sig] = cookie.split(".");
  if (!data || !sig) return null;
  const expected = createHmac("sha256", secret).update(data).digest("base64url");
  if (!safeEqual(sig, expected)) return null;
  try {
    const payload = JSON.parse(fromB64url(data).toString("utf8")) as SessionPayload;
    if (!payload.accountId || !payload.login || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function signAdminCookie(): string | null {
  const secret = adminSecret();
  if (!secret) return null;
  return hashSecret(`admin:${secret}`);
}

export function verifyAdminCookie(cookie: string | undefined): boolean {
  const expected = signAdminCookie();
  if (!expected || !cookie) return false;
  return safeEqual(cookie, expected);
}

export function verifyAdminSecret(candidate: string): boolean {
  const secret = adminSecret();
  if (!secret) return false;
  return safeEqual(candidate, secret);
}

export function isLocalHost(request: NextRequest | Request): boolean {
  const host = request.headers.get("host") ?? "";
  return (
    host.startsWith("localhost:") ||
    host.startsWith("127.0.0.1:") ||
    host === "localhost" ||
    host === "127.0.0.1"
  );
}

export function isOpenLocalDev(request: NextRequest | Request): boolean {
  if (isTenantMode()) return false;
  if (apiSecret()) return false;
  void request;
  return true;
}

export function authRequired(): boolean {
  if (isTenantMode()) return true;
  return Boolean(apiSecret());
}

export function verifySecret(candidate: string): boolean {
  const secret = apiSecret();
  if (!secret) return false;
  return safeEqual(candidate, secret);
}

export function verifyCookieValue(cookie: string | undefined): boolean {
  const secret = apiSecret();
  if (!secret || !cookie) return false;
  return safeEqual(cookie, hashSecret(secret));
}

export function verifyBearer(request: Request): boolean {
  const secret = apiSecret();
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return false;
  return safeEqual(m[1], secret);
}

export function getCookie(request: Request, name: string): string | undefined {
  const raw = request.headers.get("cookie");
  if (!raw) return undefined;
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export function getSession(request: Request): SessionPayload | null {
  return verifySessionValue(getCookie(request, SESSION_COOKIE));
}

export function isAuthenticated(request: Request): boolean {
  if (isTenantMode()) {
    return Boolean(getSession(request));
  }
  if (!authRequired()) return true;
  if (isOpenLocalDev(request)) return true;
  return verifyBearer(request) || verifyCookieValue(getCookie(request, AUTH_COOKIE));
}

/** Product owner login can open /admin without a separate admin cookie. */
export function isOwnerAdminSession(request: Request): boolean {
  const session = getSession(request);
  return Boolean(session && session.login === "owner");
}

export function isAdminRequest(request: Request): boolean {
  if (verifyAdminCookie(getCookie(request, ADMIN_COOKIE))) return true;
  if (isOwnerAdminSession(request)) return true;
  const header = request.headers.get("x-mindos-admin") ?? "";
  if (header && verifyAdminSecret(header)) return true;
  const auth = request.headers.get("authorization") ?? "";
  const m = auth.match(/^Admin\s+(.+)$/i);
  if (m && verifyAdminSecret(m[1])) return true;
  return false;
}
