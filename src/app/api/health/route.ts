import { NextResponse } from "next/server";
import { durabilityStatus, getStore, lastCloudSyncOk } from "@/lib/store";
import { pingSupabase, supabaseConfigStatus } from "@/lib/supabase";

export async function GET() {
  const store = await getStore();
  const supabase = supabaseConfigStatus();
  const ping = supabase.configured ? await pingSupabase() : null;
  const durability = await durabilityStatus();

  return NextResponse.json({
    ok: true,
    version: store.version,
    supabase: {
      ...supabase,
      ping,
      lastCloudSyncOk: lastCloudSyncOk() ?? null,
    },
    durability,
    persistence:
      supabase.configured && ping?.snapshotTable === "ok"
        ? "local-json+supabase"
        : "local-json",
  });
}
