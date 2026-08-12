import { NextResponse } from "next/server";
import {
  getCuratedUpcoming,
  getHoodRpcConfig,
  type HoodRpcVariant,
} from "@/lib/hood-rpc-chain";
import {
  fetchMintgoUpcoming,
  type MintgoChain,
  type MintgoRadarItem,
} from "@/lib/mintgo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MINTGO_HORIZON_MS = 7 * 24 * 60 * 60 * 1000;
const UPCOMING_LIMIT = 80;

type Upcoming = {
  id: string;
  name: string;
  mintTime: string;
  supply: string;
  price: string;
  countdown: string;
  etaSeconds: number;
  mintAtMs: number;
  logo: string;
  collectionSlug: string;
  openseaUrl: string;
};

function formatCountdown(etaSeconds: number): string {
  if (etaSeconds <= 0) return "LIVE";
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
  return d.toLocaleString("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function mintgoPrice(item: MintgoRadarItem): string {
  const n = Number(item.priceEth);
  if (!Number.isFinite(n) || n < 0) return "TBA";
  if (n === 0) return "FREE";
  return `${n.toFixed(n < 0.01 ? 4 : 3)} ETH`;
}

function mintgoSupply(item: MintgoRadarItem): string {
  const max = item.supply?.max;
  if (max == null || !Number.isFinite(Number(max))) return "—";
  return Number(max).toLocaleString();
}

function isJunkName(name: string): boolean {
  const t = name.trim();
  if (t.length < 2) return true;
  if (/^[.\-_\/\\]+$/.test(t)) return true;
  if (/^test/i.test(t) && t.length < 18) return true;
  return false;
}

function mintAtFromItem(item: MintgoRadarItem): number {
  const fromIso = Date.parse(item.startTime || "");
  if (Number.isFinite(fromIso)) return fromIso;
  const fromAt = Number(item.startAt);
  if (Number.isFinite(fromAt) && fromAt > 0) return fromAt;
  return NaN;
}

function mapMintgoItem(
  item: MintgoRadarItem,
  fallbackLogo: string,
  now: number,
): Upcoming | null {
  const name = (item.displayName || "").trim();
  const contract = (item.contractAddress || "").toLowerCase();
  if (!name || !contract || item.soldOut || isJunkName(name)) return null;
  const status = (item.status || "").toLowerCase();
  if (status && status !== "upcoming" && status !== "live") return null;

  const mintAtMs = mintAtFromItem(item);
  if (!Number.isFinite(mintAtMs)) return null;
  if (mintAtMs - now > MINTGO_HORIZON_MS) return null;

  const etaSeconds = Math.max(0, Math.floor((mintAtMs - now) / 1000));
  const live = status === "live" || etaSeconds <= 0;
  const slug =
    (item.openSeaSlug || "").trim() ||
    contract.replace(/^0x/, "").slice(0, 10);

  return {
    id: contract,
    name,
    mintTime: item.startTime ? formatMintDate(item.startTime) : "TBA",
    supply: mintgoSupply(item),
    price: mintgoPrice(item),
    countdown: live ? "LIVE" : formatCountdown(etaSeconds),
    etaSeconds: live ? 0 : etaSeconds,
    mintAtMs,
    logo: item.imageUrl || fallbackLogo,
    collectionSlug: slug,
    openseaUrl:
      item.openseaUrl ||
      (item.openSeaSlug
        ? `https://opensea.io/collection/${item.openSeaSlug}`
        : `https://mintgo.fun/`),
  };
}

function sortUpcoming(rows: Upcoming[], now: number): Upcoming[] {
  return [...rows].sort((a, b) => {
    const aLive = a.mintAtMs <= now;
    const bLive = b.mintAtMs <= now;
    if (aLive !== bLive) return aLive ? -1 : 1;
    if (aLive && bLive) return b.mintAtMs - a.mintAtMs;
    return a.mintAtMs - b.mintAtMs;
  });
}

export async function handleUpcoming(variant: HoodRpcVariant) {
  const { isAccessDenied, requireAccessKey } = await import(
    "@/lib/require-access"
  );
  const access = await requireAccessKey();
  if (isAccessDenied(access)) return access;

  const cfg = getHoodRpcConfig(variant);
  const chain: MintgoChain = variant === "eth" ? "ethereum" : "robinhood";
  const curated = getCuratedUpcoming(variant);
  const now = Date.now();
  const rows: Upcoming[] = [];
  const seen = new Set<string>();
  let source = "schedule";

  try {
    const items = await fetchMintgoUpcoming(chain);
    for (const item of items) {
      const row = mapMintgoItem(item, cfg.defaultTokenLogo, now);
      if (!row || seen.has(row.id)) continue;
      seen.add(row.id);
      rows.push(row);
    }
    if (rows.length) source = "mintgo";
  } catch {
    /* curated fallback below */
  }

  for (const drop of curated) {
    if (seen.has(drop.id) || seen.has(drop.collectionSlug)) continue;
    const mintAtMs = new Date(drop.mintAt).getTime();
    if (!Number.isFinite(mintAtMs)) continue;
    if (mintAtMs - now > MINTGO_HORIZON_MS) continue;
    const etaSeconds = Math.floor((mintAtMs - now) / 1000);
    if (etaSeconds <= 0) continue;

    seen.add(drop.id);
    rows.push({
      id: drop.id,
      name: drop.name,
      mintTime: formatMintDate(drop.mintAt),
      supply: drop.supply,
      price: drop.price,
      countdown: formatCountdown(etaSeconds),
      etaSeconds,
      mintAtMs,
      logo: drop.logo,
      collectionSlug: drop.collectionSlug,
      openseaUrl: drop.openseaUrl,
    });
  }

  const sorted = sortUpcoming(rows, now);

  return NextResponse.json({
    source,
    chain,
    updatedAt: new Date().toISOString(),
    nfts: sorted.slice(0, UPCOMING_LIMIT),
  });
}
