"use strict";
const fs = require("fs");
const path = require("path");
for (const line of fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 0) continue;
  const k = t.slice(0, i).trim();
  let v = t.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!process.env[k]) process.env[k] = v;
}

const { getSupabaseAdmin, runWithUser } = require("../server/auth");
const { syncMetaDaily, metaCredentialsPublic } = require("../server/meta");
const { shopeeEndDate, brtSubtractDays } = require("../server/brtDates");
const { ensureConfigSchema } = require("../server/ensureDb");

(async () => {
  await ensureConfigSchema();
  const until = shopeeEndDate();
  const since = brtSubtractDays(29, until); // 30 dias fechados
  const sb = getSupabaseAdmin();
  const { data: profiles } = await sb
    .from("user_profiles")
    .select("user_id, email, status, role")
    .or("status.eq.approved,role.eq.admin");

  for (const p of profiles || []) {
    await runWithUser({ id: p.user_id, email: p.email || "" }, async () => {
      const cred = await metaCredentialsPublic(p.user_id);
      if (!cred.configured) {
        console.log(`[meta-sync] skip ${p.email}: Meta nao configurada`);
        return;
      }
      console.log(`[meta-sync] ${p.email} ${since}→${until}…`);
      const r = await syncMetaDaily({ since, until }, p.user_id);
      console.log(JSON.stringify({
        email: p.email,
        gravados: r.gravados,
        gasto: r.totais?.gasto,
        cliques: r.totais?.cliques,
        cliques_link: r.totais?.cliques_link,
        impressoes: r.totais?.impressoes,
        erros: r.erros || [],
      }, null, 2));
    });
  }
})().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
