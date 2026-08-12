import { NextResponse } from "next/server";
import {
  ACCESS_COOKIE,
  ACCESS_KEY_CONTRACT,
  ACCESS_OPENSEA_URL,
  accessCookieOptions,
  buildAccessMessage,
  createAccessToken,
  getAccessKeyBalance,
  normalizeAddress,
  parseIssuedAt,
  verifyWalletSignature,
} from "@/lib/access-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MESSAGE_AGE_MS = 10 * 60 * 1000;

/** POST { address, message, signature } → verify key ownership + set cookie */
export async function POST(request: Request) {
  let body: { address?: string; message?: string; signature?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const address = normalizeAddress(body.address || "");
  const message = typeof body.message === "string" ? body.message : "";
  const signature = typeof body.signature === "string" ? body.signature : "";

  if (!address || !message || !signature) {
    return NextResponse.json(
      { error: "address, message, and signature are required" },
      { status: 400 },
    );
  }

  const issuedAt = parseIssuedAt(message);
  if (issuedAt == null || Math.abs(Date.now() - issuedAt) > MAX_MESSAGE_AGE_MS) {
    return NextResponse.json(
      { error: "Sign message expired — try Connect Wallet again." },
      { status: 400 },
    );
  }

  const expected = buildAccessMessage(address, issuedAt);
  if (message !== expected) {
    return NextResponse.json({ error: "Invalid sign message" }, { status: 400 });
  }

  const okSig = await verifyWalletSignature({ address, message, signature });
  if (!okSig) {
    return NextResponse.json(
      { error: "Signature verification failed" },
      { status: 401 },
    );
  }

  let balance: bigint;
  try {
    balance = await getAccessKeyBalance(address);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "RPC error";
    console.error("access verify balanceOf failed:", msg);
    return NextResponse.json(
      { error: "Could not check Access Key ownership. Try again." },
      { status: 503 },
    );
  }

  if (balance <= BigInt(0)) {
    return NextResponse.json(
      {
        ok: false,
        hasKey: false,
        balance: "0",
        error: "No Tired Of Web3 Access Key found in this wallet.",
        code: "NO_ACCESS_KEY",
        contract: ACCESS_KEY_CONTRACT,
        opensea: ACCESS_OPENSEA_URL,
      },
      { status: 403 },
    );
  }

  const token = createAccessToken(address);
  const res = NextResponse.json({
    ok: true,
    hasKey: true,
    balance: balance.toString(),
    address,
    contract: ACCESS_KEY_CONTRACT,
  });
  res.cookies.set(ACCESS_COOKIE, token, accessCookieOptions());
  return res;
}
