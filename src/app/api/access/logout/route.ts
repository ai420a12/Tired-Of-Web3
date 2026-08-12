import { NextResponse } from "next/server";
import { ACCESS_COOKIE, accessCookieOptions } from "@/lib/access-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACCESS_COOKIE, "", { ...accessCookieOptions(0), maxAge: 0 });
  return res;
}
