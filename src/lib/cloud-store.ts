import type { LifeStore } from "./types";
import { getSupabaseAdmin } from "./supabase";

const SNAPSHOT_ID = "default";

async function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T> {
  return await Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

export async function pullCloudStore(): Promise<LifeStore | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  try {
    const { data, error } = await withTimeout(
      sb.from("lifeos_snapshots").select("payload").eq("id", SNAPSHOT_ID).maybeSingle(),
      4000
    );
    if (error || !data?.payload) return null;
    return data.payload as LifeStore;
  } catch {
    return null;
  }
}

export async function pushCloudStore(store: LifeStore): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, error: "not configured" };
  try {
    const { error } = await withTimeout(
      sb.from("lifeos_snapshots").upsert({
        id: SNAPSHOT_ID,
        payload: store,
        updated_at: new Date().toISOString(),
      }),
      8000
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "push failed" };
  }
}
