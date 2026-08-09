#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

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
  const { saveCredentials, credentialsPublic } = require("../server/store");
  const appId = (process.env.SHOPEE_APP_ID || "").trim();
  const secret = (process.env.SHOPEE_SECRET || "").trim();
  if (!appId || !secret) {
    console.error("SHOPEE_APP_ID / SHOPEE_SECRET ausentes no .env");
    process.exit(1);
  }
  const saved = await saveCredentials({ appId, secret });
  console.log("Credenciais Shopee gravadas no Supabase:", saved);
  console.log("Estado:", await credentialsPublic());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
