-- Credenciais Pinterest Ads API (por usuário)
create table if not exists pinterest_credentials (
  user_id uuid primary key,
  app_id text not null default '',
  access_token text not null default '',
  ad_account_ids text not null default '',
  last_sync_at timestamptz,
  last_sync_meta jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
