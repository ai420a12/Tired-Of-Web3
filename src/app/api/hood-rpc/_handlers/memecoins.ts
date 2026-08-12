import { NextResponse } from "next/server";
import type { HoodRpcChainConfig } from "@/lib/hood-rpc-chain";

export const runtime = "nodejs";
export const revalidate = 30;

type GeckoPool = {
  id: string;
  attributes: {
    name: string;
    address: string;
    pool_created_at: string | null;
    base_token_price_usd: string | null;
    fdv_usd: string | null;
    market_cap_usd: string | null;
    reserve_in_usd: string | null;
    volume_usd?: { h24?: string };
  };
  relationships?: {
    base_token?: { data?: { id: string } };
    quote_token?: { data?: { id: string } };
  };
};

type GeckoToken = {
  id: string;
  attributes: {
    symbol: string;
    name: string;
    image_url: string | null;
    address?: string;
  };
};

const MAX_POOL_AGE_MS = 48 * 60 * 60 * 1000;
const MIN_LIQUIDITY_USD = 750;
const MIN_VOLUME_24H_USD = 25;
const MEME_QUOTES = new Set(["WETH", "ETH"]);
const ESTABLISHED_SYMBOLS = new Set([
  "WETH",
  "ETH",
  "USDC",
  "USDT",
  "DAI",
  "WBTC",
  "BTC",
  "ARB",
  "OP",
  "LINK",
  "UNI",
  "AAVE",
  "MKR",
  "SOL",
  "BNB",
  "MATIC",
  "POL",
  "AVAX",
  "DOGE",
  "SHIB",
  "PEPE",
  "WQTUM",
  "VANRY",
  "OMNI",
  "RHOOK",
  "STETH",
  "WSTETH",
  "CBETH",
  "RETH",
  "FRAX",
  "USDE",
  "USDS",
  "TUSD",
  "BUSD",
  "FDUSD",
  "EURC",
  "GUSD",
  "LUSD",
  "USDC.E",
  "USDT.E",
]);

function ageLabel(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "0s";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function fmtUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function parsePoolPair(poolName: string): { base: string; quote: string } | null {
  const parts = poolName.split(" / ");
  if (parts.length < 2) return null;
  const base = parts[0].trim().replace(/^\$/, "");
  const quote = parts[1].trim().split(/\s+/)[0]?.replace(/^\$/, "") || "";
  if (!base || !quote) return null;
  return { base, quote };
}

function normalizeSymbol(symbol: string): string {
  return symbol.trim().replace(/^\$/, "").toUpperCase();
}

function isJunkMemecoinSymbol(symbol: string, name: string): boolean {
  const sym = normalizeSymbol(symbol);
  const label = `${sym} ${name}`.trim();
  if (sym.length < 2) return true;
  if (/^TEST/i.test(sym) || /^TEST/i.test(name)) return true;
  if (/^[.\-_\/\\]+$/.test(sym)) return true;
  if (ESTABLISHED_SYMBOLS.has(sym)) return true;
  if (/^(USDC|USDT|DAI|WETH|ETH)$/i.test(sym)) return true;
  if (label.length > 48) return true;
  return false;
}

function launchStatus(ageMs: number): "LIVE" | "SOON" | "ENDED" {
  if (ageMs <= 30 * 60 * 1000) return "LIVE";
  if (ageMs <= 6 * 60 * 60 * 1000) return "SOON";
  return "LIVE";
}

function isRealMemecoinLaunch(
  pool: GeckoPool,
  token: GeckoToken | undefined,
): { ok: boolean; symbol: string; name: string } | null {
  const attrs = pool.attributes;
  const created = attrs.pool_created_at;
  if (!created) return null;

  const ageMs = Date.now() - new Date(created).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > MAX_POOL_AGE_MS) return null;

  const liq = Number(attrs.reserve_in_usd || 0);
  if (!Number.isFinite(liq) || liq < MIN_LIQUIDITY_USD) return null;

  const vol24 = Number(attrs.volume_usd?.h24 || 0);
  if (Number.isFinite(vol24) && vol24 > 0 && vol24 < MIN_VOLUME_24H_USD) return null;

  const pair = parsePoolPair(attrs.name || "");
  if (!pair) return null;
  const quote = normalizeSymbol(pair.quote);
  if (!MEME_QUOTES.has(quote)) return null;

  const symbol = normalizeSymbol(
    token?.attributes?.symbol || pair.base || "???",
  );
  const name = (token?.attributes?.name || pair.base || symbol).trim();
  if (isJunkMemecoinSymbol(symbol, name)) return null;

  return { ok: true, symbol, name };
}

async function fetchJson(url: string) {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "HOOD_RPC/1.0" },
    next: { revalidate: 30 },
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

async function fetchNewPools(network: string, pages = 2): Promise<GeckoPool[]> {
  const pools: GeckoPool[] = [];
  for (let page = 1; page <= pages; page += 1) {
    const data = (await fetchJson(
      `https://api.geckoterminal.com/api/v2/networks/${network}/new_pools?page=${page}`,
    ).catch(() => ({ data: [], included: [] }))) as {
      data?: GeckoPool[];
    };
    pools.push(...(data.data || []));
  }
  return pools;
}

export async function handleMemecoins(cfg: HoodRpcChainConfig) {
  try {
    const network = cfg.geckoNetwork;
    const pools = await fetchNewPools(network, 2);

    const launches: {
      id: string;
      ticker: string;
      name: string;
      age: string;
      liquidity: string;
      mcap: string;
      status: "LIVE" | "SOON" | "ENDED";
      logo: string;
      pairUrl: string;
      createdAt: string;
      createdAtMs: number;
    }[] = [];

    const seen = new Set<string>();
    for (const pool of pools) {
      const addr = pool.attributes?.address?.toLowerCase();
      if (!addr || seen.has(addr)) continue;

      const parsed = isRealMemecoinLaunch(pool, undefined);
      if (!parsed) continue;

      const tokenKey = `${normalizeSymbol(parsed.symbol)}:${parsed.name.toLowerCase()}`;
      if (seen.has(tokenKey)) continue;
      seen.add(addr);
      seen.add(tokenKey);

      const created = pool.attributes.pool_created_at!;
      const createdAtMs = new Date(created).getTime();
      const ageMs = Date.now() - createdAtMs;
      const mcap = Number(
        pool.attributes.market_cap_usd || pool.attributes.fdv_usd || 0,
      );
      const liq = Number(pool.attributes.reserve_in_usd || 0);

      launches.push({
        id: addr,
        ticker: `$${parsed.symbol}`,
        name: parsed.name,
        age: ageLabel(created),
        liquidity: fmtUsd(liq),
        mcap: fmtUsd(mcap),
        status: launchStatus(ageMs),
        logo: cfg.defaultTokenLogo,
        pairUrl: `https://www.geckoterminal.com/${network}/pools/${addr}`,
        createdAt: created,
        createdAtMs,
      });
    }

    launches.sort((a, b) => b.createdAtMs - a.createdAtMs);

    return NextResponse.json({
      source: "geckoterminal-new-pools",
      chain: cfg.openseaChain,
      updatedAt: new Date().toISOString(),
      launches: launches.slice(0, 40),
    });
  } catch (err) {
    return NextResponse.json(
      {
        source: "error",
        chain: cfg.openseaChain,
        error: err instanceof Error ? err.message : "Failed to load memecoins",
        launches: [],
      },
      { status: 502 },
    );
  }
}
