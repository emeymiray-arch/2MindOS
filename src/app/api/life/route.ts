import { NextResponse } from "next/server";

/** Orphaned home brain — use /api/os. Kept so old clients get a clear redirect. */
export async function GET() {
  return NextResponse.json(
    {
      error: "moved",
      message: "Используй /api/os — /api/life больше не является home brain",
      use: "/api/os",
    },
    { status: 410 }
  );
}
