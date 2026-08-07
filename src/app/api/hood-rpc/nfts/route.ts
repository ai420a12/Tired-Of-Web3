import { NextResponse } from "next/server";
import { HOOD_COLLECTIONS } from "@/components/hood-rpc/mock-data";
import { parseOpenSeaRarityRank } from "@/components/hood-rpc/hood-rarity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OsNft = {
  identifier?: string;
  name?: string;
  image_url?: string;
  display_image_url?: string;
  opensea_url?: string;
  contract?: string;
  traits?: { trait_type?: string; value?: string | number }[];
  rarity?: unknown;
  rarity_rank?: number | string;
  rank?: number | string;
};

type OsEvent = {
  event_type?: string;
  order_hash?: string;
  chain?: string;
  payment?: { quantity?: string; token?: { symbol?: string; usd_price?: string; decimals?: number } };
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

function ago(tsSec?: number): string {
  if (!tsSec) return "just now";
  const s = Math.max(0, Math.floor(Date.now() / 1000 - tsSec));
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
  const decimals = Number(payment?.token?.decimals ?? 18);
  let eth = qty;
  if (qty > 1e9) eth = qty / 10 ** decimals;
  if (!Number.isFinite(eth) || eth <= 0) eth = 0.05;
  const usdPrice = Number(payment?.token?.usd_price || 0);
  const usd = usdPrice > 0 ? eth * usdPrice : eth * 3200;
  const symbol = (payment?.token?.symbol || "ETH").toUpperCase();
  const kind = symbol.includes("WETH") ? "weth" : "eth";
  return { eth: Number(eth.toFixed(4)), kind, usd: Number(usd.toFixed(2)) };
}

/** Resolve a project by slug — never substitute a different curated collection. */
function resolveProjectCol(
  slug: string,
  nameHint?: string | null,
): { name: string; slug: string; image: string; website: string } {
  const known = HOOD_COLLECTIONS.find((c) => c.slug === slug);
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
    image: "/images/hood-rpc/nfts/robinhood-punks.png",
    website: `https://opensea.io/collection/${slug}`,
  };
}

/** Project-scoped fallback — only NFTs from the selected collection. */
function fallbackForCollection(
  slug: string,
  limit: number,
  kindBias: "mix" | "eth" | "weth" = "mix",
  nameHint?: string | null,
): SaleRow[] {
  const col = resolveProjectCol(slug, nameHint);
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
        { trait: "Chain", value: "Robinhood" },
        { trait: "Collection", value: col.name },
      ],
      eventTs: Math.floor(now / 1000) - i * 14,
    });
  }
  return rows;
}

function fallbackLive(limit: number): SaleRow[] {
  const rows: SaleRow[] = [];
  for (let i = 0; i < limit; i++) {
    const col = HOOD_COLLECTIONS[i % HOOD_COLLECTIONS.length];
    rows.push(...fallbackForCollection(col.slug, 1, i % 3 === 0 ? "weth" : "eth").map((r, j) => ({
      ...r,
      id: `${r.id}-live-${i}-${j}`,
      ago: ago(Math.floor(Date.now() / 1000) - i * 14),
      eventTs: Math.floor(Date.now() / 1000) - i * 14,
    })));
  }
  return rows.slice(0, limit);
}

async function osFetch(path: string) {
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
  if (!res.ok) return null;
  return res.json();
}

function mapEvent(
  ev: OsEvent,
  colName: string,
  colSlug: string,
  colImage: string,
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
      nft.opensea_url || `https://opensea.io/collection/${colSlug}`,
    eth,
    usd,
    ago: ago(eventTs),
    kind,
    image: nft.display_image_url || nft.image_url || colImage,
    rarityRank: osRank ?? 0,
    rarityUnavailable: osRank == null,
    rarityLabel: "",
    traits: traits.length
      ? traits
      : [
          { trait: "Chain", value: "Robinhood" },
          { trait: "Collection", value: colName },
        ],
    tokenId: nft.identifier,
    contract: nft.contract,
    eventTs,
  };
}

async function enrichRarity(rows: SaleRow[]): Promise<SaleRow[]> {
  const need = rows.filter((r) => r.rarityUnavailable && r.tokenId && r.contract).slice(0, 12);
  if (!need.length) return rows;

  await Promise.all(
    need.map(async (row) => {
      const data = await osFetch(
        `/chain/robinhood/contract/${row.contract}/nfts/${row.tokenId}`,
      );
      const nft = data?.nft;
      if (!nft) return;
      const rank = parseOpenSeaRarityRank(nft as Record<string, unknown>);
      if (rank == null) return;
      row.rarityRank = rank;
      row.rarityUnavailable = false;
      if (nft.display_image_url || nft.image_url) {
        row.image = nft.display_image_url || nft.image_url;
      }
      if (nft.opensea_url) row.openseaUrl = nft.opensea_url;
    }),
  );
  return rows;
}

async function fetchCollectionSales(
  col: { name: string; slug: string; image: string },
  limit: number,
  opts: { enrich?: boolean } = {},
): Promise<SaleRow[]> {
  const data = await osFetch(
    `/events/collection/${col.slug}?event_type=sale&limit=${limit}`,
  );
  const events = (data?.asset_events || data?.events || []) as OsEvent[];
  const mapped = events
    .map((ev) => mapEvent(ev, col.name, col.slug, col.image))
    .filter((r): r is SaleRow => Boolean(r))
    .sort(sortNewest);
  if (opts.enrich === false) return mapped;
  return enrichRarity(mapped);
}

async function fetchCollectionListings(
  col: { name: string; slug: string; image: string },
  limit: number,
): Promise<SaleRow[]> {
  const data = await osFetch(
    `/listings/collection/${col.slug}/best?limit=${limit}`,
  );
  const listings = (data?.listings || []) as {
    order_hash?: string;
    order_created_at?: number | string;
    price?: { current?: { currency?: string; decimals?: number; value?: string } };
    protocol_data?: {
      parameters?: {
        offer?: { token?: string; identifierOrCriteria?: string }[];
        startTime?: string | number;
      };
    };
  }[];

  const rows: SaleRow[] = [];
  for (let i = 0; i < listings.length; i++) {
    const L = listings[i];
    const offer = L.protocol_data?.parameters?.offer?.[0];
    const tokenId = offer?.identifierOrCriteria || String(1000 + i);
    const contract = offer?.token;
    const value = Number(L.price?.current?.value || 0);
    const decimals = Number(L.price?.current?.decimals ?? 18);
    let eth = value;
    if (value > 1e9) eth = value / 10 ** decimals;
    if (!Number.isFinite(eth) || eth <= 0) eth = 0.05;
    const currency = (L.price?.current?.currency || "ETH").toUpperCase();
    const kind: "eth" | "weth" = currency.includes("WETH") ? "weth" : "eth";

    // Prefer OpenSea order_created_at (unix sec); fallback to Seaport startTime
    let createdSec = Number(L.order_created_at);
    if (!Number.isFinite(createdSec) || createdSec <= 0) {
      createdSec = Number(L.protocol_data?.parameters?.startTime);
    }
    // Some APIs return ms
    if (createdSec > 1e12) createdSec = Math.floor(createdSec / 1000);
    if (!Number.isFinite(createdSec) || createdSec <= 0) {
      // Last resort: spread by index so newest→oldest still reads as ages
      createdSec = Math.floor(Date.now() / 1000) - i * 45;
    }

    rows.push({
      id: `list-${col.slug}-${tokenId}-${L.order_hash || i}`,
      tokenName: `${col.name.split(" ")[0]} #${tokenId}`,
      collection: col.name,
      collectionSlug: col.slug,
      openseaUrl: contract
        ? `https://opensea.io/assets/robinhood/${contract}/${tokenId}`
        : `https://opensea.io/collection/${col.slug}`,
      eth: Number(eth.toFixed(4)),
      usd: Number((eth * 3200).toFixed(2)),
      ago: ago(createdSec),
      kind,
      image: col.image,
      rarityRank: 0,
      rarityUnavailable: true,
      rarityLabel: "",
      traits: [
        { trait: "Chain", value: "Robinhood" },
        { trait: "Collection", value: col.name },
      ],
      tokenId,
      contract,
      eventTs: createdSec,
    });
  }

  // Newest listings first
  rows.sort((a, b) => (b.eventTs || 0) - (a.eventTs || 0));

  // Attach images + rarity from NFT endpoint
  await Promise.all(
    rows.slice(0, 12).map(async (row) => {
      if (!row.contract || !row.tokenId) return;
      const data = await osFetch(
        `/chain/robinhood/contract/${row.contract}/nfts/${row.tokenId}`,
      );
      const nft = data?.nft;
      if (!nft) return;
      if (nft.name) row.tokenName = nft.name;
      if (nft.display_image_url || nft.image_url) {
        row.image = nft.display_image_url || nft.image_url;
      }
      if (nft.opensea_url) row.openseaUrl = nft.opensea_url;
      const rank = parseOpenSeaRarityRank(nft as Record<string, unknown>);
      if (rank != null) {
        row.rarityRank = rank;
        row.rarityUnavailable = false;
      }
    }),
  );

  return rows;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  const limit = Math.min(40, Math.max(8, Number(searchParams.get("limit") || 24)));

  const hasKey = Boolean(process.env.OPENSEA_API_KEY);
  const collections = HOOD_COLLECTIONS.map((c) => ({
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
      ? fallbackForCollection(slug, 14, "mix", nameParam)
      : [];
    return NextResponse.json({
      source: "curated-robinhood",
      live: true,
      note: "Add OPENSEA_API_KEY for live OpenSea sales.",
      collections,
      sales: fallbackLive(limit),
      projectSales: project,
      listings: slug
        ? fallbackForCollection(slug, 14, "mix", nameParam)
        : [],
      focusSlug: slug || undefined,
      focusName: slug ? resolveProjectCol(slug, nameParam).name : undefined,
    });
  }

  try {
    if (slug) {
      // Never fall back to another collection (was causing Punks when clicking Zaibatsu, etc.)
      const col = resolveProjectCol(slug, nameParam);
      const [projectSalesRaw, listingsRaw] = await Promise.all([
        fetchCollectionSales(col, 20),
        fetchCollectionListings(col, 20),
      ]);

      // Hard filter — only rows for the requested slug
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

    // Live feed — fast path: recent sales, no rarity enrichment delay
    // Prefer volume-active RH collections + curated list
    type LiveCol = {
      name: string;
      slug: string;
      image: string;
      website?: string;
      twitter?: string;
      discord?: string;
    };
    let liveCols: LiveCol[] = collections.slice(0, 10);
    try {
      const vol = await osFetch(
        "/collections?chain=robinhood&order_by=seven_day_volume&limit=12",
      );
      const fromVol = ((vol?.collections || []) as { collection?: string; name?: string; image_url?: string }[])
        .map((c) => ({
          name: c.name || c.collection || "",
          slug: c.collection || "",
          image: c.image_url || "/images/hood-rpc/nfts/robinhood-punks.png",
          website: `https://opensea.io/collection/${c.collection}`,
          twitter: "",
          discord: "",
        }))
        .filter((c) => c.slug);
      if (fromVol.length) {
        // Merge volume leaders first, then curated
        const seen = new Set(fromVol.map((c) => c.slug));
        liveCols = [
          ...fromVol,
          ...collections.filter((c) => !seen.has(c.slug)),
        ].slice(0, 12);
      }
    } catch {
      /* keep curated */
    }

    const batches = await Promise.all(
      liveCols.map((col) =>
        fetchCollectionSales(col, 8, { enrich: false }),
      ),
    );

    const nowSec = Math.floor(Date.now() / 1000);
    // Prefer sales from the last 48h so stale collection history doesn't swamp the feed
    const MAX_AGE_SEC = 48 * 3600;
    const merged = batches
      .flat()
      .filter((r) => (r.eventTs || 0) > 0 && nowSec - (r.eventTs || 0) <= MAX_AGE_SEC)
      .sort(sortNewest);

    // Dedupe by id (keep newest occurrence)
    const seenIds = new Set<string>();
    const sales: SaleRow[] = [];
    for (const row of merged) {
      if (seenIds.has(row.id)) continue;
      seenIds.add(row.id);
      sales.push(row);
      if (sales.length >= limit) break;
    }

    // If filter was too strict (quiet market), fall back to all timed sales
    if (sales.length < Math.min(8, limit)) {
      const allTimed = batches
        .flat()
        .filter((r) => (r.eventTs || 0) > 0)
        .sort(sortNewest);
      for (const row of allTimed) {
        if (seenIds.has(row.id)) continue;
        seenIds.add(row.id);
        sales.push(row);
        if (sales.length >= limit) break;
      }
    }

    // Light rarity enrich for newest rows only (keeps feed snappy)
    await enrichRarity(sales.slice(0, 10));
    sales.sort(sortNewest);

    return NextResponse.json({
      source: "opensea",
      live: true,
      collections,
      sales: sales.length ? sales : fallbackLive(limit),
      projectSales: [],
      listings: [],
    });
  } catch (err) {
    return NextResponse.json({
      source: "fallback",
      live: true,
      error: err instanceof Error ? err.message : "OpenSea fetch failed",
      collections,
      sales: fallbackLive(limit),
      projectSales: slug
        ? fallbackForCollection(slug, 14, "mix", nameParam)
        : [],
      listings: slug
        ? fallbackForCollection(slug, 14, "mix", nameParam)
        : [],
      focusSlug: slug || undefined,
      focusName: slug ? resolveProjectCol(slug, nameParam).name : undefined,
    });
  }
}
