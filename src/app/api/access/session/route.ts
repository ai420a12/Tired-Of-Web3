import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  ACCESS_COOKIE,
  ACCESS_KEY_CONTRACT,
  ACCESS_OPENSEA_URL,
  readAccessToken,
} from "@/lib/access-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const jar = await cookies();
  const session = readAccessToken(jar.get(ACCESS_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({
      ok: false,
      hasAccess: false,
      contract: ACCESS_KEY_CONTRACT,
      opensea: ACCESS_OPENSEA_URL,
    });
  }
  return NextResponse.json({
    ok: true,
    hasAccess: true,
    address: session.address,
    exp: session.exp,
    contract: ACCESS_KEY_CONTRACT,
    opensea: ACCESS_OPENSEA_URL,
  });
}
