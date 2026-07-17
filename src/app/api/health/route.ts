import { NextResponse } from "next/server";
import { supabaseConfigStatus } from "@/lib/supabase";
import { getStore } from "@/lib/store";

export async function GET() {
  const store = await getStore();
  return NextResponse.json({
    ok: true,
    version: store.version,
    supabase: supabaseConfigStatus(),
    persistence: "local-json",
  });
}
