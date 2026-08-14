import { NextResponse } from "next/server";
import {
  getHoodRpcConfig,
  type HoodRpcVariant,
} from "@/lib/hood-rpc-chain";
import {
  fetchMintgoAllBootstrap,
  fetchMintgoBootstrap,
  type MintgoChain,
  type MintgoWindow,
} from "@/lib/mintgo";
import type { MintFeedChain, MintFeedRow } from "@/lib/mint-feed";

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

function compactCount(n: number): string {
  if (!n) return "";
  if (n >= 1000) return `+${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return `+${n}`;
}

function formatChange(raw: number): { text: string; value: number } {
  if (!Number.isFinite(raw) || raw === 0) return { text: "", value: 0 };
  const pct = Math.abs(raw) <= 2 ? raw * 100 : raw;
  const sign = pct > 0 ? "+" : "";
  const text = `${sign}${pct.toFixed(Math.abs(pct) >= 10 ? 0 : 1)}%`;
  return { text, value: pct };
}

function formatVolume(n: number): string {
  if (!n) return "0";
  if (n >= 10) return n.toFixed(2);
  if (n >= 1) return n.toFixed(3);
  return n.toFixed(4);
}

function displayOf(row: Record<string, unknown>): Record<string, unknown> {
  return asRecord(row.display);
}

function collectionOf(row: Record<string, unknown>): Record<string, unknown> {
  return asRecord(row.collection);
}

function blankRow(
  chain: MintFeedChain,
  contract: string,
  name: string,
  image: string,
  slug: string,
): MintFeedRow {
  return {
    id: "",
    chain,
    contract,
    name,
    image,
    slug,
    minted: "",
    max: "",
    floor: "",
    mintCount: "",
    mintCountNum: 0,
    minters: "",
    volume: "",
    volumeNum: 0,
    qty: "",
    tokenId: "",
    minter: "",
    ago: "",
    atMs: 0,
    price: "",
    hot: false,
    proxy: false,
    free: true,
    standard: "",
    sales: "",
    change: "",
    changeNum: 0,
    rank: "",
  };
}

function mapTrending(
  row: Record<string, unknown>,
  chain: MintFeedChain,
  fallback: string,
): MintFeedRow | null {
  const col = collectionOf(row);
  const display = displayOf(row);
  const contract = addr(col.contractAddress || col.address || row.contractAddress);
  const name = str(col.name || col.collection || row.name).trim();
  if (!contract || !name) return null;
  const count = num(row.mintCount || row.hotMintCount);
  const hot = num(row.hotMintCount) >= 40 || num(row.rank) <= 2;
  return {
    ...blankRow(
      chain,
      contract,
      name,
      str(col.image || col.collectionImage || row.image) || fallback,
      str(col.openSeaSlug || row.openSeaSlug),
    ),
    id: `tr:${chain}:${contract}`,
    minted: str(col.mintedSupply || ""),
    max: str(col.maxSupply || ""),
    floor: str(display.floor || col.floorPriceEth || ""),
    mintCount: str(display.mintCount || compactCount(count)),
    mintCountNum: count,
    minters: str(display.uniqueMinters || row.uniqueMinters || ""),
    volume: str(display.volumeEth || ""),
    price: str(display.floor || ""),
    hot,
    rank: str(display.rank || row.rank || ""),
  };
}

function mapMint(
  row: Record<string, unknown>,
  chain: MintFeedChain,
  fallback: string,
): MintFeedRow | null {
  const contract = addr(
    row.contractAddress || row.address || collectionOf(row).contractAddress,
  );
  const name = str(row.collectionName || row.collection || row.name).trim();
  if (!contract || !name) return null;
  const ts = num(row.timestamp || row.mintedAt);
  const tsMs = ts > 1e12 ? ts : ts > 0 ? ts * 1000 : 0;
  const qty = num(row.mintQuantity || row.tokenCount || 1);
  const value = num(row.valueEth);
  const standard = str(row.standard || "erc721").toUpperCase();
  return {
    ...blankRow(
      chain,
      contract,
      name,
      str(row.collectionImage || row.imageUrl || row.tokenImage || row.image) ||
        fallback,
      str(row.openSeaSlug),
    ),
    id: str(row.id) || `mn:${chain}:${contract}:${str(row.txHash)}:${str(row.tokenId)}`,
    mintCount: compactCount(qty),
    mintCountNum: qty,
    qty: String(qty),
    tokenId: str(row.tokenId),
    minter: str(row.minter || row.transactionFrom),
    ago: formatAgo(tsMs),
    atMs: tsMs,
    price: value > 0 ? `Ξ${value}` : "Free",
    proxy: Boolean(row.isThirdPartyMint),
    free: !(value > 0),
    standard,
  };
}

function mapRunner(
  row: Record<string, unknown>,
  chain: MintFeedChain,
  fallback: string,
): MintFeedRow | null {
  const display = displayOf(row);
  const contract = addr(row.contractAddress || row.address);
  const name = str(row.name || row.collection || display.name).trim();
  if (!contract || !name) return null;
  const vol = num(row.windowVolumeEth);
  if (vol < 0 || vol > 10_000) return null;
  const sales = num(row.windowTxCount || row.windowMintCount);
  const change = formatChange(num(row.windowFloorPriceChange));
  return {
    ...blankRow(
      chain,
      contract,
      name,
      str(row.image || display.image) || fallback,
      str(row.openSeaSlug),
    ),
    id: `mk:${chain}:${contract}`,
    floor: str(display.floor || row.floorPriceEth || ""),
    mintCount: str(display.windowMintCount || row.windowMintCount || ""),
    mintCountNum: sales,
    volume: formatVolume(vol),
    volumeNum: vol,
    sales: String(sales || ""),
    change: change.text,
    changeNum: change.value,
    rank: str(display.rank || row.rank || ""),
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

function parseView(raw: string | null, variant: HoodRpcVariant): "all" | MintgoChain {
  if (raw === "all" || raw === "ethereum" || raw === "robinhood") return raw;
  return variant === "eth" ? "ethereum" : "all";
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
  const url = new URL(req.url);
  const rawWindow = (url.searchParams.get("window") || "1m") as MintgoWindow;
  const window = WINDOWS.includes(rawWindow) ? rawWindow : "1m";
  const view = parseView(url.searchParams.get("view"), variant);
  const fallback = cfg.defaultTokenLogo;

  try {
    const packs: { chain: MintFeedChain; data: Awaited<ReturnType<typeof fetchMintgoBootstrap>> }[] =
      [];
    if (view === "all") {
      const all = await fetchMintgoAllBootstrap(window);
      for (const chain of ["robinhood", "ethereum"] as const) {
        if (all[chain]) packs.push({ chain, data: all[chain]! });
      }
    } else {
      packs.push({
        chain: view,
        data: await fetchMintgoBootstrap(view, window),
      });
    }

    const trending: MintFeedRow[] = [];
    const mints: MintFeedRow[] = [];
    const market: MintFeedRow[] = [];
    for (const { chain, data } of packs) {
      for (const row of data.trending || []) {
        const mapped = mapTrending(asRecord(row), chain, fallback);
        if (mapped) trending.push(mapped);
      }
      for (const row of data.mints || []) {
        const mapped = mapMint(asRecord(row), chain, fallback);
        if (mapped) mints.push(mapped);
      }
      for (const row of data.runners || []) {
        const mapped = mapRunner(asRecord(row), chain, fallback);
        if (mapped) market.push(mapped);
      }
    }

    trending.sort((a, b) => b.mintCountNum - a.mintCountNum);
    market.sort((a, b) => b.volumeNum - a.volumeNum || b.mintCountNum - a.mintCountNum);

    return NextResponse.json({
      ok: true,
      view,
      window,
      updatedAt: new Date().toISOString(),
      trending: uniqueRows(trending, 24),
      mints: uniqueRows(mints, 40),
      market: uniqueRows(market, 24),
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
