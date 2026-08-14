import { NextResponse } from "next/server";
import type { HoodRpcVariant } from "@/lib/hood-rpc-chain";
import {
  fetchMintgoCollection,
  type MintgoChain,
  type MintgoMintAnalysis,
} from "@/lib/mintgo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function extractAddress(raw: string): string {
  const m = raw.toLowerCase().match(/0x[a-f0-9]{40}/);
  return m ? m[0] : "";
}

function extractOpenSeaSlug(raw: string): string {
  const text = raw.trim();
  const fromUrl = text.match(
    /opensea\.io\/(?:collection\/)?([a-z0-9_-]+)/i,
  );
  if (fromUrl?.[1] && !/^(assets|account|rankings|collection)$/i.test(fromUrl[1])) {
    return fromUrl[1];
  }
  if (/^[a-z0-9-]{2,80}$/i.test(text)) return text;
  return "";
}

async function resolveOpenSeaContract(
  slug: string,
  chain: MintgoChain,
): Promise<string> {
  const keys = [
    (process.env.OPENSEA_API_KEY || "").trim(),
    ...(process.env.OPENSEA_API_KEYS || "")
      .split(/[\s,]+/)
      .map((k) => k.trim()),
  ].filter(Boolean);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (keys[0]) headers["X-API-KEY"] = keys[0];
  const res = await fetch(
    `https://api.opensea.io/api/v2/collections/${encodeURIComponent(slug)}`,
    { headers, cache: "no-store" },
  );
  if (!res.ok) return "";
  const data = (await res.json().catch(() => ({}))) as {
    contracts?: { address?: string; chain?: string }[];
    collection?: { contracts?: { address?: string; chain?: string }[] };
  };
  const contracts = Array.isArray(data.contracts)
    ? data.contracts
    : data.collection?.contracts || [];
  const want = chain === "ethereum" ? "ethereum" : "robinhood";
  const match =
    contracts.find((c) => String(c.chain || "").toLowerCase() === want) ||
    contracts[0];
  return extractAddress(String(match?.address || ""));
}

export async function handleMintDetail(
  req: Request,
  variant: HoodRpcVariant,
) {
  const { isAccessDenied, requireAccessKey } = await import(
    "@/lib/require-access"
  );
  const access = await requireAccessKey(req);
  if (isAccessDenied(access)) return access;

  const url = new URL(req.url);
  const rawChain = url.searchParams.get("chain");
  const chain: MintgoChain =
    rawChain === "ethereum" || rawChain === "robinhood"
      ? rawChain
      : variant === "eth"
        ? "ethereum"
        : "robinhood";
  const q =
    url.searchParams.get("q") ||
    url.searchParams.get("slug") ||
    url.searchParams.get("contract") ||
    "";
  let contract = extractAddress(url.searchParams.get("contract") || q);
  if (!contract) {
    const slug = extractOpenSeaSlug(q || url.searchParams.get("slug") || "");
    if (slug) contract = await resolveOpenSeaContract(slug, chain);
  }
  if (!/^0x[a-f0-9]{40}$/.test(contract)) {
    return NextResponse.json({ error: "Invalid contract" }, { status: 400 });
  }

  try {
    const raw = await fetchMintgoCollection(chain, contract);
    const analysis = asRecord(raw.mintAnalysis) as MintgoMintAnalysis;
    const mintAction = asRecord(raw.mintAction);
    return NextResponse.json({
      ok: true,
      chain,
      contract,
      name: String(raw.name || raw.collection || ""),
      image: String(raw.image || ""),
      slug: String(raw.openSeaSlug || ""),
      openseaUrl: String(raw.openSeaUrl || ""),
      minted: Number(raw.mintedSupply || 0),
      max: Number(raw.maxSupply || 0),
      floor: Number(raw.floorPriceEth || 0),
      holders: Number(raw.holderCount || 0),
      priceLabel: String(mintAction.displayUnitPrice || ""),
      analysis: {
        ready: Boolean(analysis.ready),
        reason: String(analysis.reason || ""),
        mode: String(analysis.mode || ""),
        maxPerWallet: Number(analysis.maxPerWallet || 0),
        maxBatch: Number(analysis.maxBatch || 0),
        unitPriceWei: String(analysis.unitPriceWei || "0"),
        unitPriceEth: Number(analysis.unitPriceEth || 0),
        functionLabel: String(analysis.functionLabel || ""),
        mintTarget: String(analysis.mintTarget || ""),
        requiresHelper: Boolean(analysis.requiresHelper),
        helperConfigured: Boolean(analysis.helperConfigured),
        nativeSymbol: String(analysis.nativeSymbol || "ETH"),
        serviceFeePerMintWei: String(analysis.serviceFeePerMintWei || "0"),
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "MINT_DETAIL_FAILED",
      },
      { status: 502 },
    );
  }
}
