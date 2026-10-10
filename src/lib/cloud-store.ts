import {
  isDestructiveOverwrite,
  isSparseStore,
  storeWeight,
} from "./store-weight";
import { getSupabaseAdmin } from "./supabase";
import type { LifeStore } from "./types";

export const DEFAULT_SNAPSHOT_ID = "default";
const HIST_PREFIX = "h-";
const MAX_HISTORY = 12;
const PULL_MS = 20000;
const PUSH_MS = 12000;

export type CloudPull =
  | { ok: true; store: LifeStore | null; rowRevision: number }
  | { ok: false; store: null; rowRevision: number; error: string };

export type CloudPush =
  | { ok: true }
  | { ok: false; error?: string; conflict?: boolean; skipped?: string };

async function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T> {
  return await Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

function histId(snapshotId: string, at = new Date()): string {
  const stamp = at.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `${HIST_PREFIX}${snapshotId}-${stamp}`;
}

function histLike(snapshotId: string): string {
  return `${HIST_PREFIX}${snapshotId}-%`;
}

function asStore(payload: unknown): LifeStore | null {
  if (!payload || typeof payload !== "object") return null;
  return payload as LifeStore;
}

function revOf(store: LifeStore | null | undefined, rowRevision = 0): number {
  return Math.max(Number(store?.revision) || 0, Number(rowRevision) || 0);
}

export async function pullCloudStore(snapshotId = DEFAULT_SNAPSHOT_ID): Promise<LifeStore | null> {
  const result = await pullCloudResult(snapshotId);
  return result.ok ? result.store : null;
}

async function pullOnce(snapshotId: string): Promise<CloudPull> {
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, store: null, rowRevision: 0, error: "not configured" };
  try {
    const { data, error } = await withTimeout(
      sb
        .from("lifeos_snapshots")
        .select("payload, revision")
        .eq("id", snapshotId)
        .maybeSingle(),
      PULL_MS
    );
    if (error) {
      if (/revision/i.test(error.message)) {
        const legacy = await withTimeout(
          sb.from("lifeos_snapshots").select("payload").eq("id", snapshotId).maybeSingle(),
          PULL_MS
        );
        if (legacy.error) return { ok: false, store: null, rowRevision: 0, error: legacy.error.message };
        const store = asStore((legacy.data as { payload?: unknown } | null)?.payload);
        return { ok: true, store, rowRevision: revOf(store) };
      }
      return { ok: false, store: null, rowRevision: 0, error: error.message };
    }
    const row = data as { payload?: unknown; revision?: number } | null;
    const store = asStore(row?.payload);
    const rowRevision = Number(row?.revision) || 0;
    if (store) store.revision = revOf(store, rowRevision);
    return { ok: true, store, rowRevision: revOf(store, rowRevision) };
  } catch (e) {
    return {
      ok: false,
      store: null,
      rowRevision: 0,
      error: e instanceof Error ? e.message : "pull failed",
    };
  }
}

/** Live snapshot for tenant. Retries once on timeout/network blip. */
export async function pullCloudResult(snapshotId = DEFAULT_SNAPSHOT_ID): Promise<CloudPull> {
  const first = await pullOnce(snapshotId);
  if (first.ok || first.error === "not configured") return first;
  if (!/timeout|network|fetch|terminated/i.test(first.error)) return first;
  return pullOnce(snapshotId);
}

/** Richest among snapshot + that tenant's history — for restore only. */
export async function pullCloudBest(snapshotId = DEFAULT_SNAPSHOT_ID): Promise<CloudPull> {
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, store: null, rowRevision: 0, error: "not configured" };
  try {
    const { data, error } = await withTimeout(
      sb
        .from("lifeos_snapshots")
        .select("id, payload, updated_at")
        .or(`id.eq.${snapshotId},id.like.${HIST_PREFIX}${snapshotId}-%`)
        .order("updated_at", { ascending: false })
        .limit(MAX_HISTORY + 1),
      PULL_MS
    );
    if (error) {
      // Fallback: just live row
      return pullCloudResult(snapshotId);
    }
    const rows = (data ?? []) as { id: string; payload: LifeStore | null }[];
    if (rows.length === 0) return { ok: true, store: null, rowRevision: 0 };

    let best: LifeStore | null = null;
    let bestW = -1;
    for (const row of rows) {
      const payload = row.payload;
      if (!payload || typeof payload !== "object") continue;
      const w = storeWeight(payload);
      const preferLive = row.id === snapshotId && w === bestW;
      if (w > bestW || preferLive) {
        best = payload;
        bestW = w;
      }
    }
    return { ok: true, store: best, rowRevision: revOf(best) };
  } catch (e) {
    return {
      ok: false,
      store: null,
      rowRevision: 0,
      error: e instanceof Error ? e.message : "pull failed",
    };
  }
}

/**
 * Compare-and-swap push: only writes if the row still has `expectedRev`.
 * Prevents stale Vercel isolates from wiping newer saves.
 */
export async function pushCloudCas(
  store: LifeStore,
  expectedRev: number,
  snapshotId = DEFAULT_SNAPSHOT_ID
): Promise<CloudPush> {
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, error: "not configured" };

  const nextRev = Math.max(Number(store.revision) || 0, expectedRev + 1);
  store.revision = nextRev;
  const updatedAt = new Date().toISOString();

  try {
    if (expectedRev <= 0) {
      const { error } = await withTimeout(
        sb.from("lifeos_snapshots").upsert({
          id: snapshotId,
          payload: store,
          revision: nextRev,
          updated_at: updatedAt,
        }),
        PUSH_MS
      );
      if (error) {
        if (/revision/i.test(error.message)) {
          const legacy = await withTimeout(
            sb.from("lifeos_snapshots").upsert({
              id: snapshotId,
              payload: store,
              updated_at: updatedAt,
            }),
            PUSH_MS
          );
          if (legacy.error) return { ok: false, error: legacy.error.message };
          return { ok: true };
        }
        return { ok: false, error: error.message };
      }
      void pruneHistory(sb, snapshotId);
      return { ok: true };
    }

    const { data, error } = await withTimeout(
      sb
        .from("lifeos_snapshots")
        .update({
          payload: store,
          revision: nextRev,
          updated_at: updatedAt,
        })
        .eq("id", snapshotId)
        .eq("revision", expectedRev)
        .select("id"),
      PUSH_MS
    );

    if (error) {
      if (/revision/i.test(error.message)) {
        return pushCloudStoreLegacyCas(store, expectedRev, snapshotId);
      }
      return { ok: false, error: error.message };
    }
    if (!data || data.length === 0) return { ok: false, conflict: true };
    void pruneHistory(sb, snapshotId);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "push failed";
    const check = await pullCloudResult(snapshotId);
    if (check.ok && revOf(check.store, check.rowRevision) >= nextRev) {
      return { ok: true };
    }
    if (/timeout/i.test(msg)) return { ok: false, conflict: true };
    return { ok: false, error: msg };
  }
}

async function pushCloudStoreLegacyCas(
  store: LifeStore,
  expectedRev: number,
  snapshotId: string
): Promise<CloudPush> {
  const existing = await pullCloudResult(snapshotId);
  if (!existing.ok) return { ok: false, error: existing.error };
  const prev = revOf(existing.store, existing.rowRevision);
  if (prev !== expectedRev) return { ok: false, conflict: true };
  if (existing.store && isDestructiveOverwrite(store, existing.store)) {
    return { ok: false, skipped: "refusing to overwrite a richer cloud snapshot" };
  }
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, error: "not configured" };
  const { error } = await withTimeout(
    sb.from("lifeos_snapshots").upsert({
      id: snapshotId,
      payload: store,
      updated_at: new Date().toISOString(),
    }),
    PUSH_MS
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Best-effort push used by local background sync. */
export async function pushCloudStore(
  store: LifeStore,
  snapshotId = DEFAULT_SNAPSHOT_ID
): Promise<CloudPush> {
  const existing = await pullCloudResult(snapshotId);
  if (!existing.ok) {
    return { ok: false, error: `cloud unread, refuse push (${existing.error})` };
  }
  const prevRev = revOf(existing.store, existing.rowRevision);
  const nextRev = Number(store.revision) || 0;
  if (nextRev < prevRev) {
    return { ok: false, skipped: "stale revision, refuse push" };
  }
  if (nextRev === prevRev && existing.store && storeWeight(store) < storeWeight(existing.store)) {
    return { ok: false, skipped: "same revision but poorer snapshot" };
  }
  if (existing.store && isDestructiveOverwrite(store, existing.store)) {
    return { ok: false, skipped: "refusing to overwrite a richer cloud snapshot" };
  }
  if (isSparseStore(store) && existing.store && storeWeight(existing.store) > storeWeight(store)) {
    return { ok: false, skipped: "sparse local, cloud has more data" };
  }

  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, error: "not configured" };

  if (existing.store && !isSparseStore(existing.store)) {
    void withTimeout(
      sb.from("lifeos_snapshots").upsert({
        id: histId(snapshotId),
        payload: existing.store,
        updated_at: new Date().toISOString(),
      }),
      PUSH_MS
    ).catch(() => undefined);
  }

  return pushCloudCas(store, prevRev, snapshotId);
}

/** Seed an empty (or given) store for a new account. */
export async function ensureSnapshot(
  snapshotId: string,
  store: LifeStore
): Promise<CloudPush> {
  const existing = await pullCloudResult(snapshotId);
  if (existing.ok && existing.store) return { ok: true };
  store.revision = 1;
  return pushCloudCas(store, 0, snapshotId);
}

/**
 * Force-replace a tenant snapshot with a clean store and drop history,
 * so pullCloudBest cannot revive old personal data.
 */
export async function wipeTenantSnapshot(
  snapshotId: string,
  store: LifeStore
): Promise<CloudPush> {
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, error: "not configured" };
  if (!snapshotId || snapshotId === DEFAULT_SNAPSHOT_ID) {
    return { ok: false, error: "refuse wipe default snapshot" };
  }

  try {
    await withTimeout(
      sb.from("lifeos_snapshots").delete().like("id", histLike(snapshotId)),
      PUSH_MS
    );
  } catch {
    /* history delete best-effort */
  }

  const existing = await pullCloudResult(snapshotId);
  const prevRev = existing.ok ? existing.rowRevision : 0;
  const next = { ...store, revision: prevRev + 1 };
  let result = await pushCloudCas(next, prevRev, snapshotId);
  if (!result.ok && result.conflict) {
    const again = await pullCloudResult(snapshotId);
    const rev = again.ok ? again.rowRevision : 0;
    result = await pushCloudCas({ ...store, revision: rev + 1 }, rev, snapshotId);
  }
  return result;
}

async function pruneHistory(
  sb: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  snapshotId: string
) {
  try {
    const { data } = await sb
      .from("lifeos_snapshots")
      .select("id, updated_at")
      .like("id", histLike(snapshotId))
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
