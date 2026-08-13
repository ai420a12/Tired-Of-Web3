import { NextResponse } from "next/server";
import {
  isAccessDenied,
  requireAccessKey,
} from "@/lib/require-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function alchemyRpc(): string | null {
  const key = (process.env.ALCHEMY_API_KEY || "").trim();
  if (key) return `https://eth-mainnet.g.alchemy.com/v2/${key}`;
  const direct = (process.env.ETH_RPC_URL || process.env.ALCHEMY_RPC_URL || "").trim();
  if (direct.startsWith("http")) return direct;
  return null;
}

const PUBLIC = [
  "https://ethereum.publicnode.com",
  "https://1rpc.io/eth",
] as const;

/** Broadcast a client-signed raw tx (no private keys touch the server). */
export async function POST(req: Request) {
  const access = await requireAccessKey(req);
  if (isAccessDenied(access)) return access;

  let body: { signedTx?: string; chain?: string };
  try {
    body = (await req.json()) as { signedTx?: string; chain?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const signedTx = (body.signedTx || "").trim();
  if (!/^0x[0-9a-fA-F]+$/.test(signedTx) || signedTx.length < 100) {
    return NextResponse.json({ error: "Invalid signedTx" }, { status: 400 });
  }

  const hood =
    body.chain === "hood" || body.chain === "robinhood";
  const hoodRpc =
    process.env.ROBINHOOD_RPC_URL?.trim() ||
    "https://rpc.mainnet.chain.robinhood.com";
  const endpoints = hood
    ? [hoodRpc]
    : ([alchemyRpc(), ...PUBLIC].filter(Boolean) as string[]);
  let lastErr = "broadcast failed";

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_sendRawTransaction",
          params: [signedTx],
        }),
        cache: "no-store",
      });
      const json = (await res.json()) as {
        result?: string;
        error?: { message?: string };
      };
      if (json.result && json.result.startsWith("0x")) {
        return NextResponse.json({ ok: true, hash: json.result });
      }
      lastErr = json.error?.message || lastErr;
    } catch (err) {
      lastErr = err instanceof Error ? err.message : lastErr;
    }
  }

  return NextResponse.json(
    { error: lastErr, code: "BROADCAST_FAILED" },
    { status: 502 },
  );
}
