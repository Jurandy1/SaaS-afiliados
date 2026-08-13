-- Projeção de Metas e Bônus (opcional — app funciona com defaults se colunas não existirem)
alter table if exists app_settings
  add column if not exists meta_dias numeric null,
  add column if not exists meta_bonus_100 numeric null default 1,
  add column if not exists meta_bonus_125 numeric null default 2,
  add column if not exists meta_bonus_150 numeric null default 3;
