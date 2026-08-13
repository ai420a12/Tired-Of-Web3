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
  const contract = (url.searchParams.get("contract") || "")
    .trim()
    .toLowerCase();
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
