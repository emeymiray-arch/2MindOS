import { NextResponse } from "next/server";
import { auditStore, PERSISTENCE_GAPS } from "@/lib/store-audit";
import { durabilityStatus, getStore, lastCloudSyncOk, storeWeight } from "@/lib/store";
import { pingSupabase, supabaseConfigStatus } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const minimal = searchParams.get("ping") === "0";

  if (minimal) {
    const store = await getStore();
    return NextResponse.json({
      ok: true,
      durability: { weight: storeWeight(store), goals: store.goals?.length ?? 0 },
    });
  }

  const wantPing = true;
  const store = await getStore();
  const supabase = supabaseConfigStatus();
  const ping = wantPing && supabase.configured ? await pingSupabase() : null;
  const durability = await durabilityStatus();
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
      supabase.configured && (ping?.snapshotTable === "ok" || (!wantPing && supabase.configured))
        ? "local-json+supabase"
        : "local-json",
  });
}
