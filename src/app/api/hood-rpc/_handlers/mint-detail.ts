import { NextResponse } from "next/server";
import type { HoodRpcVariant } from "@/lib/hood-rpc-chain";
import {
  fetchMintgoCollection,
  type MintgoChain,
  type MintgoMintAnalysis,
} from "@/lib/mintgo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type MintPhase = {
  id: string;
  label: string;
  stageType: string;
  priceWei: string;
  priceEth: number;
  startAt: number;
  endAt: number;
  maxPerWallet: number;
  status: "live" | "upcoming" | "ended";
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function phaseStatus(startAt: number, endAt: number, now: number): MintPhase["status"] {
  if (endAt && now >= endAt) return "ended";
  if (startAt && now < startAt) return "upcoming";
  return "live";
}

function weiToEth(wei: string): number {
  try {
    const n = Number(BigInt(wei || "0")) / 1e18;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function sameMintChain(dropChain: string, chain: MintgoChain): boolean {
  const d = dropChain.toLowerCase().trim();
  if (!d) return true;
  if (chain === "ethereum") {
    return d === "ethereum" || d === "eth" || d === "mainnet";
  }
  return d === "robinhood" || d === "hood" || d === "rh" || d === "hoodchain";
}

async function fetchOpenSeaDrop(
  slug: string,
  chain: MintgoChain,
): Promise<{ phases: MintPhase[]; contract: string; name: string }> {
  const empty = { phases: [] as MintPhase[], contract: "", name: "" };
  if (!slug) return empty;
  const data = await osJson(`/drops/${encodeURIComponent(slug)}`);
  if (!data) return empty;
  const dropChain = String(data.chain || "");
  if (!sameMintChain(dropChain, chain)) return empty;
  const now = Date.now();
  const stagesRaw = Array.isArray(data.stages)
    ? data.stages
    : Array.isArray(asRecord(data.drop).stages)
      ? asRecord(data.drop).stages
      : [];
  const stages = Array.isArray(stagesRaw)
    ? (stagesRaw as {
        uuid?: string;
        stage_type?: string;
        label?: string;
        name?: string;
        price?: string;
        start_time?: string;
        end_time?: string;
        max_per_wallet?: string | number;
      }[])
    : [];
  const phases = stages
    .map((stage, i) => {
      const startAt = Date.parse(stage.start_time || "") || 0;
      const endAt = Date.parse(stage.end_time || "") || 0;
      const priceWei = String(stage.price || "0");
      const label = (
        stage.label ||
        stage.name ||
        stage.stage_type ||
        `Phase ${i + 1}`
      ).trim();
      return {
        id: String(stage.uuid || `${stage.stage_type || "stage"}-${i}`),
        label,
        stageType: String(stage.stage_type || ""),
        priceWei,
        priceEth: weiToEth(priceWei),
        startAt,
        endAt,
        maxPerWallet: Math.max(0, Number(stage.max_per_wallet || 0)),
        status: phaseStatus(startAt, endAt, now),
      } satisfies MintPhase;
    })
    .sort((a, b) => {
      const order = { live: 0, upcoming: 1, ended: 2 };
      if (order[a.status] !== order[b.status]) {
        return order[a.status] - order[b.status];
      }
      return (a.startAt || 0) - (b.startAt || 0);
    });
  return {
    phases,
    contract: extractAddress(
      String(data.contract || data.contract_address || ""),
    ),
    name: String(data.name || ""),
  };
}

function extractAddress(raw: string): string {
  const m = raw.toLowerCase().match(/0x[a-f0-9]{40}/);
  return m ? m[0] : "";
}

function extractOpenSeaSlug(raw: string): string {
  const text = raw.trim();
  const fromUrl = text.match(
    /opensea\.io\/collection\/([a-z0-9_-]+)/i,
  );
  if (fromUrl?.[1]) return fromUrl[1];
  if (/^[a-z0-9-]{2,80}$/i.test(text) && !text.startsWith("0x")) return text;
  return "";
}

function osHeaders(): Record<string, string> {
  const keys = [
    (process.env.OPENSEA_API_KEY || "").trim(),
    ...(process.env.OPENSEA_API_KEYS || "")
      .split(/[\s,]+/)
      .map((k) => k.trim()),
  ].filter(Boolean);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (keys[0]) headers["X-API-KEY"] = keys[0];
  return headers;
}

async function osJson(path: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`https://api.opensea.io/api/v2${path}`, {
    headers: osHeaders(),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return data && typeof data === "object" ? (data as Record<string, unknown>) : null;
}

async function resolveOpenSeaContract(
  slug: string,
  chain: MintgoChain,
): Promise<string> {
  const data = await osJson(`/collections/${encodeURIComponent(slug)}`);
  if (!data) return "";
  const contracts = Array.isArray(data.contracts)
    ? (data.contracts as { address?: string; chain?: string }[])
    : Array.isArray((data.collection as { contracts?: unknown } | undefined)?.contracts)
      ? ((data.collection as { contracts: { address?: string; chain?: string }[] }).contracts)
      : Array.isArray(data.primary_asset_contracts)
        ? (data.primary_asset_contracts as { address?: string; chain?: string }[])
        : [];
  const want = chain === "ethereum" ? "ethereum" : "robinhood";
  const match =
    contracts.find((c) => String(c.chain || "").toLowerCase() === want) ||
    contracts[0];
  return extractAddress(String(match?.address || ""));
}

async function slugFromContract(
  chain: MintgoChain,
  contract: string,
): Promise<string> {
  const aliases =
    chain === "ethereum" ? ["ethereum"] : ["robinhood", "hood"];
  for (const alias of aliases) {
    const data = await osJson(
      `/chain/${alias}/contract/${contract}/nfts?limit=1`,
    );
    const nfts = Array.isArray(data?.nfts) ? data.nfts : [];
    const first = asRecord(nfts[0]);
    const col = first.collection;
    const slug =
      typeof col === "string"
        ? col.trim()
        : String(asRecord(col).slug || asRecord(col).collection || "").trim();
    if (slug) return slug;
  }
  return "";
}

export async function handleMintDetail(
  req: Request,
  variant: HoodRpcVariant,
) {
  const { isAccessDenied, requireAccessKey } = await import(
    "@/lib/require-access"
  );
  const access = await requireAccessKey(req);
  if (isAccessDenied(access)) return access;

  const url = new URL(req.url);
  const rawChain = url.searchParams.get("chain");
  const chain: MintgoChain =
    rawChain === "ethereum" || rawChain === "robinhood"
      ? rawChain
      : variant === "eth"
        ? "ethereum"
        : "robinhood";
  const q =
    url.searchParams.get("q") ||
    url.searchParams.get("slug") ||
    url.searchParams.get("contract") ||
    "";
  const slugFromQ = extractOpenSeaSlug(q);
  let contract = extractAddress(url.searchParams.get("contract") || q);
  if (!contract && slugFromQ) {
    contract = await resolveOpenSeaContract(slugFromQ, chain);
  }
  if (!contract && !slugFromQ) {
    return NextResponse.json({ error: "Invalid contract" }, { status: 400 });
  }

  let name = "";
  let image = "";
  let slug = slugFromQ;
  let openseaUrl = slug ? `https://opensea.io/collection/${slug}` : "";
  let minted = 0;
  let max = 0;
  let floor = 0;
  let holders = 0;
  let priceLabel = "";
  let analysis: Record<string, unknown> | null = null;

  if (contract) {
    try {
      const raw = await fetchMintgoCollection(chain, contract);
      const mintAnalysis = asRecord(raw.mintAnalysis) as MintgoMintAnalysis;
      const mintAction = asRecord(raw.mintAction);
      name = String(raw.name || raw.collection || name);
      image = String(raw.image || image);
      slug = slug || String(raw.openSeaSlug || "");
      openseaUrl = String(raw.openSeaUrl || openseaUrl);
      minted = Number(raw.mintedSupply || 0);
      max = Number(raw.maxSupply || 0);
      floor = Number(raw.floorPriceEth || 0);
      holders = Number(raw.holderCount || 0);
      priceLabel = String(mintAction.displayUnitPrice || "");
      analysis = {
        ready: Boolean(mintAnalysis.ready),
        reason: String(mintAnalysis.reason || ""),
        mode: String(mintAnalysis.mode || ""),
        maxPerWallet: Number(mintAnalysis.maxPerWallet || 0),
        maxBatch: Number(mintAnalysis.maxBatch || 0),
        unitPriceWei: String(mintAnalysis.unitPriceWei || "0"),
        unitPriceEth: Number(mintAnalysis.unitPriceEth || 0),
        functionLabel: String(mintAnalysis.functionLabel || ""),
        mintTarget: String(mintAnalysis.mintTarget || ""),
        requiresHelper: Boolean(mintAnalysis.requiresHelper),
        helperConfigured: Boolean(mintAnalysis.helperConfigured),
        nativeSymbol: String(mintAnalysis.nativeSymbol || "ETH"),
        serviceFeePerMintWei: String(mintAnalysis.serviceFeePerMintWei || "0"),
      };
    } catch {
      /* OpenSea drop stages are enough to load a target */
    }
  }

  if (!slug && contract) {
    slug = await slugFromContract(chain, contract).catch(() => "");
    if (slug && !openseaUrl) openseaUrl = `https://opensea.io/collection/${slug}`;
  }
  if (!contract && slug) {
    contract = await resolveOpenSeaContract(slug, chain);
  }
  if (!name && slug) {
    const col = await osJson(`/collections/${encodeURIComponent(slug)}`);
    if (col) {
      name = String(col.name || asRecord(col.collection).name || "");
    }
  }

  const drop = slug
    ? await fetchOpenSeaDrop(slug, chain).catch(() => ({
        phases: [] as MintPhase[],
        contract: "",
        name: "",
      }))
    : { phases: [] as MintPhase[], contract: "", name: "" };
  if (!contract && drop.contract) contract = drop.contract;
  if (!name && drop.name) name = drop.name;
  let phases = drop.phases;
  if (!phases.length && analysis && analysis.ready) {
    const priceWei = String(analysis.unitPriceWei || "0");
    phases = [
      {
        id: "current",
        label: String(analysis.functionLabel || "Current mint"),
        stageType: String(analysis.mode || "current"),
        priceWei,
        priceEth: Number(analysis.unitPriceEth || weiToEth(priceWei)),
        startAt: 0,
        endAt: 0,
        maxPerWallet: Number(analysis.maxPerWallet || 0),
        status: "live",
      },
    ];
  }

  if (!/^0x[a-f0-9]{40}$/.test(contract)) {
    return NextResponse.json({ error: "Invalid contract" }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    chain,
    contract,
    name,
    image,
    slug,
    openseaUrl,
    minted,
    max,
    floor,
    holders,
    priceLabel,
    phases,
    analysis,
  });
}
