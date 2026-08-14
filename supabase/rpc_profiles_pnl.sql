-- Run once in Supabase → SQL Editor → New query → Run
-- Then create a public Storage bucket named "avatars" (public read).
-- API writes use the service role key (server-only).

-- Profiles (username + avatar for Access Key wallets)
create table if not exists public.rpc_profiles (
  wallet text primary key,
  username text,
  avatar_url text,
  updated_at timestamptz not null default now()
);

create unique index if not exists rpc_profiles_username_unique
  on public.rpc_profiles (lower(username))
  where username is not null and length(trim(username)) > 0;

alter table public.rpc_profiles enable row level security;

grant select, insert, update, delete on table public.rpc_profiles to service_role;
grant usage on schema public to service_role;

-- ETH_RPC / Hood_RPC site fills (platform TX leaderboard + cost basis)
create table if not exists public.rpc_snipe_fills (
  id uuid primary key default gen_random_uuid(),
  wallet text not null,
  tx_hash text not null,
  contract text not null,
  token_id text not null,
  collection_slug text,
  token_name text,
  cost_eth numeric not null check (cost_eth >= 0),
  bought_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open', 'closed')),
  exit_eth numeric,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists rpc_snipe_fills_tx_hash_unique
  on public.rpc_snipe_fills (tx_hash);

create index if not exists rpc_snipe_fills_wallet_idx
  on public.rpc_snipe_fills (lower(wallet));

create index if not exists rpc_snipe_fills_status_idx
  on public.rpc_snipe_fills (status);

alter table public.rpc_snipe_fills enable row level security;

grant select, insert, update, delete on table public.rpc_snipe_fills to service_role;

-- Storage: create bucket "avatars" in Dashboard → Storage
-- Policies (optional if only service_role uploads):
--   public SELECT on storage.objects where bucket_id = 'avatars'
--   service_role full access (default with service key)
