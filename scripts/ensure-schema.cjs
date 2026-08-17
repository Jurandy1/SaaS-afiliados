#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}
loadEnv();

const SQL = `
create table if not exists app_settings (
  user_id uuid primary key,
  meta_base numeric not null default 863959,
  tax_rate numeric not null default 0,
  team_name text not null default 'Minha conta',
  team_plan text not null default 'Shopee · Meta',
  updated_at timestamptz not null default now()
);

alter table if exists app_settings add column if not exists tax_rate numeric not null default 0;
alter table if exists app_settings add column if not exists team_name text not null default 'Minha conta';
alter table if exists app_settings add column if not exists team_plan text not null default 'Shopee · Meta';
alter table if exists app_settings add column if not exists meta_base numeric not null default 863959;
alter table if exists app_settings add column if not exists meta_tax_rate numeric default 12;
alter table if exists app_settings add column if not exists meta_dias numeric null;
alter table if exists app_settings add column if not exists meta_bonus_100 numeric null default 1;
alter table if exists app_settings add column if not exists meta_bonus_125 numeric null default 2;
alter table if exists app_settings add column if not exists meta_bonus_150 numeric null default 3;
alter table if exists app_settings add column if not exists claude_api_key text not null default '';
alter table if exists app_settings add column if not exists claude_model text not null default 'claude-sonnet-4-20250514';

create table if not exists app_credentials (
  user_id uuid primary key,
  app_id text not null,
  secret text not null,
  updated_at timestamptz not null default now()
);

create table if not exists meta_credentials (
  user_id uuid primary key,
  access_token text not null default '',
  ad_account_ids text not null default '',
  api_version text not null default 'v19.0',
  last_sync_at timestamptz,
  last_sync_meta jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists pinterest_credentials (
  user_id uuid primary key,
  app_id text not null default '',
  access_token text not null default '',
  ad_account_ids text not null default '',
  last_sync_at timestamptz,
  last_sync_meta jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists subid_ops (
  user_id uuid not null,
  subid text not null,
  canal text,
  status text,
  produto text,
  updated_at timestamptz default now(),
  primary key (user_id, subid)
);

alter table if exists subid_ops drop constraint if exists subid_ops_canal_check;
alter table if exists subid_ops add constraint subid_ops_canal_check
  check (canal is null or canal in ('meta', 'pinterest', 'organico', 'indefinido'));

alter table if exists subid_ops drop constraint if exists subid_ops_status_check;
alter table if exists subid_ops add constraint subid_ops_status_check
  check (status is null or status in ('ativa', 'teste', 'desativada', 'pausada'));

notify pgrst, 'reload schema';
`;

async function main() {
  const password = process.env.SUPABASE_DB_PASSWORD || "";
  const ref = (process.env.SUPABASE_URL || "")
    .replace(/^https?:\/\//, "")
    .replace(/\.supabase\.co.*$/, "")
    .trim();
  if (!password || !ref) {
    console.error("Defina SUPABASE_DB_PASSWORD e SUPABASE_URL no .env");
    process.exit(1);
  }
  const connectionString =
    process.env.DATABASE_URL ||
    `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`;

  async function run(cs, label) {
    const client = new Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
    await client.connect();
    console.log(`Aplicando ensure-schema (${label})…`);
    await client.query(SQL);
    const cols = await client.query(`
      select column_name
      from information_schema.columns
      where table_schema = 'public' and table_name = 'app_settings'
      order by ordinal_position
    `);
    const ops = await client.query(`
      select column_name
      from information_schema.columns
      where table_schema = 'public' and table_name = 'subid_ops'
      order by ordinal_position
    `);
    const tables = await client.query(`
      select table_name from information_schema.tables
      where table_schema = 'public'
        and table_name in ('app_settings','app_credentials','meta_credentials','pinterest_credentials','subid_ops')
      order by 1
    `);
    console.log("tabelas:", tables.rows.map((r) => r.table_name).join(", "));
    console.log("app_settings:", cols.rows.map((r) => r.column_name).join(", "));
    console.log("subid_ops:", ops.rows.map((r) => r.column_name).join(", "));
    await client.end();
  }

  try {
    await run(connectionString, "pooler");
  } catch (err) {
    const alt = `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`;
    console.log("Pooler falhou, tentando host direto…", err.message);
    await run(alt, "direto");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
