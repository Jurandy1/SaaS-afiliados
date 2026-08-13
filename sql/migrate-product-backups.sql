-- Backup de produtos + grupos (estrutura Afiliadoteste)
create table if not exists product_backups (
  user_id uuid not null,
  item_id text not null,
  shop_id text not null default '',
  nome text not null default '',
  apelido text not null default '',
  preco numeric not null default 0,
  comissao_pct numeric not null default 0,
  vendas_shopee integer not null default 0,
  imagem text not null default '',
  rating numeric not null default 0,
  loja text not null default '',
  link_produto text not null default '',
  link_afiliado text not null default '',
  periodo_inicio bigint,
  periodo_fim bigint,
  marcado_principal boolean not null default false,
  grupo_id uuid,
  status_api text not null default 'ok',
  alertas jsonb not null default '[]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  cadastrado_em timestamptz not null default now(),
  ultima_verificacao timestamptz not null default now(),
  primary key (user_id, item_id)
);

alter table product_backups add column if not exists grupo_id uuid;
alter table product_backups add column if not exists apelido text not null default '';
alter table product_backups add column if not exists marcado_principal boolean not null default false;
alter table product_backups add column if not exists status_api text not null default 'ok';
alter table product_backups add column if not exists alertas jsonb not null default '[]'::jsonb;
alter table product_backups add column if not exists payload jsonb not null default '{}'::jsonb;
alter table product_backups add column if not exists periodo_inicio bigint;
alter table product_backups add column if not exists periodo_fim bigint;
alter table product_backups add column if not exists cadastrado_em timestamptz not null default now();
alter table product_backups add column if not exists ultima_verificacao timestamptz not null default now();

create index if not exists idx_product_backups_user on product_backups (user_id, cadastrado_em desc);
create index if not exists idx_product_backups_grupo on product_backups (user_id, grupo_id);
create index if not exists idx_product_backups_loja on product_backups (user_id, loja);

create table if not exists product_backup_grupos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  nome text not null default '',
  principal_item_id text not null default '',
  backup_item_ids jsonb not null default '[]'::jsonb,
  historico jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_product_backup_grupos_user
  on product_backup_grupos (user_id, atualizado_em desc);
