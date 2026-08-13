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
};

type FulfillTx = {
  to: string;
  data: string;
  value: string;
  chainId?: number;
};

/** Simple per-buyer rate limit (in-memory; fine for ~30 concurrent). */
const hits = new Map<string, { n: number; resetAt: number }>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;

function rateLimit(buyer: string): boolean {
  const now = Date.now();
  const cur = hits.get(buyer);
  if (!cur || now > cur.resetAt) {
    hits.set(buyer, { n: 1, resetAt: now + RATE_WINDOW_MS });
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
  return "0x0";
}

function normalizeTxs(payload: Record<string, unknown>): FulfillTx[] {
  const out: FulfillTx[] = [];

  const actions = payload.actions;
  if (Array.isArray(actions)) {
    for (const a of actions) {
      if (!a || typeof a !== "object") continue;
      const rec = a as Record<string, unknown>;
      const tx =
        (rec.transaction as Record<string, unknown> | undefined) ||
        (rec.tx as Record<string, unknown> | undefined) ||
        rec;
      const to = String(tx.to || tx.address || "").trim();
      const data = String(tx.data || tx.input || "").trim();
      if (!to || !data.startsWith("0x")) continue;
      out.push({
        to,
        data,
        value: hexValue(tx.value ?? tx.value_hex ?? "0x0"),
        chainId:
          typeof tx.chainId === "number"
            ? tx.chainId
            : typeof tx.chain_id === "number"
              ? tx.chain_id
              : 1,
      });
    }
  }

  const single =
    (payload.transaction as Record<string, unknown> | undefined) ||
    (payload.fulfillment_data as Record<string, unknown> | undefined);
  if (single && out.length === 0) {
    const nested =
      (single.transaction as Record<string, unknown> | undefined) || single;
    const to = String(nested.to || "").trim();
    const data = String(nested.data || "").trim();
    if (to && data.startsWith("0x")) {
      out.push({
        to,
        data,
        value: hexValue(nested.value ?? "0x0"),
        chainId: 1,
      });
    }
  }

  return out;
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
  const protocolAddress = (
    body.protocolAddress || SEAPORT_1_6
  ).trim();

  if (chain !== "ethereum") {
    return NextResponse.json(
      { error: "Live buys are ETH mainnet only for now", code: "ETH_ONLY" },
      { status: 400 },
    );
  }
  if (!orderHash.startsWith("0x") || orderHash.length < 66) {
    return NextResponse.json(
      { error: "Missing or invalid orderHash" },
      { status: 400 },
    );
  }
  if (!isAddress(buyer)) {
    return NextResponse.json({ error: "Invalid buyer" }, { status: 400 });
  }
  // Access Key cookie unlocks the tool; buyer may be a separate hot/session wallet.
  // Still rate-limit by the verified access session.
  if (!rateLimit(access.address.toLowerCase())) {
    return NextResponse.json(
      { error: "Too many buy attempts — wait a minute", code: "RATE_LIMIT" },
      { status: 429 },
    );
  }
  if (!openseaKeys().length) {
    return NextResponse.json(
      { error: "OpenSea API key not configured", code: "NO_OS_KEY" },
      { status: 503 },
    );
  }

  // Prefer cross-chain endpoint — returns ready calldata (works same-chain too)
  const crossRes = await osPost("/listings/cross_chain_fulfillment_data", {
    listings: [
      {
        hash: orderHash,
        chain: "ethereum",
        protocol_address: protocolAddress,
      },
    ],
    fulfiller: { address: buyer },
    payment: {
      chain: "ethereum",
      token_address: ZERO,
    },
  });

  let txs: FulfillTx[] = [];
  let source = "cross_chain";

  if (crossRes?.ok) {
    const json = (await crossRes.json()) as Record<string, unknown>;
    txs = normalizeTxs(json);
  }

  if (!txs.length) {
    source = "fulfillment_data";
    const sameRes = await osPost("/listings/fulfillment_data", {
      listing: {
        hash: orderHash,
        chain: "ethereum",
        protocol_address: protocolAddress,
      },
      fulfiller: { address: buyer },
    });
    if (!sameRes) {
      return NextResponse.json(
        { error: "OpenSea unreachable" },
        { status: 502 },
      );
    }
    if (!sameRes.ok) {
      const errText = await sameRes.text().catch(() => "");
      console.error(
        "buy-listing OS error",
        orderHash.slice(0, 12),
        buyer.slice(0, 10),
        sameRes.status,
      );
      return NextResponse.json(
        {
          error:
            sameRes.status === 400
              ? "Listing unavailable (sold / cancelled / invalid)"
              : "OpenSea fulfillment failed",
          code: "OS_FULFILL_FAILED",
          detail: process.env.NODE_ENV === "development" ? errText.slice(0, 400) : undefined,
        },
        { status: 502 },
      );
    }
    const json = (await sameRes.json()) as Record<string, unknown>;
    txs = normalizeTxs(json);

    // Some responses nest under fulfillment_data.transaction
    if (!txs.length) {
      const fd = json.fulfillment_data as Record<string, unknown> | undefined;
      const tx = fd?.transaction as Record<string, unknown> | undefined;
      if (tx?.to && tx?.data) {
        txs = [
          {
            to: String(tx.to),
            data: String(tx.data),
            value: hexValue(tx.value ?? "0x0"),
            chainId: 1,
          },
        ];
      }
    }
  }

  if (!txs.length) {
    return NextResponse.json(
      {
        error:
          "Could not build buy transaction from OpenSea — try again or buy on OpenSea",
        code: "NO_TX",
      },
      { status: 502 },
    );
  }

  console.info(
    "buy-listing ok",
    source,
    orderHash.slice(0, 12),
    buyer.slice(0, 10),
    `txs=${txs.length}`,
  );

  return NextResponse.json({
    ok: true,
    chain: "ethereum",
    chainId: 1,
    orderHash,
    buyer,
    transactions: txs,
    source,
  });
}
