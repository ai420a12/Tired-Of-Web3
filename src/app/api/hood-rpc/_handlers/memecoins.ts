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

async function fetchJson(url: string) {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "HOOD_RPC/1.0" },
    next: { revalidate: 30 },
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

export async function handleMemecoins(cfg: HoodRpcChainConfig) {
  try {
    const network = cfg.geckoNetwork;
    const [trending, newest] = await Promise.all([
      fetchJson(
        `https://api.geckoterminal.com/api/v2/networks/${network}/trending_pools?page=1`,
      ).catch(() => ({ data: [], included: [] })),
      fetchJson(
        `https://api.geckoterminal.com/api/v2/networks/${network}/new_pools?page=1`,
      ).catch(() => ({ data: [], included: [] })),
    ]);

    const pools = [
      ...((newest.data as GeckoPool[]) || []),
      ...((trending.data as GeckoPool[]) || []),
    ];
    const tokens = new Map<string, GeckoToken>();
    for (const t of (newest.included as GeckoToken[]) || []) {
      if (t?.id) tokens.set(t.id, t);
    }
    for (const t of (trending.included as GeckoToken[]) || []) {
      if (t?.id) tokens.set(t.id, t);
    }

    const seen = new Set<string>();
    const launches = [];
    for (const pool of pools) {
      const addr = pool.attributes?.address?.toLowerCase();
      if (!addr || seen.has(addr)) continue;
      seen.add(addr);

      const baseId = pool.relationships?.base_token?.data?.id;
      const token = baseId ? tokens.get(baseId) : undefined;
      const symbol = (token?.attributes?.symbol || pool.attributes.name.split(" / ")[0] || "???")
        .replace(/^\$/, "")
        .toUpperCase();
      const name = token?.attributes?.name || symbol;
      const mcap = Number(pool.attributes.market_cap_usd || pool.attributes.fdv_usd || 0);
      const liq = Number(pool.attributes.reserve_in_usd || 0);
      const created = pool.attributes.pool_created_at;
      const ageMs = created ? Date.now() - new Date(created).getTime() : Infinity;
      const status = ageMs < 30 * 60 * 1000 ? "LIVE" : ageMs < 24 * 3600 * 1000 ? "SOON" : "LIVE";

      launches.push({
        id: addr,
        ticker: `$${symbol}`,
        name,
        age: ageLabel(created),
        liquidity: fmtUsd(liq),
        mcap: fmtUsd(mcap),
        status,
        logo: cfg.variant === "eth"
          ? cfg.defaultTokenLogo
          : token?.attributes?.image_url || cfg.defaultTokenLogo,
        pairUrl: `https://www.geckoterminal.com/${network}/pools/${addr}`,
        createdAt: created,
      });
    }

    launches.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });

    return NextResponse.json({
      source: "geckoterminal",
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
