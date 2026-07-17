import { NextResponse } from "next/server";
import { lastCloudSyncOk } from "@/lib/store";
import { getStore } from "@/lib/store";
import { pingSupabase, supabaseConfigStatus } from "@/lib/supabase";

export async function GET() {
  const store = await getStore();
  const supabase = supabaseConfigStatus();
  const ping = supabase.configured ? await pingSupabase() : null;

  return NextResponse.json({
    ok: true,
    version: store.version,
    supabase: {
      ...supabase,
      ping,
      lastCloudSyncOk: lastCloudSyncOk() ?? null,
    },
    persistence:
      supabase.configured && ping?.snapshotTable === "ok"
        ? "local-json+supabase"
        : "local-json",
  });
}
