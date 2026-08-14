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
  /** Total platform transactions recorded for this wallet. */
  txCount: number;
  /** Display label, e.g. "12 TX". */
  tx: string;
  /** @deprecated kept for older clients — same as txCount */
  pnlEth: number;
  /** @deprecated kept for older clients — same as tx */
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

function formatTxCount(n: number): string {
  return `${n} TX`;
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

let leaderboardCache: { at: number; rows: LeaderboardRow[] } | null = null;
const LEADERBOARD_CACHE_MS = 8_000;

function invalidateLeaderboardCache() {
  leaderboardCache = null;
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
    return { ok: false, error: "TX store unavailable", code: "NO_STORE" };
  }
  const txHash = input.txHash.toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(txHash)) {
    return { ok: false, error: "Invalid tx hash", code: "BAD_TX" };
  }
  const contract = input.contract.toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(contract)) {
    return { ok: false, error: "Invalid contract", code: "BAD_CONTRACT" };
  }
  const tokenId = String(input.tokenId || "").trim() || "mint";
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
    if (existing) {
      invalidateLeaderboardCache();
      return { ok: true, fill: rowToFill(existing as FillRow) };
    }
    return { ok: false, error: "Could not record snipe", code: "STORE_ERROR" };
  }
  invalidateLeaderboardCache();
  return { ok: true, fill: rowToFill(data as FillRow) };
}

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
      note: "Add Supabase tables (rpc_profiles / rpc_snipe_fills) to track platform TX.",
    };
  }

  // Count every fill — select wallet+status only so we can page past 2k if needed.
  const byWallet = new Map<
    string,
    { txCount: number; openCount: number; closedCount: number }
  >();
  const pageSize = 1000;
  for (let from = 0; from < 20_000; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("rpc_snipe_fills")
      .select("wallet, status")
      .order("bought_at", { ascending: false })
      .range(from, to);

    if (error) {
      return {
        rows: [],
        source: "error",
        note: error.message,
      };
    }
    const page = (data || []) as { wallet: string; status: "open" | "closed" }[];
    if (!page.length) break;
    for (const row of page) {
      const wallet = String(row.wallet || "").toLowerCase();
      if (!wallet) continue;
      const cur = byWallet.get(wallet) || {
        txCount: 0,
        openCount: 0,
        closedCount: 0,
      };
      cur.txCount += 1;
      if (row.status === "closed") cur.closedCount += 1;
      else cur.openCount += 1;
      byWallet.set(wallet, cur);
    }
    if (page.length < pageSize) break;
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

  const wallets = new Set<string>([...profiles.keys(), ...byWallet.keys()]);

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
        txCount: 0,
        openCount: 0,
        closedCount: 0,
      };
      const profile = profiles.get(wallet);
      const user = profile?.username || shortAddr(wallet);
      const tx = formatTxCount(stats.txCount);
      return {
        wallet,
        user,
        avatarUrl: profile?.avatarUrl || null,
        txCount: stats.txCount,
        tx,
        pnlEth: stats.txCount,
        pnl: tx,
        openCount: stats.openCount,
        closedCount: stats.closedCount,
      };
    })
    .sort((a, b) => {
      if (b.txCount !== a.txCount) return b.txCount - a.txCount;
      const aNamed = a.user.startsWith("0x") ? 1 : 0;
      const bNamed = b.user.startsWith("0x") ? 1 : 0;
      if (aNamed !== bNamed) return aNamed - bNamed;
      return a.user.localeCompare(b.user);
    })
    .slice(0, limit);

  leaderboardCache = { at: Date.now(), rows };
  return { rows, source: "live" };
}

export { hasSupabase as hasRpcPnlStore };
