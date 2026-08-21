import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Prevent CDN/browser from serving stale API snapshots (causes flicker). */
export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  response.headers.set("Pragma", "no-cache");
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
