import { NextResponse } from "next/server";
import {
  HOOD_HRPC_DROP_AT,
  HOOD_NFT_DROP_AT,
  HOOD_PLATFORM_LIVE_AT,
  HOOD_RPC_LINKS,
} from "@/components/hood-rpc/hood-wl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Upcoming = {
  id: string;
  name: string;
  mintTime: string;
  supply: string;
  price: string;
  countdown: string;
  etaSeconds: number;
  logo: string;
  collectionSlug: string;
  openseaUrl: string;
};

type DropStage = {
  label?: string;
  price?: string;
  start_time?: string;
  end_time?: string;
  max_per_wallet?: string;
};

type OsDrop = {
  collection_slug?: string;
  collection_name?: string;
  chain?: string;
  is_minting?: boolean;
  image_url?: string;
  opensea_url?: string;
  active_stage?: DropStage | null;
  next_stage?: DropStage | null;
};

/** Curated upcoming Robinhood / HOOD_RPC mints — dates only, not live traded collections. */
const CURATED_UPCOMING: {
  id: string;
  name: string;
  mintAt: string;
  supply: string;
  price: string;
  logo: string;
  collectionSlug: string;
  openseaUrl: string;
}[] = [
  {
    id: "hood-rpc",
    name: "HOOD_RPC Genesis",
    mintAt: HOOD_NFT_DROP_AT.toISOString(),
    supply: "3333",
    price: "TBA",
    logo: "/images/hood-rpc/mascot-lime.png",
    collectionSlug: "hood-rpc",
    openseaUrl: HOOD_RPC_LINKS.opensea,
  },
  {
    id: "hood-hrpc",
    name: "$HRPC Token",
    mintAt: HOOD_HRPC_DROP_AT.toISOString(),
    supply: "—",
    price: "TBA",
    logo: "/images/hood-rpc/tokens/rh.png",
    collectionSlug: "hrpc",
    openseaUrl: HOOD_RPC_LINKS.x,
  },
  {
    id: "hood-platform",
    name: "HOOD_RPC Platform Live",
    mintAt: HOOD_PLATFORM_LIVE_AT.toISOString(),
    supply: "—",
    price: "—",
    logo: "/images/hood-rpc/mascot-lime.png",
    collectionSlug: "hood-rpc-live",
    openseaUrl: HOOD_RPC_LINKS.home,
  },
];

function formatCountdown(etaSeconds: number): string {
  const h = Math.floor(etaSeconds / 3600);
  const m = Math.floor((etaSeconds % 3600) / 60);
  const s = etaSeconds % 60;
  if (h >= 48) {
    const d = Math.floor(h / 24);
    return `${d}d ${String(h % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatMintDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "TBA";
  // Compact so columns don't collide
  return d.toLocaleString("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function stagePrice(stage: DropStage | null | undefined): string {
  if (!stage?.price) return "TBA";
  const raw = Number(stage.price);
  if (!Number.isFinite(raw) || raw < 0) return "TBA";
  if (raw === 0) return "FREE";
  const eth = raw > 1e9 ? raw / 1e18 : raw;
  return `${eth.toFixed(eth < 0.01 ? 4 : 3)} ETH`;
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

/** Only future mint starts — skip already-live minting windows. */
function pickStage(
  drop: OsDrop,
  nowMs: number,
): { stage: DropStage; targetIso: string } | null {
  const next = drop.next_stage;
  if (next?.start_time) {
    const start = new Date(next.start_time).getTime();
    if (Number.isFinite(start) && start > nowMs) {
      return { stage: next, targetIso: next.start_time };
    }
  }

  const active = drop.active_stage;
  if (active?.start_time) {
    const start = new Date(active.start_time).getTime();
    // Upcoming only: stage has not started yet
    if (Number.isFinite(start) && start > nowMs) {
      return { stage: active, targetIso: active.start_time };
    }
  }

  return null;
}

export async function GET() {
  const now = Date.now();
  const rows: Upcoming[] = [];
  const seen = new Set<string>();

  // 1) Live OpenSea Drop schedules on Robinhood Chain only
  if (process.env.OPENSEA_API_KEY) {
    try {
      const data = await osFetch("/drops?chains=robinhood&limit=50");
      const drops = (data?.drops || []) as OsDrop[];

      await Promise.all(
        drops.map(async (drop) => {
          const slug = drop.collection_slug || "";
          if (!slug || seen.has(slug)) return;
          const picked = pickStage(drop, now);
          if (!picked) return;

          const targetMs = new Date(picked.targetIso).getTime();
          const etaSeconds = Math.max(0, Math.floor((targetMs - now) / 1000));
          if (etaSeconds <= 0) return;

          let supply = "—";
          const meta = await osFetch(`/collections/${slug}`);
          if (meta?.total_supply != null) supply = String(meta.total_supply);

          seen.add(slug);
          rows.push({
            id: slug,
            name: drop.collection_name || slug,
            mintTime: formatMintDate(picked.targetIso),
            supply,
            price: stagePrice(picked.stage),
            countdown: formatCountdown(etaSeconds),
            etaSeconds,
            logo:
              drop.image_url ||
              meta?.image_url ||
              "/images/hood-rpc/nfts/robinhood-punks.png",
            collectionSlug: slug,
            openseaUrl:
              drop.opensea_url ||
              meta?.opensea_url ||
              `https://opensea.io/collection/${slug}`,
          });
        }),
      );
    } catch {
      /* curated fallback below */
    }
  }

  // 2) Curated future mints / platform dates (never live traded collections)
  for (const drop of CURATED_UPCOMING) {
    if (seen.has(drop.id)) continue;
    const mintMs = new Date(drop.mintAt).getTime();
    if (!Number.isFinite(mintMs)) continue;
    const etaSeconds = Math.floor((mintMs - now) / 1000);
    if (etaSeconds <= 0) continue; // past — hide

    seen.add(drop.id);
    rows.push({
      id: drop.id,
      name: drop.name,
      mintTime: formatMintDate(drop.mintAt),
      supply: drop.supply,
      price: drop.price,
      countdown: formatCountdown(etaSeconds),
      etaSeconds,
      logo: drop.logo,
      collectionSlug: drop.collectionSlug,
      openseaUrl: drop.openseaUrl,
    });
  }

  rows.sort((a, b) => a.etaSeconds - b.etaSeconds);

  return NextResponse.json({
    source: process.env.OPENSEA_API_KEY
      ? "opensea-drops+schedule"
      : "schedule",
    updatedAt: new Date().toISOString(),
    nfts: rows.slice(0, 12),
  });
}
