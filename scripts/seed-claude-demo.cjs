#!/usr/bin/env node
"use strict";

/**
 * Grava Claude API + rótulos da conta demonstração (teste@gmail.com).
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
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}
loadEnv();

const DEMO_EMAIL = (process.env.DEMO_EMAIL || "teste@gmail.com").trim().toLowerCase();

async function main() {
  const { getSupabaseAdmin, runWithUser } = require("../server/auth");
  const { saveClaudeCredentials, claudeCredentialsPublic } = require("../server/claude");
  const { saveSettings, loadSettings } = require("../server/store");

  const apiKey = (process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || "").trim();
  const model = (process.env.CLAUDE_MODEL || "claude-sonnet-4-6").trim();
  if (!apiKey) {
    console.error("CLAUDE_API_KEY ausente no .env");
    process.exit(1);
  }

  const admin = getSupabaseAdmin();
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const found = (listed.data?.users || []).find(
    (u) => (u.email || "").toLowerCase() === DEMO_EMAIL
  );
  if (!found) {
    console.error(`Usuário ${DEMO_EMAIL} não encontrado no Auth`);
    process.exit(1);
  }

  const userId = found.id;
  await runWithUser({ id: userId, email: DEMO_EMAIL }, async () => {
    await saveSettings(
      {
        teamName: "Conta demonstração",
        teamPlan: "Conta demonstração",
      },
      userId
    );
    await saveClaudeCredentials({ apiKey, model }, userId);

    const settings = await loadSettings(userId);
    const claude = await claudeCredentialsPublic(userId);
    console.log(
      JSON.stringify(
        {
          email: DEMO_EMAIL,
          userId,
          teamName: settings.teamName,
          teamPlan: settings.teamPlan,
          claude: {
            configured: claude.configured,
            model: claude.model,
            apiKeyMasked: claude.apiKeyMasked,
          },
        },
        null,
        2
      )
    );
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
