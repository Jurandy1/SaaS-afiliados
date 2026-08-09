-- Migração: remove schema single-tenant antigo e aplica multi-user.
-- CUIDADO: apaga dados compartilhados anteriores (id=default).

drop function if exists reset_shopee_data();
drop function if exists reset_meta_data();

drop table if exists order_items cascade;
drop table if exists orders cascade;
drop table if exists products cascade;
drop table if exists pinterest_ads_daily cascade;
drop table if exists meta_ads_daily cascade;
drop table if exists subid_metrics cascade;
drop table if exists daily_metrics cascade;
drop table if exists sync_runs cascade;
drop table if exists app_settings cascade;
drop table if exists meta_credentials cascade;
drop table if exists app_credentials cascade;
