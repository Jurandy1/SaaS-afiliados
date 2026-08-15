-- Imposto Meta (sobre invest) + mapa SubID canal/status
alter table if exists app_settings
  add column if not exists meta_tax_rate numeric default 12;

create table if not exists subid_ops (
  user_id uuid not null,
  subid text not null,
  canal text check (canal in ('meta', 'pinterest', 'organico')),
  status text check (status is null or status in ('ativa', 'teste', 'desativada', 'pausada')),
  produto text,
  updated_at timestamptz default now(),
  primary key (user_id, subid)
);

create index if not exists subid_ops_user_idx on subid_ops (user_id);
