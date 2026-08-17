"use strict";

const { Client } = require("pg");

const ENSURE_SQL = `
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

alter table if exists subid_ops drop constraint if exists subid_ops_canal_check;
alter table if exists subid_ops add constraint subid_ops_canal_check
  check (canal is null or canal in ('meta', 'pinterest', 'organico', 'indefinido'));

notify pgrst, 'reload schema';
`;

function projectRef() {
  return (process.env.SUPABASE_URL || "")
    .replace(/^https?:\/\//, "")
    .replace(/\.supabase\.co.*$/, "")
    .trim();
}

function connectionStrings() {
  const password = process.env.SUPABASE_DB_PASSWORD || "";
  const ref = projectRef();
  const list = [];
  if (process.env.DATABASE_URL) list.push(process.env.DATABASE_URL);
  if (password && ref) {
    list.push(
      `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`
    );
    list.push(
      `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`
    );
  }
  return [...new Set(list)];
}

async function withPg(fn) {
  const strings = connectionStrings();
  if (!strings.length) return null;
  let lastErr = null;
  for (const connectionString of strings) {
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      const result = await fn(client);
      await client.end();
      return result === undefined ? true : result;
    } catch (err) {
      lastErr = err;
      try { await client.end(); } catch (_) { /* ignore */ }
    }
  }
  if (lastErr) console.warn("[ensureDb]", lastErr.message);
  return null;
}

let ensured = false;

async function ensureConfigSchema() {
  if (ensured) return true;
  const ok = await withPg(async (client) => {
    await client.query(ENSURE_SQL);
  });
  if (ok) {
    ensured = true;
    console.log("[ensureDb] colunas de configuração aplicadas e schema PostgREST recarregado");
  }
  return Boolean(ok);
}

async function upsertAppSettingsSql(row) {
  const cols = Object.keys(row);
  if (!cols.length) return false;
  const values = cols.map((k) => row[k]);
  const placeholders = cols.map((_, i) => `$${i + 1}`);
  const updates = cols
    .filter((k) => k !== "user_id")
    .map((k) => `${k} = excluded.${k}`);
  const sql = `
    insert into app_settings (${cols.join(", ")})
    values (${placeholders.join(", ")})
    on conflict (user_id) do update set ${updates.join(", ")}
  `;
  const ok = await withPg(async (client) => {
    await client.query(sql, values);
  });
  return Boolean(ok);
}

module.exports = {
  ensureConfigSchema,
  upsertAppSettingsSql,
};
