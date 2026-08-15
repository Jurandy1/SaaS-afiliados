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

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, "..", "sql", "schema.sql"), "utf8");
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
    console.log(`Aplicando schema.sql (${label})…`);
    await client.query(sql);
    await client.end();
  }

  console.log("Conectando ao Supabase Postgres…");
  try {
    await run(connectionString, "pooler");
  } catch (err) {
    const alt = `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`;
    console.log("Pooler falhou, tentando host direto…", err.message);
    await run(alt, "direto");
  }
  console.log("Schema aplicado.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
