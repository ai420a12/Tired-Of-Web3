"use client";

import { useEffect, useState } from "react";
import { CONTRACT_ADDRESS, DEX_CHAIN, LINKS } from "@/lib/constants";

type PairStats = {
  chainId: string;
  pairAddress: string;
  priceUsd: string | null;
  marketCap: number | null;
  liquidityUsd: number | null;
  change24h: number | null;
  url: string;
};

function formatUsd(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function formatPct(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

async function fetchTiredPair(): Promise<PairStats | null> {
  const res = await fetch(
    `https://api.dexscreener.com/latest/dex/tokens/${CONTRACT_ADDRESS}`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    pairs?: Array<{
      chainId?: string;
      pairAddress?: string;
      url?: string;
      priceUsd?: string;
      marketCap?: number;
      fdv?: number;
      liquidity?: { usd?: number };
      priceChange?: { h24?: number };
    }>;
  };

  const pairs = data.pairs ?? [];
  const preferred =
    pairs.find((p) => p.chainId === DEX_CHAIN) ??
    pairs.sort(
      (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0),
    )[0];

  if (!preferred?.pairAddress) return null;

  return {
    chainId: preferred.chainId ?? DEX_CHAIN,
    pairAddress: preferred.pairAddress,
    priceUsd: preferred.priceUsd ?? null,
    marketCap: preferred.marketCap ?? preferred.fdv ?? null,
    liquidityUsd: preferred.liquidity?.usd ?? null,
    change24h: preferred.priceChange?.h24 ?? null,
    url:
      preferred.url ??
      `https://dexscreener.com/${preferred.chainId ?? DEX_CHAIN}/${preferred.pairAddress}`,
  };
}

export default function DexChart() {
  const [pair, setPair] = useState<PairStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const next = await fetchTiredPair();
        if (!cancelled) setPair(next);
      } catch {
        if (!cancelled) setPair(null);
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

  const embedUrl = pair
    ? `https://dexscreener.com/${pair.chainId}/${pair.pairAddress}?embed=1&theme=dark&trades=0&info=0`
    : null;

  const stats = [
    {
      label: "MCAP",
      value: pair ? formatUsd(pair.marketCap) : loading ? "…" : "SOON",
    },
    {
      label: "LIQUIDITY",
      value: pair ? formatUsd(pair.liquidityUsd) : loading ? "…" : "SOON",
    },
    {
      label: "24H",
      value: pair ? formatPct(pair.change24h) : "—",
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

      {embedUrl ? (
        <div className="dex-iframe relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-[#0a0a12]">
          <iframe
            title="$TIRED DexScreener chart"
            src={embedUrl}
            className="h-full w-full border-0"
            allow="clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="dex-iframe chart-placeholder relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-[#0a0a12]">
          <div className="chart-placeholder-grid absolute inset-0" aria-hidden="true" />
          <div className="chart-placeholder-content relative z-10 items-center justify-center gap-4 text-center">
            <p className="font-mono text-sm text-neon-green neon-green-glow sm:text-base">
              $TIRED is live — chart indexing on DexScreener…
            </p>
            <p className="max-w-md font-mono text-xs text-foreground/50">
              Buy is live on Pons. Chart embeds automatically once the Robinhood
              pair is indexed.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <a
                href={LINKS.buy}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-neon-green px-4 py-2 font-mono text-xs font-bold text-neon-green hover:bg-neon-green/10"
              >
                BUY $TIRED
              </a>
              <a
                href={LINKS.dexscreener}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-neon-pink/60 px-4 py-2 font-mono text-xs font-bold text-neon-pink hover:bg-neon-pink/10"
              >
                OPEN DEXSCREENER
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
