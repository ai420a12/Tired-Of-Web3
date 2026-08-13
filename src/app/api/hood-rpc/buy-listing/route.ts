import { NextResponse } from "next/server";
import { isAddress } from "viem";
import {
  isAccessDenied,
  requireAccessKey,
} from "@/lib/require-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEAPORT_1_6 = "0x0000000000000068f116a894984e2db1123eb395";
const ZERO = "0x0000000000000000000000000000000000000000";

type BuyBody = {
  orderHash?: string;
  protocolAddress?: string;
  chain?: string;
  buyer?: string;
  contract?: string;
  tokenId?: string;
};

export type FulfillTx = {
  to: string;
  data: string;
  value: string;
  chainId?: number;
};

const hits = new Map<string, { n: number; resetAt: number }>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 30;

function rateLimit(addr: string): boolean {
  const now = Date.now();
  const cur = hits.get(addr);
  if (!cur || now > cur.resetAt) {
    hits.set(addr, { n: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (cur.n >= RATE_MAX) return false;
  cur.n += 1;
  return true;
}

function openseaKeys(): string[] {
  const multi = (process.env.OPENSEA_API_KEYS || "")
    .split(/[\s,]+/)
    .map((k) => k.trim())
    .filter(Boolean);
  const single = (process.env.OPENSEA_API_KEY || "").trim();
  return [...new Set([...multi, ...(single ? [single] : [])])];
}

async function osPost(path: string, body: unknown): Promise<Response | null> {
  const keys = openseaKeys();
  if (!keys.length) return null;
  let last: Response | null = null;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const res = await fetch(`https://api.opensea.io/api/v2${path}`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-api-key": key,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    last = res;
    if (res.status === 429 || res.status === 503) continue;
    return res;
  }
  return last;
}

function hexValue(v: unknown): string {
  if (typeof v === "string" && v.startsWith("0x")) return v;
  if (typeof v === "string" && /^\d+$/.test(v)) {
    return `0x${BigInt(v).toString(16)}`;
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    return `0x${BigInt(Math.floor(v)).toString(16)}`;
  }
  if (typeof v === "bigint") return `0x${v.toString(16)}`;
  return "0x0";
}

/** Walk any OpenSea / Reservoir-shaped payload for ready calldata txs. */
export function extractReadyTxs(payload: unknown, depth = 0): FulfillTx[] {
  if (payload == null || depth > 8) return [];
  if (Array.isArray(payload)) {
    return payload.flatMap((x) => extractReadyTxs(x, depth + 1));
  }
  if (typeof payload !== "object") return [];
  const rec = payload as Record<string, unknown>;

  const to = rec.to ?? rec.address ?? rec.toAddress;
  const data =
    rec.data ?? rec.calldata ?? rec.input ?? rec.data_hex ?? rec.callData;
  const value = rec.value ?? rec.value_hex ?? rec.valueHex ?? rec.wei;

  if (
    typeof to === "string" &&
    to.startsWith("0x") &&
    to.length === 42 &&
    typeof data === "string" &&
    data.startsWith("0x") &&
    data.length > 10
  ) {
    return [
      {
        to,
        data,
        value: hexValue(value ?? "0x0"),
        chainId: 1,
      },
    ];
  }

  return Object.values(rec).flatMap((v) => extractReadyTxs(v, depth + 1));
}

async function reservoirExecuteBuy(
  buyer: string,
  contract: string,
  tokenId: string,
): Promise<FulfillTx[]> {
  const key = (process.env.RESERVOIR_API_KEY || "").trim();
  const headers: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/json",
  };
  if (key) headers["x-api-key"] = key;

  const res = await fetch("https://api.reservoir.tools/execute/buy/v7", {
    method: "POST",
    headers,
    body: JSON.stringify({
      items: [{ token: `${contract}:${tokenId}`, quantity: 1 }],
      taker: buyer,
      source: "tiredofweb3.xyz",
    }),
    cache: "no-store",
  });
  if (!res.ok) return [];
  const json = (await res.json()) as Record<string, unknown>;
  return extractReadyTxs(json);
}

export async function POST(req: Request) {
  const access = await requireAccessKey(req);
  if (isAccessDenied(access)) return access;

  let body: BuyBody;
  try {
    body = (await req.json()) as BuyBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orderHash = (body.orderHash || "").trim();
  const buyer = (body.buyer || "").trim().toLowerCase();
  const chain = (body.chain || "ethereum").trim().toLowerCase();
  const protocolAddress = (body.protocolAddress || SEAPORT_1_6).trim();
  const contract = (body.contract || "").trim();
  const tokenId = (body.tokenId || "").trim();

  if (chain !== "ethereum") {
    return NextResponse.json(
      { error: "Live buys are ETH mainnet only for now", code: "ETH_ONLY" },
      { status: 400 },
    );
  }
  if (!isAddress(buyer)) {
    return NextResponse.json({ error: "Invalid buyer" }, { status: 400 });
  }
  if (buyer !== access.address.toLowerCase()) {
    return NextResponse.json(
      {
        error: "Buyer must be the verified Access Key wallet",
        code: "BUYER_MISMATCH",
      },
      { status: 403 },
    );
  }
  if (!rateLimit(access.address.toLowerCase())) {
    return NextResponse.json(
      { error: "Too many buy attempts — wait a minute", code: "RATE_LIMIT" },
      { status: 429 },
    );
  }

  let txs: FulfillTx[] = [];
  let source = "none";

  // 1) OpenSea cross-chain fulfillment (ready calldata)
  if (orderHash.startsWith("0x") && orderHash.length >= 66 && openseaKeys().length) {
    const crossRes = await osPost("/listings/cross_chain_fulfillment_data", {
      listings: [
        {
          hash: orderHash,
          chain: "ethereum",
          protocol_address: protocolAddress,
        },
      ],
      fulfiller: { address: buyer },
      payment: { chain: "ethereum", token_address: ZERO },
    });
    if (crossRes?.ok) {
      const json = (await crossRes.json()) as Record<string, unknown>;
      txs = extractReadyTxs(json);
      if (txs.length) source = "opensea_cross";
    }

    // 2) Same-chain fulfillment_data
    if (!txs.length) {
      const sameRes = await osPost("/listings/fulfillment_data", {
        listing: {
          hash: orderHash,
          chain: "ethereum",
          protocol_address: protocolAddress,
        },
        fulfiller: { address: buyer },
      });
      if (sameRes?.ok) {
        const json = (await sameRes.json()) as Record<string, unknown>;
        txs = extractReadyTxs(json);
        if (txs.length) source = "opensea_same";
      } else if (sameRes && !sameRes.ok) {
        const errText = await sameRes.text().catch(() => "");
        console.error(
          "buy-listing OS error",
          orderHash.slice(0, 12),
          buyer.slice(0, 10),
          sameRes.status,
          errText.slice(0, 200),
        );
      }
    }
  }

  // 3) Reservoir fallback by token (often more reliable calldata)
  if (!txs.length && contract && isAddress(contract) && tokenId) {
    txs = await reservoirExecuteBuy(buyer, contract, tokenId);
    if (txs.length) source = "reservoir";
  }

  if (!txs.length) {
    return NextResponse.json(
      {
        error:
          "Could not build buy tx — listing may be sold, or arm key / try another NFT",
        code: "NO_TX",
      },
      { status: 502 },
    );
  }

  // Dedupe identical txs
  const seen = new Set<string>();
  txs = txs.filter((t) => {
    const k = `${t.to}:${t.data}:${t.value}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  console.info(
    "buy-listing ok",
    source,
    orderHash.slice(0, 12) || "no-hash",
    buyer.slice(0, 10),
    `txs=${txs.length}`,
  );

  return NextResponse.json({
    ok: true,
    chain: "ethereum",
    chainId: 1,
    orderHash: orderHash || undefined,
    buyer,
    transactions: txs,
    source,
  });
}
