import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SNIPER_HOSTS } from "@/lib/site-domains";

/** On tiredofweb3.xyz, serve the sniper dashboard at the root. */
export function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase();
  if (!host || !SNIPER_HOSTS.has(host)) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // APIs, app routes, and static assets must never be rewritten
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/hood-rpc") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/videos") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  if (pathname === "/" || pathname === "") {
    url.pathname = "/hood-rpc";
    return NextResponse.rewrite(url);
  }
  if (pathname === "/eth" || pathname.startsWith("/eth/")) {
    url.pathname = `/hood-rpc${pathname}`;
    return NextResponse.rewrite(url);
  }

  // Unknown paths on this host → sniper home
  url.pathname = "/hood-rpc";
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|mp4|webm)$).*)",
  ],
};
