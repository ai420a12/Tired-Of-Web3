"use client";

import { useEffect, useState } from "react";
import {
  DEX_CHAIN,
  DEX_POOL_ADDRESS,
  LINKS,
} from "@/lib/constants";

type PoolStats = {
  priceUsd: string | null;
  marketCap: number | null;
  liquidityUsd: number | null;
  change24h: number | null;
  volume24h: number | null;
  url: string;
};

function formatUsd(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(0)}`;
  return `$${n.toFixed(2)}`;
}

function formatPct(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

async function fetchTiredPool(): Promise<PoolStats | null> {
  const res = await fetch(
    `https://api.dexscreener.com/latest/dex/pairs/${DEX_CHAIN}/${DEX_POOL_ADDRESS}`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;

  const data = (await res.json()) as {
    pair?: {
      url?: string;
      priceUsd?: string;
      marketCap?: number;
      fdv?: number;
      liquidity?: { usd?: number };
      priceChange?: { h24?: number };
      volume?: { h24?: number };
    };
    pairs?: Array<{
      url?: string;
      priceUsd?: string;
      marketCap?: number;
      fdv?: number;
      liquidity?: { usd?: number };
      priceChange?: { h24?: number };
      volume?: { h24?: number };
    }>;
  };

  const pair = data.pair ?? data.pairs?.[0];
  if (!pair) return null;

  return {
    priceUsd: pair.priceUsd ?? null,
    marketCap: pair.marketCap ?? pair.fdv ?? null,
    liquidityUsd: pair.liquidity?.usd ?? null,
    change24h: pair.priceChange?.h24 ?? null,
    volume24h: pair.volume?.h24 ?? null,
    url: pair.url ?? LINKS.chart,
  };
}

const EMBED_URL =
  `https://dexscreener.com/${DEX_CHAIN}/${DEX_POOL_ADDRESS}` +
  "?embed=1&theme=dark&trades=0&info=0";

export default function DexChart() {
  const [pool, setPool] = useState<PoolStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const next = await fetchTiredPool();
        if (!cancelled) setPool(next);
      } catch {
        if (!cancelled) setPool(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const stats = [
    {
      label: "MCAP",
      value: pool ? formatUsd(pool.marketCap) : loading ? "…" : "—",
    },
    {
      label: "LIQUIDITY",
      value: pool ? formatUsd(pool.liquidityUsd) : loading ? "…" : "—",
    },
    {
      label: "24H",
      value: pool ? formatPct(pool.change24h) : "—",
    },
  ];

  return (
    <div className="w-full">
      <div className="mb-4 grid grid-cols-3 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="neon-border rounded-lg bg-deep-purple/40 px-3 py-2 text-center"
          >
            <p className="font-mono text-[10px] text-foreground/50">
              {stat.label}
            </p>
            <p className="font-mono text-sm font-bold text-neon-green">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="dex-iframe relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-[#0a0a12]">
        <iframe
          title="$TIRED DexScreener chart"
          src={EMBED_URL}
          className="h-full w-full border-0"
          allow="clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
        />
      </div>
    </div>
  );
}
