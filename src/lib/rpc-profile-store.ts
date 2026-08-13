import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type RpcProfile = {
  wallet: string;
  username: string | null;
  avatarUrl: string | null;
  updatedAt: string;
};

type ProfileRow = {
  wallet: string;
  username: string | null;
  avatar_url: string | null;
  updated_at: string;
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

function rowToProfile(row: ProfileRow): RpcProfile {
  return {
    wallet: row.wallet.toLowerCase(),
    username: row.username,
    avatarUrl: row.avatar_url,
    updatedAt: row.updated_at,
  };
}

export function normalizeUsername(raw: string): string | null {
  const next = raw.trim().replace(/^@+/, "").slice(0, 24);
  if (!/^[a-zA-Z0-9_]{2,24}$/.test(next)) return null;
  return next;
}

export async function getProfile(
  wallet: string,
): Promise<RpcProfile | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const addr = wallet.toLowerCase();
  const { data, error } = await supabase
    .from("rpc_profiles")
    .select("wallet, username, avatar_url, updated_at")
    .eq("wallet", addr)
    .maybeSingle();
  if (error || !data) return null;
  return rowToProfile(data as ProfileRow);
}

export async function upsertUsername(
  wallet: string,
  username: string,
): Promise<
  | { ok: true; profile: RpcProfile }
  | { ok: false; error: string; code?: string }
> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, error: "Profile store unavailable", code: "NO_STORE" };
  }
  const normalized = normalizeUsername(username);
  if (!normalized) {
    return {
      ok: false,
      error: "Username must be 2–24 letters, numbers, or _",
      code: "BAD_USERNAME",
    };
  }
  const addr = wallet.toLowerCase();
  const { data: clash } = await supabase
    .from("rpc_profiles")
    .select("wallet")
    .ilike("username", normalized)
    .neq("wallet", addr)
    .maybeSingle();
  if (clash) {
    return { ok: false, error: "Username taken", code: "USERNAME_TAKEN" };
  }

  const { data: existing } = await supabase
    .from("rpc_profiles")
    .select("wallet, username, avatar_url, updated_at")
    .eq("wallet", addr)
    .maybeSingle();

  let data: ProfileRow | null = null;
  let error: { message?: string } | null = null;

  if (existing) {
    const res = await supabase
      .from("rpc_profiles")
      .update({
        username: normalized,
        updated_at: new Date().toISOString(),
      })
      .eq("wallet", addr)
      .select("wallet, username, avatar_url, updated_at")
      .single();
    data = res.data as ProfileRow | null;
    error = res.error;
  } else {
    const res = await supabase
      .from("rpc_profiles")
      .insert({
        wallet: addr,
        username: normalized,
        updated_at: new Date().toISOString(),
      })
      .select("wallet, username, avatar_url, updated_at")
      .single();
    data = res.data as ProfileRow | null;
    error = res.error;
  }

  if (error || !data) {
    return {
      ok: false,
      error: error?.message || "Could not save profile",
      code: "STORE_ERROR",
    };
  }
  return { ok: true, profile: rowToProfile(data) };
}

export async function ensureProfile(wallet: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const addr = wallet.toLowerCase();
  const existing = await getProfile(addr);
  if (existing) return;
  await supabase.from("rpc_profiles").insert({
    wallet: addr,
    updated_at: new Date().toISOString(),
  });
}

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MAX_AVATAR_BYTES = 1_000_000;

export async function uploadAvatar(
  wallet: string,
  file: File | Blob,
  contentType: string,
): Promise<
  | { ok: true; profile: RpcProfile }
  | { ok: false; error: string; code?: string }
> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, error: "Profile store unavailable", code: "NO_STORE" };
  }
  const ext = ALLOWED_TYPES[contentType];
  if (!ext) {
    return {
      ok: false,
      error: "Use JPEG, PNG, or WebP",
      code: "BAD_TYPE",
    };
  }
  const size = "size" in file ? Number(file.size) : 0;
  if (size <= 0 || size > MAX_AVATAR_BYTES) {
    return {
      ok: false,
      error: "Image must be under 1MB",
      code: "BAD_SIZE",
    };
  }

  const addr = wallet.toLowerCase();
  await ensureProfile(addr);
  const path = `${addr}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(path, buf, {
      contentType,
      upsert: true,
      cacheControl: "3600",
    });
  if (upErr) {
    return {
      ok: false,
      error: upErr.message || "Upload failed",
      code: "UPLOAD_ERROR",
    };
  }

  const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
  const avatarUrl = `${pub.publicUrl}?v=${Date.now()}`;

  const { data, error } = await supabase
    .from("rpc_profiles")
    .update({
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("wallet", addr)
    .select("wallet, username, avatar_url, updated_at")
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: error?.message || "Could not save avatar",
      code: "STORE_ERROR",
    };
  }
  return { ok: true, profile: rowToProfile(data as ProfileRow) };
}

export async function listProfilesByWallets(
  wallets: string[],
): Promise<Map<string, RpcProfile>> {
  const out = new Map<string, RpcProfile>();
  const supabase = getSupabase();
  if (!supabase || !wallets.length) return out;
  const addrs = [...new Set(wallets.map((w) => w.toLowerCase()))];
  const { data } = await supabase
    .from("rpc_profiles")
    .select("wallet, username, avatar_url, updated_at")
    .in("wallet", addrs);
  for (const row of (data || []) as ProfileRow[]) {
    out.set(row.wallet.toLowerCase(), rowToProfile(row));
  }
  return out;
}

export { hasSupabase as hasRpcProfileStore };
