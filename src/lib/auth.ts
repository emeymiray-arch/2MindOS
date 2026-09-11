import { createHash, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

export const AUTH_COOKIE = "mindos_auth";

export function apiSecret(): string | null {
  const s = process.env.MINDOS_API_SECRET?.trim();
  return s || null;
}

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export async function hashSecretEdge(secret: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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

export function isLocalHost(request: NextRequest | Request): boolean {
  const host = request.headers.get("host") ?? "";
  return (
    host.startsWith("localhost:") ||
    host.startsWith("127.0.0.1:") ||
    host === "localhost" ||
    host === "127.0.0.1"
  );
}

/** True when API is open on localhost without a configured secret (dev only). */
export function isOpenLocalDev(request: NextRequest | Request): boolean {
  if (apiSecret()) return false;
  if (process.env.VERCEL === "1") return false;
  return process.env.NODE_ENV === "development" && isLocalHost(request);
}

export function authRequired(): boolean {
  if (apiSecret()) return true;
  if (process.env.VERCEL === "1") return true;
  return false;
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

export function isAuthenticated(request: Request): boolean {
  if (isOpenLocalDev(request)) return true;
  if (!authRequired()) return isLocalHost(request);
  return verifyBearer(request) || verifyCookieValue(getCookie(request, AUTH_COOKIE));
}

function getCookie(request: Request, name: string): string | undefined {
  const raw = request.headers.get("cookie");
  if (!raw) return undefined;
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}
