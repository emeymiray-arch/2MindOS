import {
  isDestructiveOverwrite,
  isSparseStore,
  storeWeight,
} from "./store-weight";
import { getSupabaseAdmin } from "./supabase";
import type { LifeStore } from "./types";

const SNAPSHOT_ID = "default";
const HIST_PREFIX = "h-";
const MAX_HISTORY = 12;
const PULL_MS = 4000;
const PUSH_MS = 5000;

export type CloudPull =
  | { ok: true; store: LifeStore | null }
  | { ok: false; store: null; error: string };

async function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T> {
  return await Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

function histId(at = new Date()): string {
  return `${HIST_PREFIX}${at.toISOString().replace(/[:.]/g, "-").slice(0, 19)}`;
}

export async function pullCloudStore(): Promise<LifeStore | null> {
  const result = await pullCloudResult();
  return result.ok ? result.store : null;
}

/** Fast path: only the live `default` snapshot (no history scan). */
export async function pullCloudResult(): Promise<CloudPull> {
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, store: null, error: "not configured" };
  try {
    const { data, error } = await withTimeout(
      sb
        .from("lifeos_snapshots")
        .select("payload")
        .eq("id", SNAPSHOT_ID)
        .maybeSingle(),
      PULL_MS
    );
    if (error) return { ok: false, store: null, error: error.message };
    const payload = (data as { payload?: LifeStore | null } | null)?.payload;
    if (!payload || typeof payload !== "object") return { ok: true, store: null };
    return { ok: true, store: payload };
  } catch (e) {
    return { ok: false, store: null, error: e instanceof Error ? e.message : "pull failed" };
  }
}

/** Richest among default + recent history — for restore only. */
export async function pullCloudBest(): Promise<CloudPull> {
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, store: null, error: "not configured" };
  try {
    const { data, error } = await withTimeout(
      sb
        .from("lifeos_snapshots")
        .select("id, payload, updated_at")
        .order("updated_at", { ascending: false })
        .limit(MAX_HISTORY + 1),
      PULL_MS
    );
    if (error) return { ok: false, store: null, error: error.message };
    const rows = (data ?? []) as { id: string; payload: LifeStore | null }[];
    if (rows.length === 0) return { ok: true, store: null };

    let best: LifeStore | null = null;
    let bestW = -1;
    for (const row of rows) {
      const payload = row.payload;
      if (!payload || typeof payload !== "object") continue;
      const w = storeWeight(payload);
      const preferDefault = row.id === SNAPSHOT_ID && w === bestW;
      if (w > bestW || preferDefault) {
        best = payload;
        bestW = w;
      }
    }
    return { ok: true, store: best };
  } catch (e) {
    return { ok: false, store: null, error: e instanceof Error ? e.message : "pull failed" };
  }
}

export async function pushCloudStore(
  store: LifeStore
): Promise<{ ok: boolean; error?: string; skipped?: string }> {
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, error: "not configured" };

  const existing = await pullCloudResult();
  if (!existing.ok) {
    return { ok: false, error: `cloud unread, refuse push (${existing.error})` };
  }
  if (existing.store) {
    const nextRev = Number(store.revision) || 0;
    const prevRev = Number(existing.store.revision) || 0;
    if (nextRev < prevRev) {
      return { ok: false, skipped: "stale revision, refuse push" };
    }
    if (nextRev === prevRev && storeWeight(store) < storeWeight(existing.store)) {
      return { ok: false, skipped: "same revision but poorer snapshot" };
    }
  }
  if (existing.store && isDestructiveOverwrite(store, existing.store)) {
    return {
      ok: false,
      skipped: "refusing to overwrite a richer cloud snapshot",
    };
  }
  if (isSparseStore(store) && existing.store && storeWeight(existing.store) > storeWeight(store)) {
    return { ok: false, skipped: "sparse local, cloud has more data" };
  }

  try {
    // History copy is best-effort — never block the user-facing save path.
    if (existing.store && !isSparseStore(existing.store)) {
      void withTimeout(
        sb.from("lifeos_snapshots").upsert({
          id: histId(),
          payload: existing.store,
          updated_at: new Date().toISOString(),
        }),
        PUSH_MS
      ).catch(() => undefined);
    }

    const { error } = await withTimeout(
      sb.from("lifeos_snapshots").upsert({
        id: SNAPSHOT_ID,
        payload: store,
        updated_at: new Date().toISOString(),
      }),
      PUSH_MS
    );
    if (error) return { ok: false, error: error.message };

    void pruneHistory(sb);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "push failed" };
  }
}

async function pruneHistory(sb: NonNullable<ReturnType<typeof getSupabaseAdmin>>) {
  try {
    const { data } = await sb
      .from("lifeos_snapshots")
      .select("id, updated_at")
      .like("id", `${HIST_PREFIX}%`)
      .order("updated_at", { ascending: false });
    const extra = (data ?? []).slice(MAX_HISTORY);
    if (extra.length === 0) return;
    await sb.from("lifeos_snapshots").delete().in(
      "id",
      extra.map((r) => r.id)
    );
  } catch (e) {
    console.error("[mindos] history prune failed:", e);
  }
}
