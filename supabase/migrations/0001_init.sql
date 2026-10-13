-- AirdropMe schema for Supabase / PostgreSQL.
-- Public profile identifiers are separate from claim wallets.
-- No private keys or seed phrases are stored.

create extension if not exists pgcrypto;

create table if not exists admin_settings (
  id integer primary key check (id = 1),
  formula_version integer not null,
  points_per_follower integer not null,
  points_per_callout integer not null,
  points_per_like integer not null,
  points_per_repost integer not null,
  cap_followers bigint not null,
  cap_callouts bigint not null,
  cap_likes bigint not null,
  cap_reposts bigint not null,
  cap_total_points bigint not null,
  score_basis text not null,
  updated_at timestamptz not null default now()
);

insert into admin_settings (
  id, formula_version, points_per_follower, points_per_callout, points_per_like, points_per_repost,
  cap_followers, cap_callouts, cap_likes, cap_reposts, cap_total_points, score_basis
) values (
  1, 1, 1, 5, 1, 2,
  1000000, 50000, 5000000, 5000000, 20000000, 'current_cumulative_totals'
) on conflict (id) do nothing;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  pump_user_id text not null unique,
  username text,
  canonical_wallet text,
  profile_image text,
  bio text,
  banned boolean not null default false,
  flagged boolean not null default false,
  flag_reason text,
  data_mode text not null check (data_mode in ('live', 'demo')),
  current_points bigint not null default 0,
  formula_version integer not null default 1,
  last_fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_username_idx on users (lower(username));
create index if not exists users_wallet_idx on users (canonical_wallet);
create index if not exists users_points_idx on users (current_points desc);

create table if not exists submitted_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  submitted_raw text not null,
  normalized text not null,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists submitted_profiles_ip_idx on submitted_profiles (ip_hash, created_at desc);
create index if not exists submitted_profiles_user_idx on submitted_profiles (user_id, created_at desc);

create table if not exists profile_statistics_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  fetched_at timestamptz not null default now(),
  data_mode text not null,
  followers bigint,
  followers_status text not null,
  followers_source text not null,
  followers_detail text not null,
  callouts bigint,
  callouts_status text not null,
  callouts_source text not null,
  callouts_detail text not null,
  likes bigint,
  likes_status text not null,
  likes_source text not null,
  likes_detail text not null,
  reposts bigint,
  reposts_status text not null,
  reposts_source text not null,
  reposts_detail text not null,
  upstream_computed_at timestamptz,
  points_total bigint not null,
  points_breakdown jsonb not null,
  formula_version integer not null
);

create index if not exists snapshots_user_idx on profile_statistics_snapshots (user_id, fetched_at desc);

create table if not exists callout_records (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references profile_statistics_snapshots (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  callout_id text not null,
  coin_mint text,
  likes bigint not null,
  repost_count bigint not null,
  created_at timestamptz,
  unique (snapshot_id, callout_id)
);

create table if not exists point_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  snapshot_id uuid not null references profile_statistics_snapshots (id) on delete cascade,
  formula_version integer not null,
  total bigint not null,
  breakdown jsonb not null,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists leaderboard_cache (
  user_id uuid primary key references users (id) on delete cascade,
  rank integer not null,
  pump_user_id text not null,
  username text,
  canonical_wallet text,
  followers bigint,
  callouts bigint,
  likes bigint,
  reposts bigint,
  followers_status text not null,
  callouts_status text not null,
  likes_status text not null,
  reposts_status text not null,
  points bigint not null,
  data_mode text not null,
  last_fetched_at timestamptz
);

create index if not exists leaderboard_points_idx on leaderboard_cache (points desc, rank);

create table if not exists airdrop_campaigns (
  id text primary key,
  name text not null,
  status text not null check (status in ('upcoming', 'active', 'claim_open', 'ended', 'paused')),
  starts_at timestamptz,
  ends_at timestamptz,
  claim_starts_at timestamptz,
  claim_ends_at timestamptz,
  token_symbol text,
  total_allocation text,
  funded boolean not null default false,
  min_points bigint not null default 1,
  description text not null,
  distribution_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into airdrop_campaigns (
  id, name, status, min_points, description, funded, distribution_enabled
) values (
  'campaign_default',
  'Community score campaign',
  'upcoming',
  1,
  'Points rank public Pump.fun activity for this campaign. No token allocation is configured or funded, and connecting a wallet only registers a claim request.',
  false,
  false
) on conflict (id) do nothing;

create table if not exists airdrop_claims (
  id uuid primary key default gen_random_uuid(),
  campaign_id text not null references airdrop_campaigns (id),
  user_id uuid not null references users (id),
  wallet_address text not null,
  status text not null check (status in ('registered', 'pending_distribution', 'submitted', 'confirmed', 'failed', 'rejected')),
  points_at_claim bigint not null,
  wallet_signature text not null,
  tx_signature text,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, user_id),
  unique (campaign_id, wallet_address)
);

create table if not exists claim_nonces (
  nonce text primary key,
  wallet_address text not null,
  user_id uuid not null references users (id) on delete cascade,
  campaign_id text not null,
  message text not null,
  expires_at timestamptz not null,
  used_at timestamptz
);

create table if not exists fetch_failures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete set null,
  identifier text not null,
  endpoint text not null,
  status_code integer,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists fetch_failures_created_idx on fetch_failures (created_at desc);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor text not null,
  action text not null,
  target text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_idx on audit_logs (created_at desc);
