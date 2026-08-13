import { NextResponse } from "next/server";
import { isAddress } from "viem";
import {
  isAccessDenied,
  requireAccessKey,
} from "@/lib/require-access";
import { resolveApiVariant } from "@/lib/hood-rpc-chain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY_LIKE = /^(0x)?[0-9a-fA-F]{64}$/;

function alchemyKey(): string | null {
  return (process.env.ALCHEMY_API_KEY || "").trim() || null;
}

function rpcUrl(variant: "eth" | "hood"): string {
  if (variant === "hood") {
    return (
      process.env.ROBINHOOD_RPC_URL?.trim() ||
      "https://rpc.mainnet.chain.robinhood.com"
    );
  }
  const key = alchemyKey();
  if (key) return `https://eth-mainnet.g.alchemy.com/v2/${key}`;
  return (
    process.env.ETH_RPC_URL?.trim() || "https://ethereum.publicnode.com"
  );
}

async function rpcBalance(rpc: string, address: string): Promise<bigint> {
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getBalance",
      params: [address, "latest"],
    }),
    cache: "no-store",
  });
  const json = (await res.json()) as { result?: string };
  if (typeof json.result !== "string") return BigInt(0);
  return BigInt(json.result);
}

async function nftCount(address: string): Promise<number> {
  const key = alchemyKey();
  if (!key) return 0;
  const res = await fetch(
    `https://eth-mainnet.g.alchemy.com/nft/v3/${key}/getNFTsForOwner?owner=${address}&pageSize=1`,
    { cache: "no-store" },
  ).catch(() => null);
  if (!res?.ok) return 0;
  const data = (await res.json()) as { totalCount?: number };
  return Number(data.totalCount || 0);
}

async function ethUsd(): Promise<number> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
      { cache: "no-store" },
    );
    const data = (await res.json()) as { ethereum?: { usd?: number } };
    const n = Number(data.ethereum?.usd);
    return Number.isFinite(n) && n > 0 ? n : 3200;
  } catch {
    return 3200;
  }
}

export async function POST(req: Request) {
  const access = await requireAccessKey(req);
  if (isAccessDenied(access)) return access;

  let body: { addresses?: unknown };
  try {
    body = (await req.json()) as { addresses?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.addresses)) {
    return NextResponse.json({ error: "addresses required" }, { status: 400 });
  }

  const addrs: string[] = [];
  for (const raw of body.addresses.slice(0, 80)) {
    const v = String(raw || "").trim();
    if (KEY_LIKE.test(v)) {
      return NextResponse.json(
        { error: "Private keys are not accepted", code: "NO_KEYS" },
        { status: 400 },
      );
    }
    if (!isAddress(v)) continue;
    addrs.push(v.toLowerCase());
  }

  const variant = resolveApiVariant(req);
  const rpc = rpcUrl(variant);
  const usdPrice = await ethUsd();

  const rows = await Promise.all(
    addrs.map(async (address) => {
      const wei = await rpcBalance(rpc, address).catch(() => BigInt(0));
      const eth = Number(wei) / 1e18;
      const nfts = variant === "eth" ? await nftCount(address) : 0;
      return {
        address,
        eth: Number(eth.toFixed(6)),
        usd: Number((eth * usdPrice).toFixed(2)),
        nfts,
      };
    }),
  );

  return NextResponse.json({ ok: true, chain: variant, balances: rows });
}
