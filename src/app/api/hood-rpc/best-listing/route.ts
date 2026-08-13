import { NextResponse } from "next/server";
import { isAddress } from "viem";
import {
  isAccessDenied,
  requireAccessKey,
} from "@/lib/require-access";
import { resolveApiVariant } from "@/lib/hood-rpc-chain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEAPORT_1_6 = "0x0000000000000068f116a894984e2db1123eb395";

function openseaKeys(): string[] {
  const multi = (process.env.OPENSEA_API_KEYS || "")
    .split(/[\s,]+/)
    .map((k) => k.trim())
    .filter(Boolean);
  const single = (process.env.OPENSEA_API_KEY || "").trim();
  return [...new Set([...multi, ...(single ? [single] : [])])];
}

async function osGet(path: string): Promise<unknown | null> {
  const keys = openseaKeys();
  if (!keys.length) return null;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const res = await fetch(`https://api.opensea.io/api/v2${path}`, {
      headers: {
        accept: "application/json",
        "x-api-key": key,
        "User-Agent": "HOOD_RPC/1.0",
      },
      cache: "no-store",
    });
    if (res.status === 429 || res.status === 503) continue;
    if (!res.ok) return null;
    return res.json();
  }
  return null;
}

type ListingLike = {
  order_hash?: string;
  protocol_address?: string;
  price?: { current?: { currency?: string; decimals?: number; value?: string } };
  remaining_quantity?: number | string;
  status?: string;
};

function parseEth(L: ListingLike): { eth: number; kind: "eth" | "weth" } | null {
  const value = Number(L.price?.current?.value || 0);
  const decimals = Number(L.price?.current?.decimals ?? 18);
  let eth = value;
  if (value > 1e9) eth = value / 10 ** decimals;
  if (!Number.isFinite(eth) || eth <= 0) return null;
  const currency = (L.price?.current?.currency || "ETH").toUpperCase();
  const kind: "eth" | "weth" = currency.includes("WETH") ? "weth" : "eth";
  return { eth: Number(eth.toFixed(6)), kind };
}

function pickBest(listings: ListingLike[]): {
  orderHash: string;
  protocolAddress: string;
  eth: number;
  kind: "eth" | "weth";
} | null {
  const active = listings.filter((L) => {
    const status = (L.status || "").toUpperCase();
    if (status && status !== "ACTIVE") return false;
    const rem = Number(L.remaining_quantity);
    if (Number.isFinite(rem) && rem <= 0) return false;
    return Boolean(L.order_hash);
  });

  let best: {
    orderHash: string;
    protocolAddress: string;
    eth: number;
    kind: "eth" | "weth";
  } | null = null;

  for (const L of active) {
    const price = parseEth(L);
    if (!price || price.kind !== "eth") continue;
    if (!best || price.eth < best.eth) {
      best = {
        orderHash: L.order_hash!,
        protocolAddress: L.protocol_address || SEAPORT_1_6,
        eth: price.eth,
        kind: price.kind,
      };
    }
  }
  return best;
}

export async function GET(req: Request) {
  const access = await requireAccessKey(req);
  if (isAccessDenied(access)) return access;

  const variant = resolveApiVariant(req);
  if (variant !== "eth") {
    return NextResponse.json(
      { error: "Best-listing resolve is ETH only", code: "ETH_ONLY" },
      { status: 400 },
    );
  }

  const { searchParams } = new URL(req.url);
  const contract = (searchParams.get("contract") || "").trim();
  const tokenId = (searchParams.get("tokenId") || "").trim();
  const slug = (searchParams.get("slug") || "").trim();

  if (!tokenId) {
    return NextResponse.json({ error: "tokenId required" }, { status: 400 });
  }
  if (!slug && (!contract || !isAddress(contract))) {
    return NextResponse.json(
      { error: "contract or slug required" },
      { status: 400 },
    );
  }
  if (!openseaKeys().length) {
    return NextResponse.json(
      { error: "OpenSea API key missing", code: "NO_OS_KEY" },
      { status: 503 },
    );
  }

  // 1) Best listing by collection slug + token id
  if (slug) {
    const best = (await osGet(
      `/listings/collection/${encodeURIComponent(slug)}/nfts/${encodeURIComponent(tokenId)}/best`,
    )) as ListingLike | null;
    if (best?.order_hash) {
      const price = parseEth(best);
      if (price?.kind === "eth") {
        return NextResponse.json({
          ok: true,
          orderHash: best.order_hash,
          protocolAddress: best.protocol_address || SEAPORT_1_6,
          eth: price.eth,
          kind: price.kind,
          source: "best_nft",
        });
      }
    }
  }

  // 2) All Seaport listings for contract + token
  if (contract && isAddress(contract)) {
    const q = new URLSearchParams({
      asset_contract_address: contract,
      token_ids: tokenId,
      limit: "20",
    });
    const data = (await osGet(
      `/orders/ethereum/seaport/listings?${q.toString()}`,
    )) as { orders?: ListingLike[]; listings?: ListingLike[] } | null;

    const rows = (data?.orders || data?.listings || []) as ListingLike[];
    // orders endpoint nests differently — flatten common shapes
    const flat: ListingLike[] = [];
    for (const row of rows as unknown as Record<string, unknown>[]) {
      if (row.order_hash || (row as ListingLike).order_hash) {
        flat.push(row as ListingLike);
        continue;
      }
      const nested = row.protocol_data
        ? (row as ListingLike)
        : ((row.listing || row.order) as ListingLike | undefined);
      if (nested) {
        flat.push({
          ...nested,
          order_hash:
            nested.order_hash ||
            (row.order_hash as string | undefined) ||
            (row.hash as string | undefined),
          protocol_address:
            nested.protocol_address ||
            (row.protocol_address as string | undefined),
          price: nested.price || (row.price as ListingLike["price"]),
        });
      }
    }

    const picked = pickBest(flat.length ? flat : (rows as ListingLike[]));
    if (picked) {
      return NextResponse.json({
        ok: true,
        ...picked,
        source: "seaport_orders",
      });
    }
  }

  return NextResponse.json(
    {
      error: "No active ETH listing for this NFT",
      code: "NO_LISTING",
    },
    { status: 404 },
  );
}
