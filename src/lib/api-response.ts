import { NextResponse } from "next/server";
import { StoreUnavailableError } from "@/lib/store";

/** JSON API response that must never be cached (snapshot flicker). */
export function apiJson(data: unknown, init?: { status?: number }) {
  return NextResponse.json(data, {
    status: init?.status ?? 200,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
    },
  });
}

export function apiError(e: unknown, fallback = "error") {
  if (e instanceof StoreUnavailableError) {
    return apiJson({ error: e.message, retry: true }, { status: 503 });
  }
  const message = e instanceof Error ? e.message : fallback;
  return apiJson({ error: message }, { status: 500 });
}
