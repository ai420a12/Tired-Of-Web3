-- Run this once in Supabase → SQL Editor → New query → Run

create table if not exists public.wl_submissions (
  id uuid primary key,
  x_handle text not null,
  x_profile text not null,
  wallet text not null,
  why_tired text not null,
  quote_link text not null,
  comment_link text not null,
  task_follow boolean not null default true,
  task_share boolean not null default true,
  task_tag boolean not null default true,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists wl_submissions_wallet_unique
  on public.wl_submissions (lower(wallet));

create unique index if not exists wl_submissions_handle_unique
  on public.wl_submissions (lower(x_handle));

-- Lock the table from public browser access.
-- Your Next.js API uses the service role key (server-only).
alter table public.wl_submissions enable row level security;
