-- Metricly / SaaS AFILIADOS — schema (projeto Supabase: SaaS SHOPPE)
-- Rode no SQL Editor se o setup automático falhar.

create table if not exists app_credentials (
  id text primary key default 'default',
  app_id text not null,
  secret text not null,
  updated_at timestamptz not null default now()
);

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
  updated_at timestamptz not null default now()
);

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
  updated_at timestamptz not null default now()
);

create index if not exists idx_sync_runs_synced on sync_runs (synced_at desc);
create index if not exists idx_daily_metrics_data on daily_metrics (data);
create index if not exists idx_subid_comissao on subid_metrics (comissao desc);

-- Limpa tudo ao trocar de APP_ID (chamado pelo backend)
create or replace function reset_shopee_data()
returns void
language plpgsql
security definer
as $$
begin
  truncate table sync_runs restart identity;
  truncate table daily_metrics;
  truncate table subid_metrics;
end;
$$;
