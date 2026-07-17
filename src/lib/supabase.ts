/**
 * Supabase client scaffolding.
 * Fill NEXT_PUBLIC_SUPABASE_URL in `.env.local` (from Dashboard → Settings → API).
 * Keys can be either legacy anon/service_role or new sb_publishable / sb_secret.
 */

export function supabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || undefined;
}

export function supabasePublishableKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    undefined
  );
}

export function supabaseSecretKey(): string | undefined {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || undefined;
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
