"use strict";
/**
 * Puxa conversões de ontem (BRT) e envia push "Comissão Shopee Total".
 * Uso: node scripts/push-ontem.cjs
 */
const fs = require("fs");
const path = require("path");

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env");
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

const { getSupabaseAdmin, runWithUser } = require("../server/auth");
const { buildDashboard } = require("../server/metrics");
const { shopeeEndDate } = require("../server/brtDates");
const { notifyYesterdayCommission } = require("../server/pushCommission");
const { credentialsPublic } = require("../server/store");
const { syncMetaDaily, metaCredentialsPublic } = require("../server/meta");
const { enrichDashboardWithAds } = require("../server/finance");

async function main() {
  const yesterday = shopeeEndDate();
  const sb = getSupabaseAdmin();
  const { data: profiles, error } = await sb
    .from("user_profiles")
    .select("user_id, email, status, role")
    .or("status.eq.approved,role.eq.admin");
  if (error) throw error;

  const targets = (profiles || []).filter((p) => p.status === "approved" || p.role === "admin");
  console.log(`[push-ontem] data=${yesterday} contas=${targets.length}`);

  for (const p of targets) {
    await runWithUser({ id: p.user_id, email: p.email || "" }, async () => {
      const shopee = await credentialsPublic(p.user_id);
      if (!shopee.configured) {
        console.log(`[push-ontem] skip ${p.email}: Shopee nao configurada`);
        return;
      }

      console.log(`[push-ontem] puxando ${p.email} ${yesterday}…`);
      try {
        const metaCred = await metaCredentialsPublic(p.user_id);
        if (metaCred.configured) {
          await syncMetaDaily({ since: yesterday, until: yesterday }, p.user_id);
        }
      } catch (e) {
        console.warn(`[push-ontem] meta ${p.email}:`, e.message || e);
      }

      let dash = await buildDashboard({
        startDate: yesterday,
        endDate: yesterday,
        persist: true,
        persistSubIds: false,
      });
      try {
        dash = await enrichDashboardWithAds(dash, p.user_id, { persistSubIds: false, persistDaily: true });
      } catch (_) { /* keep */ }

      console.log(
        `[push-ontem] ${p.email}: nodes=${dash.nodes} fat=${dash.kpis?.faturamento} com=${dash.kpis?.comissao} lucro=${dash.kpis?.lucro}`,
      );

      const push = await notifyYesterdayCommission(p.user_id, {
        email: p.email,
        force: true,
      });
      console.log(`[push-ontem] push:`, push);
    });
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
