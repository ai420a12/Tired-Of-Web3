/** OpenSea rank tier bands — parity with ai420 ETH sniper dashboard. */

export type RarityTier =
  | "t10"
  | "t50"
  | "t250"
  | "t500"
  | "t1k"
  | "default";

export const RARITY_LEGEND: {
  tier: RarityTier;
  range: string;
  title: string;
}[] = [
  { tier: "t10", range: "1–10", title: "OpenSea rank 1–10" },
  { tier: "t50", range: "11–50", title: "OpenSea rank 11–50" },
  { tier: "t250", range: "51–250", title: "OpenSea rank 51–250" },
  { tier: "t500", range: "251–500", title: "OpenSea rank 251–500" },
  { tier: "t1k", range: "501–1000", title: "OpenSea rank 501–1000" },
  {
    tier: "default",
    range: "1001+",
    title: "Rank 1001+, or OpenSea has not returned a rank yet",
  },
];

export function rarityTierFromRank(
  rank: number | null | undefined,
): RarityTier {
  const n =
    typeof rank === "number"
      ? rank
      : parseInt(String(rank ?? "").trim(), 10);
  if (!Number.isFinite(n) || n < 1) return "default";
  if (n <= 10) return "t10";
  if (n <= 50) return "t50";
  if (n <= 250) return "t250";
  if (n <= 500) return "t500";
  if (n <= 1000) return "t1k";
  return "default";
}

export function rarityRowClass(rank: number | null | undefined): string {
  return `hrpc-rarity-tier-${rarityTierFromRank(rank)}`;
}

export function parseOpenSeaRarityRank(
  nft: Record<string, unknown> | null | undefined,
): number | null {
  if (!nft) return null;
  const coerce = (v: unknown): number | null => {
    const n = typeof v === "number" ? v : parseInt(String(v ?? "").trim(), 10);
    return Number.isFinite(n) && n >= 1 ? n : null;
  };

  const r = nft.rarity;
  if (Array.isArray(r)) {
    let best: number | null = null;
    for (const block of r) {
      if (!block || typeof block !== "object") continue;
      const obj = block as Record<string, unknown>;
      for (const k of [
        "rank",
        "token_rank",
        "rarity_rank",
        "calculated_rank",
        "opensea_rank",
      ]) {
        const n = coerce(obj[k]);
        if (n != null && (best == null || n < best)) best = n;
      }
    }
    if (best != null) return best;
  }
  if (r && typeof r === "object" && !Array.isArray(r)) {
    const obj = r as Record<string, unknown>;
    for (const k of [
      "rank",
      "token_rank",
      "rarity_rank",
      "calculated_rank",
      "opensea_rank",
    ]) {
      const n = coerce(obj[k]);
      if (n != null) return n;
    }
  }
  for (const k of ["rarity_rank", "rank", "token_rank"]) {
    const n = coerce(nft[k]);
    if (n != null) return n;
  }
  return null;
}
