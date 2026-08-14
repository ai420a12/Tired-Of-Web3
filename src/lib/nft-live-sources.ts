/**
 * Alternate NFT live sources when OpenSea flaps (503 / tiny rate limits).
 * - Ethereum: Alchemy NFT Sales API
 * - Robinhood: Blockscout ERC-721 transfers (real on-chain activity)
 */
import { parseOpenSeaRarityRank } from "@/components/hood-rpc/hood-rarity";

export type LiveSaleRow = {
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

const NEUTRAL = "/images/hood-rpc/mascot-lime.png";
const ETH_USD = 3200;

function ago(tsSec?: number, nowSec = Math.floor(Date.now() / 1000)): string {
  if (!tsSec) return "just now";
  const s = Math.max(0, nowSec - tsSec);
  if (s < 2) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

function alchemyKey(): string | null {
  const direct = (process.env.ALCHEMY_API_KEY || "").trim();
  if (direct) return direct;
  const rpc = [
    process.env.ETH_RPC_URL,
    process.env.RPC_URLS,
    process.env.ALCHEMY_RPC_URL,
  ]
    .filter(Boolean)
    .join(",");
  const m = rpc.match(/alchemy\.com\/(?:nft\/v3|v2)\/([A-Za-z0-9_-]+)/);
  return m?.[1] || null;
}

function alchemyKeysToTry(): string[] {
  const primary = alchemyKey();
  return primary ? [primary] : [];
}

async function fetchJson(
  url: string,
  init?: RequestInit,
  timeoutMs = 5_000,
): Promise<unknown | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "TiredOfWeb3-RPC/1.0",
        ...(init?.headers || {}),
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

type AlchemySale = {
  marketplace?: string;
  contractAddress?: string;
  tokenId?: string;
  sellerFee?: { amount?: string; symbol?: string; decimals?: number };
  protocolFee?: { amount?: string };
  royaltyFee?: { amount?: string };
  blockTimestamp?: string;
};

type AlchemyNft = {
  name?: string;
  tokenId?: string;
  contract?: { address?: string; name?: string; openSeaMetadata?: { collectionName?: string; imageUrl?: string } };
  image?: { cachedUrl?: string; originalUrl?: string; pngUrl?: string };
  raw?: { metadata?: { name?: string; image?: string; attributes?: { trait_type?: string; value?: string | number }[] } };
  rarity?: { rank?: number };
};

const MAX_SALE_ETH = 100;

function alchemyEthAmount(sale: AlchemySale): { eth: number; kind: "eth" | "weth" } | null {
  const fee = sale.sellerFee;
  const decimals = Number(fee?.decimals ?? 18);
  const raw = String(fee?.amount ?? "").trim();
  if (!raw) return null;
  let eth = 0;
  try {
    if (raw.includes(".") || raw.includes("e") || raw.includes("E")) {
      eth = Number(raw);
    } else {
      const wei = BigInt(raw);
      const base = 10n ** BigInt(Number.isFinite(decimals) ? Math.max(0, Math.min(36, decimals)) : 18);
      eth = Number(wei) / Number(base);
    }
  } catch {
    return null;
  }
  if (!Number.isFinite(eth) || eth <= 0 || eth > MAX_SALE_ETH) return null;
  const sym = (fee?.symbol || "ETH").toUpperCase();
  if (sym && !sym.includes("ETH") && !sym.includes("WETH")) return null;
  return { eth, kind: sym.includes("WETH") ? "weth" : "eth" };
}

/** Ethereum live sales via Alchemy (works when OpenSea is 503). */
export async function fetchAlchemyEthSales(
  limit: number,
): Promise<LiveSaleRow[]> {
  for (const key of alchemyKeysToTry()) {
    const data = (await fetchJson(
      `https://eth-mainnet.g.alchemy.com/nft/v3/${key}/getNFTSales?limit=${Math.min(limit, 50)}&order=desc`,
    )) as { nftSales?: AlchemySale[] } | null;

    const sales = (data?.nftSales || []).slice(0, limit);
    if (!sales.length) continue;

    const tokens = sales
      .filter((s) => s.contractAddress && s.tokenId != null)
      .map((s) => ({
        contractAddress: s.contractAddress!,
        tokenId: String(s.tokenId),
      }));

    let metaByKey = new Map<string, AlchemyNft>();
    if (tokens.length) {
      const batch = (await fetchJson(
        `https://eth-mainnet.g.alchemy.com/nft/v3/${key}/getNFTMetadataBatch`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tokens: tokens.slice(0, 40) }),
        },
        7_000,
      )) as { nfts?: AlchemyNft[] } | null;
      for (const nft of batch?.nfts || []) {
        const c = (nft.contract?.address || "").toLowerCase();
        const id = String(nft.tokenId || "");
        if (c && id) metaByKey.set(`${c}:${id}`, nft);
      }
    }

    const rows: LiveSaleRow[] = [];
    for (const sale of sales) {
      const contract = (sale.contractAddress || "").toLowerCase();
      const tokenId = String(sale.tokenId || "");
      if (!contract || !tokenId) continue;
      const meta = metaByKey.get(`${contract}:${tokenId}`);
      const paid = alchemyEthAmount(sale);
      if (!paid) continue;
      const { eth, kind } = paid;
      const collection =
        meta?.contract?.openSeaMetadata?.collectionName ||
        meta?.contract?.name ||
        "Ethereum NFT";
      const tokenName =
        meta?.name ||
        meta?.raw?.metadata?.name ||
        `${collection} #${tokenId}`;
      const image =
        meta?.image?.cachedUrl ||
        meta?.image?.pngUrl ||
        meta?.image?.originalUrl ||
        meta?.raw?.metadata?.image ||
        meta?.contract?.openSeaMetadata?.imageUrl ||
        NEUTRAL;
      const ts = sale.blockTimestamp
        ? Math.floor(Date.parse(sale.blockTimestamp) / 1000)
        : 0;
      if (!ts) continue;
      const rank =
        typeof meta?.rarity?.rank === "number"
          ? meta.rarity.rank
          : parseOpenSeaRarityRank(meta as Record<string, unknown>);
      const traits = (meta?.raw?.metadata?.attributes || [])
        .slice(0, 6)
        .map((a) => ({
          trait: String(a.trait_type || "Trait"),
          value: String(a.value ?? ""),
        }));

      rows.push({
        id: `alchemy-${contract}-${tokenId}-${ts}`,
        tokenName,
        collection,
        collectionSlug: slugify(collection),
        openseaUrl: `https://opensea.io/assets/ethereum/${contract}/${tokenId}`,
        eth: Number(eth.toFixed(5)),
        usd: Number((eth * ETH_USD).toFixed(2)),
        ago: ago(ts),
        kind,
        image: typeof image === "string" && image.startsWith("http") ? image : NEUTRAL,
        rarityRank: rank ?? 0,
        rarityUnavailable: rank == null,
        rarityLabel: "",
        traits: traits.length
          ? traits
          : [
              { trait: "Chain", value: "Ethereum" },
              { trait: "Source", value: "Alchemy" },
            ],
        tokenId,
        contract,
        eventTs: ts,
      });
    }
    if (rows.length) return rows;
  }
  return [];
}

type BsTransfer = {
  timestamp?: string;
  token?: { name?: string; address_hash?: string; address?: string; symbol?: string };
  total?: {
    token_id?: string | number;
    token_instance?: {
      id?: string | number;
      image_url?: string;
      media_url?: string;
      metadata?: { name?: string; image?: string; attributes?: { trait_type?: string; value?: string | number }[] };
    };
  };
  from?: { hash?: string };
  to?: { hash?: string };
  transaction_hash?: string;
};

const BS_SKIP =
  /uniswap|position|v3 positions|v4 positions|liquidity|lp nft/i;

/** Live NFT activity via Blockscout (no OpenSea key required). */
export async function fetchBlockscoutActivity(
  chain: "robinhood" | "ethereum",
  limit: number,
): Promise<LiveSaleRow[]> {
  const base =
    chain === "ethereum"
      ? "https://eth.blockscout.com/api/v2"
      : "https://robinhoodchain.blockscout.com/api/v2";
  const assetsChain = chain === "ethereum" ? "ethereum" : "robinhood";
  const chainLabel = chain === "ethereum" ? "Ethereum" : "Robinhood";

  const data = (await fetchJson(
    `${base}/token-transfers?type=ERC-721`,
    undefined,
    6_000,
  )) as { items?: BsTransfer[] } | null;

  const rows: LiveSaleRow[] = [];
  for (const t of data?.items || []) {
    const tok = t.token || {};
    const name = tok.name || "";
    if (!name || BS_SKIP.test(name)) continue;
    const contract = (tok.address_hash || tok.address || "").toLowerCase();
    const ti = t.total?.token_instance;
    const tokenId = String(t.total?.token_id ?? ti?.id ?? "");
    if (!contract || !tokenId) continue;

    const md = ti?.metadata && typeof ti.metadata === "object" ? ti.metadata : {};
    const tokenName = md.name || `${name} #${tokenId}`;
    const rawImage = ti?.image_url || ti?.media_url || md.image || "";
    const image =
      typeof rawImage === "string" &&
      (rawImage.startsWith("http://") || rawImage.startsWith("https://"))
        ? rawImage
        : NEUTRAL;
    const ts = t.timestamp
      ? Math.floor(Date.parse(t.timestamp) / 1000)
      : Math.floor(Date.now() / 1000);
    const fromZero =
      (t.from?.hash || "").toLowerCase() ===
      "0x0000000000000000000000000000000000000000";
    const traits = (md.attributes || []).slice(0, 6).map((a) => ({
      trait: String(a.trait_type || "Trait"),
      value: String(a.value ?? ""),
    }));

    rows.push({
      id: `bs-${chain}-${contract}-${tokenId}-${t.transaction_hash || ts}`,
      tokenName,
      collection: name,
      collectionSlug: slugify(name),
      openseaUrl: `https://opensea.io/assets/${assetsChain}/${contract}/${tokenId}`,
      eth: 0,
      usd: 0,
      ago: ago(ts),
      kind: "eth",
      image,
      rarityRank: 0,
      rarityUnavailable: true,
      rarityLabel: "",
      traits: traits.length
        ? traits
        : [
            { trait: "Chain", value: chainLabel },
            { trait: "Event", value: fromZero ? "Mint" : "Transfer" },
            { trait: "Source", value: "Blockscout" },
          ],
      tokenId,
      contract,
      eventTs: ts,
    });
    if (rows.length >= limit) break;
  }
  return rows;
}

/** @deprecated use fetchBlockscoutActivity("robinhood", limit) */
export async function fetchBlockscoutRobinhoodActivity(
  limit: number,
): Promise<LiveSaleRow[]> {
  return fetchBlockscoutActivity("robinhood", limit);
}
