import { NextResponse } from "next/server";
import { getSession, isTenantMode } from "@/lib/auth";
import { auditStore, PERSISTENCE_GAPS } from "@/lib/store-audit";
import { durabilityStatus, getStore, lastCloudSyncOk, StoreUnavailableError } from "@/lib/store";
import { pingSupabase, supabaseConfigStatus } from "@/lib/supabase";

function skipCloudPing(): boolean {
  const v = process.env.MINDOS_SKIP_CLOUD_PULL?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off") return false;
  // Local-first default: no cloud wait on health (same as store boot).
  return true;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const forceNoPing = searchParams.get("ping") === "0";
  const wantPing = searchParams.get("ping") === "1" || (!forceNoPing && !skipCloudPing());

  // Unauthenticated health probe (DataGuard) must not require a tenant session.
  if (isTenantMode() && !getSession(request)) {
    const supabase = supabaseConfigStatus();
    return NextResponse.json({
      ok: true,
      authenticated: false,
      durability: { weight: 0 },
      supabase: { ...supabase, ping: null, lastCloudSyncOk: null },
      persistence: supabase.configured ? "supabase" : "none",
    });
  }

  let store;
  try {
    store = await getStore();
  } catch (e) {
    if (e instanceof StoreUnavailableError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 503 });
    }
    throw e;
  }
  const durability = await durabilityStatus();

  if (!wantPing) {
    return NextResponse.json({
      ok: true,
      version: store.version,
      durability,
      persistence: "local-json",
    });
  }

  const supabase = supabaseConfigStatus();
  const ping = supabase.configured ? await pingSupabase() : null;
  const audit = auditStore(store);

  return NextResponse.json({
    ok: true,
    version: store.version,
    supabase: {
      ...supabase,
      ping,
      lastCloudSyncOk: lastCloudSyncOk() ?? null,
    },
    durability,
    audit,
    persistenceGaps: PERSISTENCE_GAPS,
    persistence:
      supabase.configured && ping?.snapshotTable === "ok"
        ? "local-json+supabase"
        : "local-json",
  });
}
