#!/usr/bin/env node
"use strict";

/**
 * Cria/atualiza a conta DEMONSTRAÇÃO com Shopee + Meta do .env.
 * Outros usuários continuam vazios e isolados.
 */
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

const DEMO_EMAIL = (process.env.DEMO_EMAIL || "teste@gmail.com").trim().toLowerCase();
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "123456789";

async function main() {
  const { getSupabaseAdmin, runWithUser } = require("../server/auth");
  const { saveCredentials } = require("../server/store");
  const { saveMetaCredentials, syncMetaDaily } = require("../server/meta");
  const { saveSettings } = require("../server/store");

  const admin = getSupabaseAdmin();
  const shopeeApp = (process.env.SHOPEE_APP_ID || "").trim();
  const shopeeSecret = (process.env.SHOPEE_SECRET || "").trim();
  const metaToken = (process.env.META_ACCESS_TOKEN || "").trim();
  const metaAccounts = (process.env.META_AD_ACCOUNT_IDS || "").trim();
  const metaVersion = (process.env.META_API_VERSION || "v19.0").trim();

  if (!shopeeApp || !shopeeSecret) {
    console.error("Defina SHOPEE_APP_ID e SHOPEE_SECRET no .env");
    process.exit(1);
  }

  // Localiza ou cria usuário demo
  let userId = null;
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const found = (listed.data?.users || []).find((u) => (u.email || "").toLowerCase() === DEMO_EMAIL);
  if (found) {
    userId = found.id;
    await admin.auth.admin.updateUserById(userId, {
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
    console.log("Usuário demo já existia — senha atualizada.");
  } else {
    const created = await admin.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { role: "demo", label: "Conta demonstração" },
    });
    if (created.error) throw new Error(created.error.message);
    userId = created.data.user.id;
    console.log("Usuário demo criado.");
  }

  const user = { id: userId, email: DEMO_EMAIL };

  await runWithUser(user, async () => {
    await saveCredentials({ appId: shopeeApp, secret: shopeeSecret }, userId);
    console.log("Shopee demo gravada:", shopeeApp);

    const { ensureProfile } = require("../server/profiles");
    const profile = await ensureProfile({ id: userId, email: DEMO_EMAIL });
    console.log("Perfil admin:", profile.role, profile.status);

    if (metaToken && metaAccounts) {
      await saveMetaCredentials({
        accessToken: metaToken,
        adAccountIds: metaAccounts,
        apiVersion: metaVersion,
      }, userId);
      console.log("Meta demo gravada:", metaAccounts.split(",").length, "contas");
      try {
        const sync = await syncMetaDaily({ daysBack: 7 }, userId);
        console.log("Meta sync:", sync.gravados, "linhas", sync.erros?.length ? `(avisos: ${sync.erros.length})` : "");
      } catch (e) {
        console.warn("Meta sync falhou (credenciais ok):", e.message);
      }
    } else {
      console.warn("META_* ausente no .env — só Shopee foi seedada.");
    }

    await saveSettings({
      teamName: "Teste de Sistema de afiliados",
      teamPlan: "Conta demonstração",
      metaBase: 863959,
      taxRate: 0,
    }, userId);

    const claudeKey = (process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || "").trim();
    const claudeModel = (process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514").trim();
    if (claudeKey) {
      const { saveClaudeCredentials } = require("../server/claude");
      await saveClaudeCredentials({ apiKey: claudeKey, model: claudeModel }, userId);
      console.log("Claude demo gravada.");
    }
  });

  console.log("\n=== CONTA ADMIN / DEMONSTRAÇÃO ===");
  console.log("Email:   ", DEMO_EMAIL);
  console.log("Senha:   ", DEMO_PASSWORD);
  console.log("Admin:   ", "http://localhost:3790/admin");
  console.log("App:     ", "http://localhost:3790/");
  console.log("Novos usuários ficam pendentes até aprovação no Admin.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
