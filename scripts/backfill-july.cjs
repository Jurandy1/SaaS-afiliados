"use strict";

/**
 * Backfill mês 7 (julho) no SaaS — mesma lógica do Afiliadoteste:
 * - Shopee conversionReport (query mínima, totalCommission, scrollId, gap >30s entre janelas)
 * - Meta insights diários level=ad
 * - Persistência no Supabase do SaaS (tirvmswpccejqasmauug)
 *
 * Uso: node scripts/backfill-july.cjs [YYYY]
 * Default: ano do calendário atual (BRT).
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

const DEMO_EMAIL = (process.env.DEMO_EMAIL || "teste@gmail.com").trim().toLowerCase();
const YEAR = Number(process.argv[2]) || new Date().getFullYear();
const START = `${YEAR}-07-01`;
const END = `${YEAR}-07-31`;
const CHUNK_DAYS = 4;
const GAP_MS = Math.max(31_000, Number(process.env.SHOPEE_NEW_QUERY_DELAY_MS || 31_000));

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function addDays(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

function chunkRanges(start, end, size) {
  const out = [];
  let cur = start;
  while (cur <= end) {
    let to = addDays(cur, size - 1);
    if (to > end) to = end;
    out.push([cur, to]);
    cur = addDays(to, 1);
  }
  return out;
}

function nodeKey(node) {
  const cid = String(node?.conversionId || "").trim();
  const orderId = String(node?.orders?.[0]?.orderId || "").trim();
  if (cid && orderId) return `${cid}__${orderId}`;
  if (cid) return cid;
  return `__noid_${node?.purchaseTime || ""}_${orderId}`;
}

async function main() {
  const { getSupabaseAdmin, runWithUser } = require("../server/auth");
  const { pullConversionReport } = require("../server/shopee");
  const { aggregateReport } = require("../server/metrics");
  const { enrichDashboardWithAds } = require("../server/finance");
  const { saveDashboardSnapshot, persistOrdersAndProducts } = require("../server/store");
  const { syncMetaDaily } = require("../server/meta");
  const { getSupabase } = require("../server/supabase");

  console.log(`\n=== BACKFILL JULHO ${YEAR} (SaaS) ===`);
  console.log(`Período: ${START} → ${END}`);
  console.log(`Supabase: ${(process.env.SUPABASE_URL || "").replace(/^https?:\/\//, "").split("/")[0]}`);

  const admin = getSupabaseAdmin();
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const u = (listed.data?.users || []).find((x) => (x.email || "").toLowerCase() === DEMO_EMAIL);
  if (!u) throw new Error(`Usuário demo ${DEMO_EMAIL} não encontrado`);

  await runWithUser({ id: u.id, email: u.email }, async () => {
    // 1) Meta primeiro (não compete com throttle Shopee)
    console.log("\n[1/3] Meta sync diário…");
    const meta = await syncMetaDaily({ since: START, until: END }, u.id);
    console.log(
      `  Meta: ${meta.gravados} linhas · gasto R$ ${meta.totais?.gasto} · cliques ${meta.totais?.cliques}` +
        (meta.erros?.length ? ` · avisos ${meta.erros.length}` : ""),
    );

    // 2) Shopee em chunks (regra >30s entre queries sem scrollId)
    console.log("\n[2/3] Shopee conversionReport em chunks de", CHUNK_DAYS, "dias…");
    const ranges = chunkRanges(START, END, CHUNK_DAYS);
    const seen = new Set();
    const nodes = [];
    let totalPages = 0;

    for (let i = 0; i < ranges.length; i++) {
      const [a, b] = ranges[i];
      if (i > 0) {
        console.log(`  aguardando ${Math.round(GAP_MS / 1000)}s (throttle Shopee)…`);
        await sleep(GAP_MS);
      }
      console.log(`  chunk ${i + 1}/${ranges.length}: ${a} → ${b}`);
      const pulled = await pullConversionReport(a, b);
      totalPages += pulled.pages || 0;
      let added = 0;
      for (const n of pulled.nodes || []) {
        const k = nodeKey(n);
        if (seen.has(k)) continue;
        seen.add(k);
        nodes.push(n);
        added += 1;
      }
      console.log(`    +${added} nodes (bruto ${pulled.nodes.length}) · acumulado ${nodes.length}`);
    }

    // 3) Agrega (totalCommission) + enrich Meta + grava Supabase
    console.log("\n[3/3] Agregar + enrich + gravar Supabase…");
    const agg = aggregateReport(nodes);
    let dash = {
      range: { startDate: START, endDate: END },
      nodes: nodes.length,
      pages: totalPages,
      kpis: agg.kpis,
      daily: agg.daily,
      subIds: agg.subIds,
      syncedAt: new Date().toISOString(),
    };
    dash = await enrichDashboardWithAds(dash, u.id);

    // Upsert daily (não apaga outros meses). SubIDs: upsert sem wipe total —
    // remove só o wipe destrutivo: grava snapshot completo do mês 7.
    await saveDashboardSnapshot(dash, u.id);
    await persistOrdersAndProducts({
      orders: agg.orders,
      orderItems: agg.orderItems,
      products: agg.products,
    }, u.id);

    // Conferência lendo do DB
    const sb = getSupabase();
    const { data: dailyDb } = await sb
      .from("daily_metrics")
      .select("data, faturamento, comissao, pedidos, inv_meta, lucro")
      .eq("user_id", u.id)
      .gte("data", START)
      .lte("data", END)
      .order("data");
    const { data: metaDb } = await sb
      .from("meta_ads_daily")
      .select("gasto, cliques, impressoes")
      .eq("user_id", u.id)
      .gte("data", START)
      .lte("data", END);

    const sum = (rows, key) => (rows || []).reduce((a, r) => a + Number(r[key] || 0), 0);
    const daysWithSales = (dailyDb || []).filter((d) => Number(d.comissao) > 0 || Number(d.pedidos) > 0).length;

    console.log("\n=== RESULTADO JULHO", YEAR, "===");
    console.log("Shopee nodes únicos:", nodes.length);
    console.log("Dias com métrica no DB:", (dailyDb || []).length, "| com venda:", daysWithSales);
    console.log("Faturamento:", Number(dash.kpis.faturamento).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
    console.log("Comissão:   ", Number(dash.kpis.comissao).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
    console.log("Pedidos:    ", dash.kpis.pedidos);
    console.log("Cliques Shopee:", dash.kpis.cliques_shopee);
    console.log("Inv. Meta:  ", Number(dash.kpis.inv_meta).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
    console.log("Cliques Meta:", dash.kpis.cliques_meta);
    console.log("Impressões: ", dash.kpis.impressoes);
    console.log("Lucro:      ", Number(dash.kpis.lucro).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
    console.log("ROI:        ", dash.kpis.roi != null ? `${dash.kpis.roi}%` : "—");
    console.log("DB daily fat/com:", sum(dailyDb, "faturamento").toFixed(2), "/", sum(dailyDb, "comissao").toFixed(2));
    console.log("DB meta gasto/cliques:", sum(metaDb, "gasto").toFixed(2), "/", sum(metaDb, "cliques"));
    console.log("SubIDs:", (dash.subIds || []).length);

    if (!nodes.length) {
      console.warn("\n⚠️ Nenhum node Shopee em julho — verifique se o ano está correto.");
      process.exitCode = 2;
    }
    if (!(dash.kpis.inv_meta > 0) && !(meta.gravados > 0)) {
      console.warn("\n⚠️ Meta sem linhas/gasto no período.");
    }
    console.log("\nPronto. No painel: período 01/07 → 31/07/" + YEAR + " (sem force usa cache do DB).\n");
  });
}

main().catch((e) => {
  console.error("\nFALHA:", e.message || e);
  process.exit(1);
});
