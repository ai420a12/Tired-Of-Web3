import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  listAllProfiles,
  listProfilesByWallets,
} from "@/lib/rpc-profile-store";

export type SnipeFill = {
  id: string;
  wallet: string;
  txHash: string;
  contract: string;
  tokenId: string;
  collectionSlug: string | null;
  tokenName: string | null;
  costEth: number;
  boughtAt: string;
  status: "open" | "closed";
  exitEth: number | null;
  closedAt: string | null;
};

export type LeaderboardRow = {
  wallet: string;
  user: string;
  avatarUrl: string | null;
  pnlEth: number;
  pnl: string;
  openCount: number;
  closedCount: number;
};

type FillRow = {
  id: string;
  wallet: string;
  tx_hash: string;
  contract: string;
  token_id: string;
  collection_slug: string | null;
  token_name: string | null;
  cost_eth: number | string;
  bought_at: string;
  status: "open" | "closed";
  exit_eth: number | string | null;
  closed_at: string | null;
};

function hasSupabase() {
  return Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

function getSupabase(): SupabaseClient | null {
  if (!hasSupabase()) return null;
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
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

function openseaKeys(): string[] {
  const multi = (process.env.OPENSEA_API_KEYS || "")
    .split(/[\s,]+/)
    .map((k) => k.trim())
    .filter(Boolean);
  const single = (process.env.OPENSEA_API_KEY || "").trim();
  return [...new Set([...multi, ...(single ? [single] : [])])];
}

function rowToFill(row: FillRow): SnipeFill {
  return {
    id: row.id,
    wallet: row.wallet.toLowerCase(),
    txHash: row.tx_hash.toLowerCase(),
    contract: row.contract.toLowerCase(),
    tokenId: String(row.token_id),
    collectionSlug: row.collection_slug,
    tokenName: row.token_name,
    costEth: Number(row.cost_eth) || 0,
    boughtAt: row.bought_at,
    status: row.status,
    exitEth: row.exit_eth == null ? null : Number(row.exit_eth),
    closedAt: row.closed_at,
  };
}

function formatPnl(eth: number): string {
  const sign = eth >= 0 ? "+" : "";
  return `${sign}${eth.toFixed(3)} ETH`;
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
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
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function recordSnipeFill(input: {
  wallet: string;
  txHash: string;
  contract: string;
  tokenId: string;
  costEth: number;
  collectionSlug?: string;
  tokenName?: string;
}): Promise<
  | { ok: true; fill: SnipeFill }
  | { ok: false; error: string; code?: string }
> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, error: "PnL store unavailable", code: "NO_STORE" };
  }
  const txHash = input.txHash.toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(txHash)) {
    return { ok: false, error: "Invalid tx hash", code: "BAD_TX" };
  }
  const contract = input.contract.toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(contract)) {
    return { ok: false, error: "Invalid contract", code: "BAD_CONTRACT" };
  }
  const tokenId = String(input.tokenId || "").trim();
  if (!tokenId) {
    return { ok: false, error: "Missing token id", code: "BAD_TOKEN" };
  }
  const costEth = Number(input.costEth);
  if (!Number.isFinite(costEth) || costEth < 0) {
    return { ok: false, error: "Invalid cost", code: "BAD_COST" };
  }

  const { data, error } = await supabase
    .from("rpc_snipe_fills")
    .upsert(
      {
        wallet: input.wallet.toLowerCase(),
        tx_hash: txHash,
        contract,
        token_id: tokenId,
        collection_slug: input.collectionSlug || null,
        token_name: input.tokenName || null,
        cost_eth: costEth,
        status: "open",
      },
      { onConflict: "tx_hash", ignoreDuplicates: true },
    )
    .select(
      "id, wallet, tx_hash, contract, token_id, collection_slug, token_name, cost_eth, bought_at, status, exit_eth, closed_at",
    )
    .maybeSingle();

  if (error) {
    // Unique race — fetch existing
    const { data: existing } = await supabase
      .from("rpc_snipe_fills")
      .select(
        "id, wallet, tx_hash, contract, token_id, collection_slug, token_name, cost_eth, bought_at, status, exit_eth, closed_at",
      )
      .eq("tx_hash", txHash)
      .maybeSingle();
    if (existing) {
      return { ok: true, fill: rowToFill(existing as FillRow) };
    }
    return {
      ok: false,
      error: error.message || "Could not record snipe",
      code: "STORE_ERROR",
    };
  }
  if (!data) {
    const { data: existing } = await supabase
      .from("rpc_snipe_fills")
      .select(
        "id, wallet, tx_hash, contract, token_id, collection_slug, token_name, cost_eth, bought_at, status, exit_eth, closed_at",
      )
      .eq("tx_hash", txHash)
      .maybeSingle();
    if (existing) return { ok: true, fill: rowToFill(existing as FillRow) };
    return { ok: false, error: "Could not record snipe", code: "STORE_ERROR" };
  }
  return { ok: true, fill: rowToFill(data as FillRow) };
}

async function isStillOwner(
  contract: string,
  tokenId: string,
  wallet: string,
): Promise<boolean | null> {
  const key = alchemyKey();
  if (!key) return null;
  const data = (await fetchJson(
    `https://eth-mainnet.g.alchemy.com/nft/v3/${key}/getOwnersForNFT?contractAddress=${contract}&tokenId=${encodeURIComponent(tokenId)}`,
  )) as { owners?: string[] } | null;
  if (!data?.owners) return null;
  const want = wallet.toLowerCase();
  return data.owners.some((o) => o.toLowerCase() === want);
}

async function findExitSaleEth(
  contract: string,
  tokenId: string,
  seller: string,
  boughtAtIso: string,
): Promise<number | null> {
  const key = alchemyKey();
  if (!key) return null;
  const boughtMs = Date.parse(boughtAtIso) || 0;
  const data = (await fetchJson(
    `https://eth-mainnet.g.alchemy.com/nft/v3/${key}/getNFTSales?contractAddress=${contract}&tokenId=${encodeURIComponent(tokenId)}&order=desc&limit=20`,
  )) as {
    nftSales?: {
      sellerAddress?: string;
      blockTimestamp?: string;
      sellerFee?: { amount?: string; decimals?: number };
    }[];
  } | null;

  for (const sale of data?.nftSales || []) {
    if ((sale.sellerAddress || "").toLowerCase() !== seller.toLowerCase()) {
      continue;
    }
    const ts = sale.blockTimestamp
      ? Date.parse(sale.blockTimestamp)
      : 0;
    if (boughtMs && ts && ts < boughtMs - 60_000) continue;
    const raw = Number(sale.sellerFee?.amount || 0);
    const decimals = Number(sale.sellerFee?.decimals ?? 18);
    if (!(raw > 0)) continue;
    return raw / 10 ** decimals;
  }
  return null;
}

async function bestListingEth(
  contract: string,
  tokenId: string,
): Promise<number | null> {
  const keys = openseaKeys();
  if (!keys.length) return null;
  for (const key of keys) {
    const res = await fetch(
      `https://api.opensea.io/api/v2/orders/ethereum/seaport/listings?asset_contract_address=${contract}&token_ids=${encodeURIComponent(tokenId)}&limit=1&order_by=eth_price&order_direction=asc`,
      {
        headers: {
          accept: "application/json",
          "x-api-key": key,
        },
        cache: "no-store",
      },
    ).catch(() => null);
    if (!res || res.status === 429 || res.status === 503) continue;
    if (!res.ok) return null;
    const data = (await res.json()) as {
      orders?: {
        current_price?: string;
        price?: { current?: { value?: string; decimals?: number } };
      }[];
    };
    const order = data.orders?.[0];
    if (!order) return null;
    const valueStr =
      order.current_price ||
      order.price?.current?.value ||
      "";
    const value = Number(valueStr);
    if (!Number.isFinite(value) || value <= 0) return null;
    // OpenSea current_price is usually wei
    if (value > 1e9) return value / 1e18;
    return value;
  }
  return null;
}

async function closeFill(
  id: string,
  exitEth: number,
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase
    .from("rpc_snipe_fills")
    .update({
      status: "closed",
      exit_eth: exitEth,
      closed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "open");
}

let leaderboardCache: { at: number; rows: LeaderboardRow[] } | null = null;
const LEADERBOARD_CACHE_MS = 45_000;

export async function getLeaderboard(
  limit = 20,
): Promise<{ rows: LeaderboardRow[]; source: string; note?: string }> {
  if (
    leaderboardCache &&
    Date.now() - leaderboardCache.at < LEADERBOARD_CACHE_MS
  ) {
    return { rows: leaderboardCache.rows, source: "cache" };
  }

  const supabase = getSupabase();
  if (!supabase) {
    return {
      rows: [],
      source: "missing_store",
      note: "Add Supabase tables (rpc_profiles / rpc_snipe_fills) to track PnL.",
    };
  }

  const { data, error } = await supabase
    .from("rpc_snipe_fills")
    .select(
      "id, wallet, tx_hash, contract, token_id, collection_slug, token_name, cost_eth, bought_at, status, exit_eth, closed_at",
    )
    .order("bought_at", { ascending: false })
    .limit(500);

  if (error) {
    return {
      rows: [],
      source: "error",
      note: error.message,
    };
  }

  const fills = ((data || []) as FillRow[]).map(rowToFill);

  // Refresh open fills: ownership + exit detection + MTM
  const open = fills.filter((f) => f.status === "open").slice(0, 40);
  const marks = new Map<string, number>();

  for (const fill of open) {
    const owned = await isStillOwner(fill.contract, fill.tokenId, fill.wallet);
    if (owned === false) {
      const exit =
        (await findExitSaleEth(
          fill.contract,
          fill.tokenId,
          fill.wallet,
          fill.boughtAt,
        )) ?? 0;
      await closeFill(fill.id, exit);
      fill.status = "closed";
      fill.exitEth = exit;
      continue;
    }
    const mark = await bestListingEth(fill.contract, fill.tokenId);
    if (mark != null) marks.set(fill.id, mark);
  }

  const byWallet = new Map<
    string,
    { pnl: number; openCount: number; closedCount: number }
  >();

  for (const fill of fills) {
    const cur = byWallet.get(fill.wallet) || {
      pnl: 0,
      openCount: 0,
      closedCount: 0,
    };
    if (fill.status === "closed") {
      cur.pnl += (fill.exitEth ?? 0) - fill.costEth;
      cur.closedCount += 1;
    } else {
      const mark = marks.get(fill.id);
      if (mark != null) cur.pnl += mark - fill.costEth;
      cur.openCount += 1;
    }
    byWallet.set(fill.wallet, cur);
  }

  const registered = await listAllProfiles(Math.max(limit, 200));
  const extra = await listProfilesByWallets(
    [...byWallet.keys()].filter(
      (w) => !registered.some((p) => p.wallet === w),
    ),
  );
  const profiles = new Map<string, (typeof registered)[number]>();
  for (const p of registered) profiles.set(p.wallet, p);
  for (const [w, p] of extra) profiles.set(w, p);

  const wallets = new Set<string>([
    ...profiles.keys(),
    ...byWallet.keys(),
  ]);

  if (!wallets.size) {
    leaderboardCache = { at: Date.now(), rows: [] };
    return {
      rows: [],
      source: "empty",
      note: "No registered wallets yet.",
    };
  }

  const rows: LeaderboardRow[] = [...wallets]
    .map((wallet) => {
      const stats = byWallet.get(wallet) || {
        pnl: 0,
        openCount: 0,
        closedCount: 0,
      };
      const profile = profiles.get(wallet);
      const user = profile?.username || shortAddr(wallet);
      return {
        wallet,
        user,
        avatarUrl: profile?.avatarUrl || null,
        pnlEth: stats.pnl,
        pnl: formatPnl(stats.pnl),
        openCount: stats.openCount,
        closedCount: stats.closedCount,
      };
    })
    .sort((a, b) => {
      if (b.pnlEth !== a.pnlEth) return b.pnlEth - a.pnlEth;
      return a.user.localeCompare(b.user);
    })
    .slice(0, limit);

  leaderboardCache = { at: Date.now(), rows };
  return { rows, source: "live" };
}

export { hasSupabase as hasRpcPnlStore };
