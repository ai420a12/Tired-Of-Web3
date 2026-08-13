import { NextResponse } from "next/server";
import {
  getHoodRpcConfig,
  type HoodRpcVariant,
} from "@/lib/hood-rpc-chain";
import {
  fetchMintgoBootstrap,
  type MintgoChain,
  type MintgoWindow,
} from "@/lib/mintgo";
import type { MintFeedRow } from "@/lib/mint-feed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOWS: MintgoWindow[] = ["1m", "5m", "15m", "1h", "1d"];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function str(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function addr(value: unknown): string {
  const v = str(value).toLowerCase();
  return /^0x[a-f0-9]{40}$/.test(v) ? v : "";
}

function formatAgo(tsMs: number): string {
  if (!tsMs) return "";
  const s = Math.max(0, Math.floor((Date.now() - tsMs) / 1000));
  if (s < 2) return "now";
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function displayOf(row: Record<string, unknown>): Record<string, unknown> {
  return asRecord(row.display);
}

function collectionOf(row: Record<string, unknown>): Record<string, unknown> {
  return asRecord(row.collection);
}

function mapTrending(
  row: Record<string, unknown>,
  fallback: string,
): MintFeedRow | null {
  const col = collectionOf(row);
  const display = displayOf(row);
  const contract = addr(col.contractAddress || col.address || row.contractAddress);
  const name = str(col.name || col.collection || row.name).trim();
  if (!contract || !name) return null;
  return {
    id: `tr:${contract}`,
    contract,
    name,
    image: str(col.image || col.collectionImage || row.image) || fallback,
    slug: str(col.openSeaSlug || row.openSeaSlug),
    minted: str(col.mintedSupply || ""),
    max: str(col.maxSupply || ""),
    floor: str(display.floor || col.floorPriceEth || ""),
    mintCount: str(display.mintCount || row.mintCount || ""),
    minters: str(display.uniqueMinters || row.uniqueMinters || ""),
    volume: str(display.volumeEth || row.volumeEth || ""),
    qty: "",
    tokenId: "",
    minter: "",
    ago: "",
    price: str(display.floor || ""),
  };
}

function mapMint(
  row: Record<string, unknown>,
  fallback: string,
): MintFeedRow | null {
  const contract = addr(
    row.contractAddress || row.address || collectionOf(row).contractAddress,
  );
  const name = str(
    row.collectionName || row.collection || row.name,
  ).trim();
  if (!contract || !name) return null;
  const ts = num(row.timestamp || row.mintedAt);
  const tsMs = ts > 1e12 ? ts : ts > 0 ? ts * 1000 : 0;
  const qty = str(row.mintQuantity || row.tokenCount || "");
  const value = num(row.valueEth);
  return {
    id: str(row.id) || `mn:${contract}:${str(row.txHash)}:${str(row.tokenId)}`,
    contract,
    name,
    image:
      str(row.collectionImage || row.imageUrl || row.tokenImage || row.image) ||
      fallback,
    slug: str(row.openSeaSlug),
    minted: "",
    max: "",
    floor: "",
    mintCount: qty,
    minters: "",
    volume: "",
    qty,
    tokenId: str(row.tokenId),
    minter: str(row.minter || row.transactionFrom),
    ago: formatAgo(tsMs),
    price: value > 0 ? `Ξ${value}` : "FREE",
  };
}

function mapRunner(
  row: Record<string, unknown>,
  fallback: string,
): MintFeedRow | null {
  const display = displayOf(row);
  const contract = addr(row.contractAddress || row.address);
  const name = str(row.name || row.collection || display.name).trim();
  if (!contract || !name) return null;
  return {
    id: `mk:${contract}`,
    contract,
    name,
    image: str(row.image || display.image) || fallback,
    slug: str(row.openSeaSlug),
    minted: "",
    max: "",
    floor: str(display.floor || row.floorPriceEth || ""),
    mintCount: str(display.windowMintCount || row.windowMintCount || ""),
    minters: str(row.windowMinters || ""),
    volume: str(
      display.windowVolumeEth || row.windowVolumeEth || display.volumeEth || "",
    ),
    qty: "",
    tokenId: "",
    minter: "",
    ago: str(row.window || ""),
    price: str(display.floor || ""),
  };
}

function uniqueRows(rows: MintFeedRow[], limit: number): MintFeedRow[] {
  const seen = new Set<string>();
  const out: MintFeedRow[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}

export async function handleMintRadar(
  req: Request,
  variant: HoodRpcVariant,
) {
  const { isAccessDenied, requireAccessKey } = await import(
    "@/lib/require-access"
  );
  const access = await requireAccessKey(req);
  if (isAccessDenied(access)) return access;

  const cfg = getHoodRpcConfig(variant);
  const chain: MintgoChain = variant === "eth" ? "ethereum" : "robinhood";
  const url = new URL(req.url);
  const rawWindow = (url.searchParams.get("window") || "1m") as MintgoWindow;
  const window = WINDOWS.includes(rawWindow) ? rawWindow : "1m";

  try {
    const data = await fetchMintgoBootstrap(chain, window);
    const trending = uniqueRows(
      (data.trending || [])
        .map((row) => mapTrending(asRecord(row), cfg.defaultTokenLogo))
        .filter((row): row is MintFeedRow => !!row),
      24,
    );
    const mints = uniqueRows(
      (data.mints || [])
        .map((row) => mapMint(asRecord(row), cfg.defaultTokenLogo))
        .filter((row): row is MintFeedRow => !!row),
      40,
    );
    const market = uniqueRows(
      (data.runners || [])
        .map((row) => mapRunner(asRecord(row), cfg.defaultTokenLogo))
        .filter((row): row is MintFeedRow => !!row),
      24,
    );

    return NextResponse.json({
      ok: true,
      chain,
      window,
      updatedAt: new Date().toISOString(),
      trending,
      mints,
      market,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "MINT_RADAR_FAILED",
        trending: [],
        mints: [],
        market: [],
      },
      { status: 502 },
    );
  }
}
