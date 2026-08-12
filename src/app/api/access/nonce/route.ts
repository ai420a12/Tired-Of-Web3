import { NextResponse } from "next/server";
import {
  ACCESS_KEY_CONTRACT,
  ACCESS_OPENSEA_URL,
  buildAccessMessage,
  normalizeAddress,
} from "@/lib/access-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { address } → message to personal_sign */
export async function POST(request: Request) {
  let body: { address?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const address = normalizeAddress(body.address || "");
  if (!address) {
    return NextResponse.json({ error: "Valid wallet address required" }, { status: 400 });
  }

  const issuedAt = Date.now();
  const message = buildAccessMessage(address, issuedAt);

  return NextResponse.json({
    address,
    issuedAt,
    message,
    contract: ACCESS_KEY_CONTRACT,
    opensea: ACCESS_OPENSEA_URL,
  });
}
