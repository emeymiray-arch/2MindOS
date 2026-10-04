import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  AUTH_COOKIE,
  SESSION_COOKIE,
  apiSecret,
  hashSecretEdge,
  isTenantMode,
  verifySessionValueEdge,
} from "@/lib/auth-edge";

async function verifyRequest(request: NextRequest): Promise<boolean> {
  if (isTenantMode()) {
    const session = await verifySessionValueEdge(request.cookies.get(SESSION_COOKIE)?.value);
    return Boolean(session);
  }

  const secret = apiSecret();
  if (!secret) {
    return true;
  }

  const expected = await hashSecretEdge(secret);
  const cookie = request.cookies.get(AUTH_COOKIE)?.value;
  if (cookie === expected) return true;

  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearer === secret) return true;

  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  response.headers.set("Pragma", "no-cache");

  if (pathname.startsWith("/api/auth")) return response;
  if (pathname.startsWith("/api/admin")) return response;
  if (pathname.startsWith("/api/shortcuts")) return response;

  if (pathname.startsWith("/api/health") && searchParams.get("ping") === "0") {
    return response;
  }

  if (await verifyRequest(request)) return response;

  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export const config = {
  matcher: "/api/:path*",
};
