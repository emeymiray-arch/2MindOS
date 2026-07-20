import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function supabaseUrl(): string | undefined {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  return url || undefined;
}

export function supabasePublishableKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    undefined
  );
}

export function supabaseSecretKey(): string | undefined {
  return (
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    undefined
  );
}

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl() && (supabasePublishableKey() || supabaseSecretKey()));
}

export function supabaseConfigStatus() {
  return {
    configured: isSupabaseConfigured(),
    url: supabaseUrl() ? "set" : "missing",
    anonKey: supabasePublishableKey() ? "set" : "missing",
    serviceKey: supabaseSecretKey() ? "set" : "missing",
  };
}

let adminClient: SupabaseClient | null = null;
let pubClient: SupabaseClient | null = null;

/** Server-only client (bypasses RLS). */
export function getSupabaseAdmin(): SupabaseClient | null {
  const url = supabaseUrl();
  const key = supabaseSecretKey() || supabasePublishableKey();
  if (!url || !key) return null;
  if (!adminClient) {
    adminClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

/** Browser-safe client (publishable key). */
export function getSupabaseBrowser(): SupabaseClient | null {
  const url = supabaseUrl();
  const key = supabasePublishableKey();
  if (!url || !key) return null;
  if (!pubClient) {
    pubClient = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return pubClient;
}

  export async function pingSupabase(): Promise<{
  ok: boolean;
  snapshotTable: "ok" | "missing" | "error";
  detail?: string;
}> {
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, snapshotTable: "error", detail: "not configured" };

  try {
    const result = await Promise.race([
      sb.from("lifeos_snapshots").select("id").limit(1),
      new Promise<{ data: null; error: { message: string } }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: { message: "timeout" } }), 3000)
      ),
    ]);
    const error = "error" in result ? result.error : null;
    if (!error) return { ok: true, snapshotTable: "ok" };
    const msg = error.message || String(error);
    if (/relation|does not exist|Could not find the table/i.test(msg)) {
      return { ok: true, snapshotTable: "missing", detail: msg };
    }
    if (msg === "timeout") return { ok: true, snapshotTable: "ok", detail: "ping slow" };
    return { ok: false, snapshotTable: "error", detail: msg };
  } catch (e) {
    return { ok: false, snapshotTable: "error", detail: e instanceof Error ? e.message : String(e) };
  }
}
