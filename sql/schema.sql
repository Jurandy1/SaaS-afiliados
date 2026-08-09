-- Metricly / SaaS AFILIADOS — schema completo (SaaS SHOPPE)

create table if not exists app_credentials (
  id text primary key default 'default',
  app_id text not null,
  secret text not null,
  updated_at timestamptz not null default now()
);

create table if not exists meta_credentials (
  id text primary key default 'default',
  access_token text not null default '',
  ad_account_ids text not null default '',
  api_version text not null default 'v19.0',
  last_sync_at timestamptz,
  last_sync_meta jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists app_settings (
  id text primary key default 'default',
  meta_base numeric not null default 863959,
  tax_rate numeric not null default 0,
  team_name text not null default 'SaaS SHOPPE',
  team_plan text not null default 'Shopee · Meta',
  updated_at timestamptz not null default now()
);

insert into app_settings (id) values ('default') on conflict (id) do nothing;

create table if not exists sync_runs (
  id bigserial primary key,
  start_date date not null,
  end_date date not null,
  nodes integer not null default 0,
  pages integer not null default 0,
  kpis jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);

create table if not exists daily_metrics (
  data date primary key,
  faturamento numeric not null default 0,
  comissao numeric not null default 0,
  pedidos integer not null default 0,
  concluidos integer not null default 0,
  pendentes integer not null default 0,
  cancelados integer not null default 0,
  unpaid integer not null default 0,
  inv_meta numeric not null default 0,
  inv_pin numeric not null default 0,
  inv_total numeric not null default 0,
  lucro numeric not null default 0,
  roi numeric not null default 0,
  updated_at timestamptz not null default now()
);

-- add columns if table already existed without them
alter table daily_metrics add column if not exists inv_meta numeric not null default 0;
alter table daily_metrics add column if not exists inv_pin numeric not null default 0;
alter table daily_metrics add column if not exists inv_total numeric not null default 0;
alter table daily_metrics add column if not exists lucro numeric not null default 0;
alter table daily_metrics add column if not exists roi numeric not null default 0;

create table if not exists subid_metrics (
  subid text primary key,
  faturamento numeric not null default 0,
  comissao numeric not null default 0,
  pedidos integer not null default 0,
  concluidos integer not null default 0,
  pendentes integer not null default 0,
  cancelados integer not null default 0,
  itens integer not null default 0,
  abatimento numeric not null default 0,
  inv_meta numeric not null default 0,
  inv_pin numeric not null default 0,
  inv_total numeric not null default 0,
  lucro numeric not null default 0,
  roi numeric not null default 0,
  updated_at timestamptz not null default now()
);

alter table subid_metrics add column if not exists inv_meta numeric not null default 0;
alter table subid_metrics add column if not exists inv_pin numeric not null default 0;
alter table subid_metrics add column if not exists inv_total numeric not null default 0;
alter table subid_metrics add column if not exists lucro numeric not null default 0;
alter table subid_metrics add column if not exists roi numeric not null default 0;

create table if not exists meta_ads_daily (
  ad_id text not null,
  data date not null,
  ad_name text not null default '',
  subid text not null default '',
  adset_name text not null default '',
  campaign_name text not null default '',
  gasto numeric not null default 0,
  impressoes integer not null default 0,
  alcance integer not null default 0,
  cliques integer not null default 0,
  ctr numeric not null default 0,
  cpc numeric not null default 0,
  account_id text not null default '',
  updated_at timestamptz not null default now(),
  primary key (ad_id, data)
);

create index if not exists idx_meta_ads_daily_data on meta_ads_daily (data);
create index if not exists idx_meta_ads_daily_subid on meta_ads_daily (subid);

create table if not exists pinterest_ads_daily (
  id text primary key,
  ad_id text not null default '',
  data date,
  ad_name text not null default '',
  subid text not null default '',
  gasto numeric not null default 0,
  cliques integer not null default 0,
  status text not null default '',
  updated_at timestamptz not null default now()
);

create index if not exists idx_pin_ads_daily_data on pinterest_ads_daily (data);
create index if not exists idx_pin_ads_daily_subid on pinterest_ads_daily (subid);

create table if not exists orders (
  order_id text primary key,
  conversion_id text,
  data date,
  subid text not null default 'ORGANICO',
  status text not null default 'pendente',
  faturamento numeric not null default 0,
  comissao numeric not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists idx_orders_data on orders (data);
create index if not exists idx_orders_subid on orders (subid);

create table if not exists order_items (
  id text primary key,
  order_id text not null references orders(order_id) on delete cascade,
  item_id text not null default '',
  item_name text not null default '',
  shop_name text not null default '',
  qty integer not null default 0,
  faturamento numeric not null default 0,
  comissao numeric not null default 0,
  data date,
  subid text not null default 'ORGANICO',
  updated_at timestamptz not null default now()
);

create index if not exists idx_order_items_item on order_items (item_id);
create index if not exists idx_order_items_data on order_items (data);

create table if not exists products (
  item_id text primary key,
  item_name text not null default '',
  shop_name text not null default '',
  faturamento numeric not null default 0,
  comissao numeric not null default 0,
  pedidos integer not null default 0,
  qty integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists idx_sync_runs_synced on sync_runs (synced_at desc);
create index if not exists idx_daily_metrics_data on daily_metrics (data);
create index if not exists idx_subid_comissao on subid_metrics (comissao desc);

create or replace function reset_shopee_data()
returns void
language plpgsql
security definer
as $$
begin
  truncate table sync_runs restart identity;
  truncate table daily_metrics;
  truncate table subid_metrics;
  truncate table orders cascade;
  truncate table order_items;
  truncate table products;
end;
$$;

create or replace function reset_meta_data()
returns void
language plpgsql
security definer
as $$
begin
  truncate table meta_ads_daily;
end;
$$;
