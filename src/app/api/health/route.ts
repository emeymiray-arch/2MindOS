import { NextResponse } from "next/server";
import { durabilityStatus, getStore, lastCloudSyncOk } from "@/lib/store";
import { pingSupabase, supabaseConfigStatus } from "@/lib/supabase";

export async function GET(request: Request) {
  const wantPing = new URL(request.url).searchParams.get("ping") !== "0";
  const store = await getStore();
  const supabase = supabaseConfigStatus();
  const ping = wantPing && supabase.configured ? await pingSupabase() : null;
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
      supabase.configured && (ping?.snapshotTable === "ok" || (!wantPing && supabase.configured))
        ? "local-json+supabase"
        : "local-json",
  });
}
