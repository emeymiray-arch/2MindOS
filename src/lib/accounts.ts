import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { getSupabaseAdmin } from "./supabase";

export type AccountStatus = "active" | "paused";

export type Account = {
  id: string;
  login: string;
  password_hash: string;
  status: AccountStatus;
  display_name: string | null;
  plan_until: string | null;
  created_at: string;
  updated_at: string;
};

export type AccountPublic = Omit<Account, "password_hash">;

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;

export function newAccountId(): string {
  return `acc_${randomBytes(12).toString("hex")}`;
}

/** Format: scrypt$saltHex$hashHex */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") {
    // Legacy plain sha256 (should not be used for new accounts)
    const legacy = createHash("sha256").update(password).digest("hex");
    try {
      const a = Buffer.from(legacy);
      const b = Buffer.from(stored);
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  const actual = scryptSync(password, salt, expected.length, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  try {
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function publicAccount(row: Account): AccountPublic {
  return {
    id: row.id,
    login: row.login,
    status: row.status,
    display_name: row.display_name,
    plan_until: row.plan_until,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Normalize login for storage/lookup (Unicode-aware). */
export function normalizeLogin(login: string): string {
  return login.trim().toLocaleLowerCase("ru-RU");
}

/** Login like «солнышко» or «anna.01» — letters (any language), digits, . _ - */
export function isValidLogin(login: string): boolean {
  const n = normalizeLogin(login);
  if (n.length < 3 || n.length > 40) return false;
  return /^[\p{L}\p{N}._-]+$/u.test(n);
}

export async function findAccountByLogin(login: string): Promise<Account | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const normalized = normalizeLogin(login);
  const { data, error } = await sb.from("accounts").select("*").eq("login", normalized).maybeSingle();
  if (error || !data) return null;
  return data as Account;
}

/** Random numeric password, e.g. 5362729 */
export function generateClientPassword(digits = 7): string {
  const n = Math.max(6, Math.min(12, digits));
  let out = "";
  for (let i = 0; i < n; i++) {
    out += String(randomBytes(1)[0] % 10);
  }
  // avoid leading zero for a cleaner look
  if (out[0] === "0") out = String(1 + (randomBytes(1)[0] % 9)) + out.slice(1);
  return out;
}

export async function findAccountById(id: string): Promise<Account | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb.from("accounts").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return data as Account;
}

export async function listAccounts(): Promise<AccountPublic[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const { data, error } = await sb
    .from("accounts")
    .select("id, login, status, display_name, plan_until, created_at, updated_at")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as AccountPublic[];
}

export async function createAccount(input: {
  login: string;
  password: string;
  displayName?: string;
  planUntil?: string | null;
}): Promise<{ ok: true; account: AccountPublic } | { ok: false; error: string }> {
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, error: "cloud not configured" };

  const login = normalizeLogin(input.login);
  if (!isValidLogin(login)) {
    return { ok: false, error: "Логин: 3–40 символов (буквы любого языка, цифры, . _ -)" };
  }
  if (!input.password || input.password.length < 6) {
    return { ok: false, error: "Пароль минимум 6 символов (например 5362729)" };
  }

  const existing = await findAccountByLogin(login);
  if (existing) return { ok: false, error: "Такой логин уже есть" };

  const now = new Date().toISOString();
  const row: Account = {
    id: newAccountId(),
    login,
    password_hash: hashPassword(input.password),
    status: "active",
    display_name: input.displayName?.trim() || null,
    plan_until: input.planUntil?.trim() || null,
    created_at: now,
    updated_at: now,
  };

  const { error } = await sb.from("accounts").insert(row);
  if (error) return { ok: false, error: error.message };
  return { ok: true, account: publicAccount(row) };
}

export async function updateAccount(
  id: string,
  patch: {
    status?: AccountStatus;
    password?: string;
    displayName?: string | null;
    planUntil?: string | null;
  }
): Promise<{ ok: true; account: AccountPublic } | { ok: false; error: string }> {
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, error: "cloud not configured" };

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status) updates.status = patch.status;
  if (patch.password) {
    if (patch.password.length < 6) return { ok: false, error: "Пароль минимум 6 символов" };
    updates.password_hash = hashPassword(patch.password);
  }
  if (patch.displayName !== undefined) updates.display_name = patch.displayName;
  if (patch.planUntil !== undefined) updates.plan_until = patch.planUntil;

  const { data, error } = await sb.from("accounts").update(updates).eq("id", id).select("*").maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Аккаунт не найден" };
  return { ok: true, account: publicAccount(data as Account) };
}

export function isAccountUsable(account: Account): { ok: true } | { ok: false; error: string } {
  if (account.status !== "active") return { ok: false, error: "Доступ приостановлен" };
  if (account.plan_until) {
    const end = account.plan_until.slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    if (end < today) return { ok: false, error: "Срок доступа истёк" };
  }
  return { ok: true };
}
