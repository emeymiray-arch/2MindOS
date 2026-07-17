import type { LifeStore } from "./types";
import { getSupabaseAdmin } from "./supabase";

const SNAPSHOT_ID = "default";

export async function pullCloudStore(): Promise<LifeStore | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb
    .from("lifeos_snapshots")
    .select("payload")
    .eq("id", SNAPSHOT_ID)
    .maybeSingle();
  if (error || !data?.payload) return null;
  return data.payload as LifeStore;
}

export async function pushCloudStore(store: LifeStore): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, error: "not configured" };
  const { error } = await sb.from("lifeos_snapshots").upsert({
    id: SNAPSHOT_ID,
    payload: store,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
