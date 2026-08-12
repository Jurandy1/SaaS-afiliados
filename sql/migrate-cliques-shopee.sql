-- Persistência de Cliques Shopee (clickTime do conversionReport)
alter table if exists subid_metrics
  add column if not exists cliques_shopee integer not null default 0;
