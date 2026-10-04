/** Edge-safe auth helpers (no Node crypto). Used by middleware. */

export const AUTH_COOKIE = "mindos_auth";
export const SESSION_COOKIE = "mindos_session";
export const ADMIN_COOKIE = "mindos_admin";

export type SessionPayload = {
  accountId: string;
  login: string;
  exp: number;
};

export function apiSecret(): string | null {
  const s = process.env.MINDOS_API_SECRET?.trim();
  return s || null;
}

export function adminSecret(): string | null {
  const s = process.env.MINDOS_ADMIN_SECRET?.trim();
  return s || null;
}

export function sessionSecret(): string | null {
  const s =
    process.env.MINDOS_SESSION_SECRET?.trim() ||
    process.env.MINDOS_ADMIN_SECRET?.trim() ||
    process.env.MINDOS_API_SECRET?.trim();
  return s || null;
}

export function isTenantMode(): boolean {
  if (process.env.MINDOS_MULTI_TENANT?.trim() === "1") return true;
  if (process.env.VERCEL === "1") return true;
  if (process.env.MINDOS_CLOUD_PRIMARY?.trim() === "1") return true;
  return false;
}

export async function hashSecretEdge(secret: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function verifySessionValueEdge(cookie: string | undefined): Promise<SessionPayload | null> {
  if (!cookie) return null;
  const secret = sessionSecret();
  if (!secret) return null;
  const [data, sig] = cookie.split(".");
  if (!data || !sig) return null;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  const expected = bytesToBase64Url(new Uint8Array(mac));
  if (sig.length !== expected.length) return null;
  let ok = 0;
  for (let i = 0; i < sig.length; i++) ok |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (ok !== 0) return null;
  try {
    const padded = data.replace(/-/g, "+").replace(/_/g, "/");
    const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
    const raw = atob(padded + pad);
    const payload = JSON.parse(raw) as SessionPayload;
    if (!payload.accountId || !payload.login || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
