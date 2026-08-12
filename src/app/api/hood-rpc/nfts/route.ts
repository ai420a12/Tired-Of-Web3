import { NextResponse } from "next/server";
import {
  getCollections,
  getHoodRpcConfig,
  resolveApiVariant,
  type HoodRpcVariant,
} from "@/lib/hood-rpc-chain";
import { parseOpenSeaRarityRank } from "@/components/hood-rpc/hood-rarity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type CuratedCollection = {
  name: string;
  slug: string;
  image: string;
  website: string;
  twitter?: string;
  discord?: string;
};

type NftsScope = {
  variant: HoodRpcVariant;
  collections: readonly CuratedCollection[];
  chainLabel: string;
  openseaChain: string;
  openseaAssetsChain: string;
  curatedSource: string;
};

function makeScope(variant: HoodRpcVariant): NftsScope {
  const cfg = getHoodRpcConfig(variant);
  return {
    variant,
    collections: getCollections(variant) as readonly CuratedCollection[],
    chainLabel: cfg.chainLabel,
    openseaChain: cfg.openseaChain,
    openseaAssetsChain: cfg.openseaAssetsChain,
    curatedSource: cfg.curatedSource,
  };
}

type OsNft = {
  identifier?: string;
  name?: string;
  collection?: string;
  image_url?: string;
  display_image_url?: string;
  image_original_url?: string;
  opensea_url?: string;
  contract?: string;
  traits?: { trait_type?: string; value?: string | number }[];
  rarity?: unknown;
  rarity_rank?: number | string;
  rank?: number | string;
};

/** Neutral local art — never use another collection's image as a stand-in. */
const NEUTRAL_NFT_IMAGE = "/images/hood-rpc/mascot-lime.png";
const WEAK_IMAGE_RE =
  /placeholder|missing.?art|default.?nft|\/static\/images\/placeholder|opensea\.io\/static/i;

type OsEvent = {
  event_type?: string;
  order_hash?: string;
  chain?: string;
  payment?: {
    quantity?: string;
    decimals?: number;
    symbol?: string;
    token?: { symbol?: string; usd_price?: string; decimals?: number };
  };
  nft?: OsNft;
  event_timestamp?: number | string;
};

type SaleRow = {
  id: string;
  tokenName: string;
  collection: string;
  collectionSlug: string;
  openseaUrl: string;
  eth: number;
  usd: number;
  ago: string;
  kind: "eth" | "weth";
  image: string;
  rarityRank: number;
  rarityUnavailable: boolean;
  rarityLabel: string;
  traits: { trait: string; value: string }[];
  tokenId?: string;
  contract?: string;
  eventTs?: number;
};

/** Normalize OpenSea timestamps (unix sec/ms or ISO string) → unix seconds */
function parseEventTs(raw: unknown): number {
  if (raw == null) return 0;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw > 1e12 ? Math.floor(raw / 1000) : Math.floor(raw);
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return 0;
    const asNum = Number(trimmed);
    if (Number.isFinite(asNum) && asNum > 0) {
      return asNum > 1e12 ? Math.floor(asNum / 1000) : Math.floor(asNum);
    }
    const ms = Date.parse(trimmed);
    if (Number.isFinite(ms)) return Math.floor(ms / 1000);
  }
  return 0;
}

function ago(tsSec?: number, nowSec = Math.floor(Date.now() / 1000)): string {
  if (!tsSec) return "just now";
  const s = Math.max(0, nowSec - tsSec);
  if (s < 15) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function sortNewest(a: SaleRow, b: SaleRow): number {
  return (b.eventTs || 0) - (a.eventTs || 0);
}

function demoRank(seed: number): number {
  const bands = [5, 28, 120, 380, 750, 2400];
  return bands[seed % bands.length] + (seed % 7);
}

function paymentToEth(payment?: OsEvent["payment"]): { eth: number; kind: "eth" | "weth"; usd: number } {
  const qty = Number(payment?.quantity || 0);
  const decimals = Number(payment?.token?.decimals ?? payment?.decimals ?? 18);
  let eth = qty;
  if (qty > 1e9) eth = qty / 10 ** decimals;
  if (!Number.isFinite(eth) || eth <= 0) eth = 0.05;
  const usdPrice = Number(payment?.token?.usd_price || 0);
  const usd = usdPrice > 0 ? eth * usdPrice : eth * 3200;
  const symbol = (payment?.token?.symbol || payment?.symbol || "ETH").toUpperCase();
  const kind = symbol.includes("WETH") ? "weth" : "eth";
  return { eth: Number(eth.toFixed(4)), kind, usd: Number(usd.toFixed(2)) };
}

type ProjectCol = {
  name: string;
  slug: string;
  image: string;
  website: string;
};

function pickNftImage(
  nft: OsNft | Record<string, unknown> | null | undefined,
  fallback: string,
): string {
  if (!nft) return fallback;
  const candidates = [
    (nft as OsNft).display_image_url,
    (nft as OsNft).image_url,
    (nft as OsNft).image_original_url,
    typeof (nft as Record<string, unknown>).image === "string"
      ? ((nft as Record<string, unknown>).image as string)
      : undefined,
  ];
  for (const raw of candidates) {
    const url = typeof raw === "string" ? raw.trim() : "";
    if (!url) continue;
    if (WEAK_IMAGE_RE.test(url)) continue;
    return url;
  }
  return fallback;
}

function isWeakOrLocalImage(url: string | undefined, colImage?: string): boolean {
  if (!url) return true;
  if (url.startsWith("/images/hood-rpc/")) return true;
  if (WEAK_IMAGE_RE.test(url)) return true;
  if (colImage && url === colImage) return true;
  return false;
}

/** Resolve a project by slug — never substitute a different curated collection. */
function resolveProjectCol(
  slug: string,
  nameHint: string | null | undefined,
  scope: NftsScope,
): ProjectCol {
  const known = scope.collections.find((c) => c.slug === slug);
  if (known) {
    return {
      name: known.name,
      slug: known.slug,
      image: known.image,
      website: known.website,
    };
  }
  const name = (nameHint || "").trim() || slug;
  return {
    name,
    slug,
    image: NEUTRAL_NFT_IMAGE,
    website: `https://opensea.io/collection/${slug}`,
  };
}

/** Prefer live OpenSea collection metadata (real image) over local stand-ins. */
async function resolveProjectColAsync(
  slug: string,
  nameHint: string | null | undefined,
  scope: NftsScope,
): Promise<ProjectCol> {
  const base = resolveProjectCol(slug, nameHint, scope);

  const data = (await osFetch(
    `/collections/${encodeURIComponent(slug)}`,
  )) as { collection?: { name?: string; image_url?: string; banner_image_url?: string } } | null;
  const c = data?.collection || (data as { name?: string; image_url?: string; banner_image_url?: string } | null);
  if (!c) {
    // Never keep a mismatched curated local NFT as the project image
    return {
      ...base,
      image: base.image.startsWith("/images/hood-rpc/nfts/")
        ? NEUTRAL_NFT_IMAGE
        : base.image,
    };
  }

  const remote =
    (typeof c.image_url === "string" && c.image_url.trim()) ||
    (typeof c.banner_image_url === "string" && c.banner_image_url.trim()) ||
    "";

  return {
    ...base,
    name: (c.name || "").trim() || base.name,
    image:
      remote && !WEAK_IMAGE_RE.test(remote)
        ? remote
        : base.image.startsWith("/images/hood-rpc/nfts/")
          ? NEUTRAL_NFT_IMAGE
          : base.image,
  };
}

/** Project-scoped fallback — only NFTs from the selected collection. */
function fallbackForCollection(
  slug: string,
  limit: number,
  scope: NftsScope,
  kindBias: "mix" | "eth" | "weth" = "mix",
  nameHint?: string | null,
): SaleRow[] {
  const col = resolveProjectCol(slug, nameHint, scope);
  const now = Date.now();
  const rows: SaleRow[] = [];
  for (let i = 0; i < limit; i++) {
    const idNum = 1000 + (((now / 1000 + i * 37) % 9000) | 0);
    const eth = 0.01 + ((i * 17) % 90) / 1000;
    const kind: "eth" | "weth" =
      kindBias === "mix" ? (i % 3 === 0 ? "weth" : "eth") : kindBias;
    const rank = demoRank(i + slug.length);
    rows.push({
      id: `${col.slug}-${idNum}-${i}`,
      tokenName: `${col.name.split(" ")[0]} #${idNum}`,
      collection: col.name,
      collectionSlug: col.slug,
      openseaUrl: col.website,
      eth: Number(eth.toFixed(4)),
      usd: Number((eth * 3200).toFixed(2)),
      ago: ago(Math.floor(now / 1000) - i * 14),
      kind,
      image: col.image,
      rarityRank: rank,
      rarityUnavailable: false,
      rarityLabel: "",
      traits: [
        { trait: "Chain", value: scope.chainLabel },
        { trait: "Collection", value: col.name },
      ],
      eventTs: Math.floor(now / 1000) - i * 14,
    });
  }
  return rows;
}

function fallbackLive(limit: number, scope: NftsScope): SaleRow[] {
  const rows: SaleRow[] = [];
  for (let i = 0; i < limit; i++) {
    const col = scope.collections[i % scope.collections.length];
    rows.push(...fallbackForCollection(col.slug, 1, scope, i % 3 === 0 ? "weth" : "eth").map((r, j) => ({
      ...r,
      id: `${r.id}-live-${i}-${j}`,
      ago: ago(Math.floor(Date.now() / 1000) - i * 14),
      eventTs: Math.floor(Date.now() / 1000) - i * 14,
    })));
  }
  return rows.slice(0, limit);
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function osFetch(path: string, attempt = 0): Promise<unknown | null> {
  const key = process.env.OPENSEA_API_KEY;
  if (!key) return null;
  const res = await fetch(`https://api.opensea.io/api/v2${path}`, {
    headers: {
      Accept: "application/json",
      "X-API-KEY": key,
      "User-Agent": "HOOD_RPC/1.0",
    },
    cache: "no-store",
  });
  // OpenSea rate-limits bursty parallel NFT lookups — back off and retry
  if (res.status === 429 && attempt < 4) {
    await sleep(350 * (attempt + 1));
    return osFetch(path, attempt + 1);
  }
  if (!res.ok) return null;
  return res.json();
}

/** Run async work with a hard concurrency cap (avoids OpenSea 429s). */
async function mapPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  if (!items.length) return;
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      await fn(items[idx]);
    }
  }
  const n = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(Array.from({ length: n }, () => worker()));
}

function mapEvent(
  ev: OsEvent,
  colName: string,
  colSlug: string,
  colImage: string,
  chainLabel: string,
  assetsChain = "ethereum",
): SaleRow | null {
  const nft = ev.nft;
  if (!nft) return null;
  const { eth, kind, usd } = paymentToEth(ev.payment);
  const osRank = parseOpenSeaRarityRank(nft as Record<string, unknown>);
  const traits = (nft.traits || []).slice(0, 6).map((t) => ({
    trait: String(t.trait_type || "Trait"),
    value: String(t.value ?? ""),
  }));
  const eventTs = parseEventTs(ev.event_timestamp);
  return {
    id: `${colSlug}-${nft.identifier || ev.order_hash || Math.random()}`,
    tokenName: nft.name || `${colName} #${nft.identifier || "?"}`,
    collection: colName,
    collectionSlug: colSlug,
    openseaUrl:
      nft.opensea_url ||
      (nft.contract && nft.identifier
        ? `https://opensea.io/assets/${assetsChain}/${nft.contract}/${nft.identifier}`
        : `https://opensea.io/collection/${colSlug}`),
    eth,
    usd,
    ago: ago(eventTs),
    kind,
    image: pickNftImage(nft, colImage || NEUTRAL_NFT_IMAGE),
    rarityRank: osRank ?? 0,
    rarityUnavailable: osRank == null,
    rarityLabel: "",
    traits: traits.length
      ? traits
      : [
          { trait: "Chain", value: chainLabel },
          { trait: "Collection", value: colName },
        ],
    tokenId: nft.identifier,
    contract: nft.contract,
    eventTs,
  };
}

const rarityCache = new Map<string, { rank: number | null; at: number }>();
const RARITY_CACHE_MS = 30 * 60 * 1000;

function rarityCacheKey(
  chain: string,
  contract?: string,
  tokenId?: string,
): string | null {
  if (!contract || !tokenId) return null;
  return `${chain}:${contract.toLowerCase()}:${tokenId}`;
}

function applyCachedRarity(row: SaleRow, chain: string) {
  const key = rarityCacheKey(chain, row.contract, row.tokenId);
  if (!key) return;
  const hit = rarityCache.get(key);
  if (!hit || Date.now() - hit.at > RARITY_CACHE_MS) return;
  if (hit.rank != null) {
    row.rarityRank = hit.rank;
    row.rarityUnavailable = false;
  }
}

/** Pull per-token art + rarity from the NFT endpoint when event/listing payloads are thin. */
async function enrichNftDetails(
  rows: SaleRow[],
  openseaChain: string,
  opts: {
    colImage?: string;
    forceImage?: boolean;
    limit?: number;
    concurrency?: number;
  } = {},
): Promise<SaleRow[]> {
  const colImage = opts.colImage || "";
  const limit = opts.limit ?? 24;
  const concurrency = opts.concurrency ?? 2;

  for (const row of rows) applyCachedRarity(row, openseaChain);

  const targets = rows
    .filter((r) => r.tokenId && r.contract)
    .filter((r) => {
      const key = rarityCacheKey(openseaChain, r.contract, r.tokenId);
      const hit = key ? rarityCache.get(key) : undefined;
      const fresh = Boolean(hit && Date.now() - hit.at <= RARITY_CACHE_MS);
      const needRank = r.rarityUnavailable && !fresh;
      const needImage =
        opts.forceImage || isWeakOrLocalImage(r.image, colImage);
      return needRank || needImage;
    })
    .slice(0, limit);

  if (!targets.length) return rows;

  await mapPool(targets, concurrency, async (row) => {
    const data = (await osFetch(
      `/chain/${openseaChain}/contract/${row.contract}/nfts/${row.tokenId}`,
    )) as { nft?: OsNft } | null;
    const nft = data?.nft;
    const key = rarityCacheKey(openseaChain, row.contract, row.tokenId);
    if (!nft) return;
    if (nft.name) row.tokenName = nft.name;
    const nextImage = pickNftImage(nft, "");
    if (nextImage) row.image = nextImage;
    if (nft.opensea_url) row.openseaUrl = nft.opensea_url;
    const rank = parseOpenSeaRarityRank(nft as Record<string, unknown>);
    if (key) rarityCache.set(key, { rank, at: Date.now() });
    if (rank != null) {
      row.rarityRank = rank;
      row.rarityUnavailable = false;
    }
  });
  return rows;
}

async function fetchCollectionSales(
  col: { name: string; slug: string; image: string },
  limit: number,
  scope: NftsScope,
  opts: { enrich?: boolean } = {},
): Promise<SaleRow[]> {
  const data = (await osFetch(
    `/events/collection/${col.slug}?event_type=sale&limit=${limit}`,
  )) as { asset_events?: OsEvent[]; events?: OsEvent[] } | null;
  const events = (data?.asset_events || data?.events || []) as OsEvent[];
  const mapped = events
    .map((ev) =>
      mapEvent(ev, col.name, col.slug, col.image, scope.chainLabel, scope.openseaAssetsChain),
    )
    .filter((r): r is SaleRow => Boolean(r))
    .sort(sortNewest);
  if (opts.enrich === false) return mapped;
  return enrichNftDetails(mapped, scope.openseaChain, {
    colImage: col.image,
    forceImage: false,
    limit: Math.min(12, mapped.length),
    concurrency: 2,
  });
}

/** Chain-wide live sales — one fast OpenSea page, newest first. */
async function fetchChainWideSales(
  scope: NftsScope,
  limit: number,
): Promise<SaleRow[]> {
  const target = Math.min(limit, 40);
  const after = Math.floor(Date.now() / 1000) - 180;
  const params = new URLSearchParams({
    event_type: "sale",
    limit: "100",
    after: String(after),
  });

  const data = (await osFetch(`/events?${params.toString()}`)) as {
    asset_events?: OsEvent[];
  } | null;

  const seenIds = new Set<string>();
  const rows: SaleRow[] = [];

  for (const ev of data?.asset_events || []) {
    if (ev.chain && ev.chain !== scope.openseaChain) continue;
    const nft = ev.nft;
    if (!nft?.collection) continue;

    const slug = nft.collection;
    const known = scope.collections.find((c) => c.slug === slug);
    const colName =
      known?.name ||
      nft.name?.replace(/\s*#\d+$/, "").trim() ||
      slug.replace(/-/g, " ");
    const colImage =
      known?.image && !known.image.startsWith("/images/hood-rpc/nfts/")
        ? known.image
        : pickNftImage(nft, NEUTRAL_NFT_IMAGE);

    const row = mapEvent(
      ev,
      colName,
      slug,
      colImage,
      scope.chainLabel,
      scope.openseaAssetsChain,
    );
    if (!row || seenIds.has(row.id)) continue;
    seenIds.add(row.id);
    rows.push(row);
    if (rows.length >= target) break;
  }

  if (rows.length >= Math.min(8, target)) {
    await enrichNftDetails(rows, scope.openseaChain, {
      limit: 12,
      concurrency: 3,
    });
    return rows.sort(sortNewest).slice(0, target);
  }

  // Quiet window — one unfiltered page so the board is not empty
  const fallback = (await osFetch("/events?event_type=sale&limit=100")) as {
    asset_events?: OsEvent[];
  } | null;
  for (const ev of fallback?.asset_events || []) {
    if (ev.chain && ev.chain !== scope.openseaChain) continue;
    const nft = ev.nft;
    if (!nft?.collection) continue;
    const slug = nft.collection;
    const known = scope.collections.find((c) => c.slug === slug);
    const colName =
      known?.name ||
      nft.name?.replace(/\s*#\d+$/, "").trim() ||
      slug.replace(/-/g, " ");
    const row = mapEvent(
      ev,
      colName,
      slug,
      pickNftImage(nft, NEUTRAL_NFT_IMAGE),
      scope.chainLabel,
      scope.openseaAssetsChain,
    );
    if (!row || seenIds.has(row.id)) continue;
    seenIds.add(row.id);
    rows.push(row);
    if (rows.length >= target) break;
  }

  await enrichNftDetails(rows, scope.openseaChain, {
    limit: 12,
    concurrency: 3,
  });
  return rows.sort(sortNewest).slice(0, target);
}

type OsListing = {
  order_hash?: string;
  status?: string;
  remaining_quantity?: number | string;
  order_created_at?: number | string;
  price?: { current?: { currency?: string; decimals?: number; value?: string } };
  asset?: { identifier?: string; contract?: string };
  protocol_data?: {
    parameters?: {
      offer?: { token?: string; identifierOrCriteria?: string }[];
      startTime?: string | number;
    };
  };
};

function listingToken(L: OsListing): { tokenId: string; contract?: string } {
  const assetId = L.asset?.identifier;
  const assetContract = L.asset?.contract;
  const offer = L.protocol_data?.parameters?.offer?.[0];
  const tokenId = String(
    assetId || offer?.identifierOrCriteria || "",
  ).trim();
  const contract = assetContract || offer?.token;
  return { tokenId, contract };
}

async function fetchCollectionListings(
  col: { name: string; slug: string; image: string },
  limit: number,
  scope: NftsScope,
): Promise<SaleRow[]> {
  // Pull extra rows — "best" mixes ACTIVE with fulfilled/cancelled
  const data = (await osFetch(
    `/listings/collection/${col.slug}/best?limit=${Math.min(50, Math.max(limit * 3, 30))}`,
  )) as { listings?: OsListing[] } | null;
  const listings = (data?.listings || []).filter((L) => {
    const status = (L.status || "").toUpperCase();
    if (status && status !== "ACTIVE") return false;
    const rem = Number(L.remaining_quantity);
    if (Number.isFinite(rem) && rem <= 0) return false;
    return true;
  });

  const rows: SaleRow[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < listings.length && rows.length < limit; i++) {
    const L = listings[i];
    const { tokenId, contract } = listingToken(L);
    if (!tokenId || !contract) continue;
    const dedupe = `${contract}:${tokenId}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);

    const value = Number(L.price?.current?.value || 0);
    const decimals = Number(L.price?.current?.decimals ?? 18);
    let eth = value;
    if (value > 1e9) eth = value / 10 ** decimals;
    if (!Number.isFinite(eth) || eth <= 0) eth = 0.05;
    const currency = (L.price?.current?.currency || "ETH").toUpperCase();
    const kind: "eth" | "weth" = currency.includes("WETH") ? "weth" : "eth";

    let createdSec = Number(L.order_created_at);
    if (!Number.isFinite(createdSec) || createdSec <= 0) {
      createdSec = Number(L.protocol_data?.parameters?.startTime);
    }
    if (createdSec > 1e12) createdSec = Math.floor(createdSec / 1000);
    if (!Number.isFinite(createdSec) || createdSec <= 0) {
      createdSec = Math.floor(Date.now() / 1000) - i * 45;
    }

    rows.push({
      id: `list-${col.slug}-${tokenId}-${L.order_hash || i}`,
      tokenName: `${col.name} #${tokenId}`,
      collection: col.name,
      collectionSlug: col.slug,
      openseaUrl: `https://opensea.io/assets/${scope.openseaAssetsChain}/${contract}/${tokenId}`,
      eth: Number(eth.toFixed(4)),
      usd: Number((eth * 3200).toFixed(2)),
      ago: ago(createdSec),
      kind,
      image: "",
      rarityRank: 0,
      rarityUnavailable: true,
      rarityLabel: "",
      traits: [
        { trait: "Chain", value: scope.chainLabel },
        { trait: "Collection", value: col.name },
      ],
      tokenId,
      contract,
      eventTs: createdSec,
    });
  }

  rows.sort((a, b) => (b.eventTs || 0) - (a.eventTs || 0));

  await enrichNftDetails(rows, scope.openseaChain, {
    colImage: col.image,
    forceImage: true,
    limit: rows.length,
    concurrency: 2,
  });

  // Last resort: collection image from OpenSea (remote) or neutral — never another project's local art
  const safeFallback =
    col.image && !col.image.startsWith("/images/hood-rpc/nfts/")
      ? col.image
      : NEUTRAL_NFT_IMAGE;
  for (const row of rows) {
    if (!row.image || row.image.startsWith("/images/hood-rpc/nfts/")) {
      row.image = safeFallback;
    }
  }

  return rows;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  const limit = Math.min(40, Math.max(8, Number(searchParams.get("limit") || 24)));
  const scope = makeScope(resolveApiVariant(req));

  const hasKey = Boolean(process.env.OPENSEA_API_KEY);
  const collections = scope.collections.map((c) => ({
    name: c.name,
    slug: c.slug,
    image: c.image,
    website: c.website,
    twitter: c.twitter,
    discord: c.discord,
  }));

  const nameParam = searchParams.get("name")?.trim() || null;

  if (!hasKey) {
    const project = slug
      ? fallbackForCollection(slug, 14, scope, "mix", nameParam)
      : [];
    return NextResponse.json({
      source: scope.curatedSource,
      live: true,
      note: "Add OPENSEA_API_KEY for live OpenSea sales.",
      collections,
      sales: fallbackLive(limit, scope),
      projectSales: project,
      listings: slug
        ? fallbackForCollection(slug, 14, scope, "mix", nameParam)
        : [],
      focusSlug: slug || undefined,
      focusName: slug ? resolveProjectCol(slug, nameParam, scope).name : undefined,
    });
  }

  try {
    if (slug) {
      const col = await resolveProjectColAsync(slug, nameParam, scope);
      const [projectSalesRaw, listingsRaw] = await Promise.all([
        fetchCollectionSales(col, 20, scope),
        fetchCollectionListings(col, 20, scope),
      ]);

      const projectSales = projectSalesRaw.filter(
        (r) => r.collectionSlug === slug,
      );
      const listings = listingsRaw.filter((r) => r.collectionSlug === slug);

      return NextResponse.json({
        source: "opensea",
        live: true,
        collections,
        sales: [],
        projectSales,
        listings,
        focusSlug: slug,
        focusName: col.name,
      });
    }

    const sales = await fetchChainWideSales(scope, limit);

    return NextResponse.json(
      {
        source: "opensea",
        live: true,
        collections,
        sales: sales.length ? sales : fallbackLive(limit, scope),
        projectSales: [],
        listings: [],
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (err) {
    return NextResponse.json({
      source: "fallback",
      live: true,
      error: err instanceof Error ? err.message : "OpenSea fetch failed",
      collections,
      sales: fallbackLive(limit, scope),
      projectSales: slug
        ? fallbackForCollection(slug, 14, scope, "mix", nameParam)
        : [],
      listings: slug
        ? fallbackForCollection(slug, 14, scope, "mix", nameParam)
        : [],
      focusSlug: slug || undefined,
      focusName: slug ? resolveProjectCol(slug, nameParam, scope).name : undefined,
    });
  }
}
