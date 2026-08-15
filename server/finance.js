"use strict";

const { getSupabase } = require("./supabase");
const { loadMetaSpendByDay } = require("./meta");
const { loadPinSpendByDay } = require("./pinterest");
const { requireUserId } = require("./auth");
const { loadSettings } = require("./store");
const { loadSubidOps, applyOpsToSubIds, inferCanal } = require("./subidOps");

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

function sumSpend(rows) {
  const byDay = {};
  const bySub = {};
  const bySubDay = {};
  const clicksBySub = {};
  const clicksBySubDay = {};
  const impressoesBySub = {};
  const alcanceBySub = {};
  const spendClicksBySub = {}; // for weighted CPC
  for (const r of rows || []) {
    const day = r.data;
    const sub = String(r.subid || "").trim().toLowerCase() || "semsubid";
    const g = Number(r.gasto || 0);
    const clicks = Number(r.cliques || 0);
    const impressoes = Number(r.impressoes || 0);
    const alcance = Number(r.alcance || 0);
    if (day) {
      byDay[day] = (byDay[day] || 0) + g;
      const sk = `${sub}|${day}`;
      bySubDay[sk] = (bySubDay[sk] || 0) + g;
      clicksBySubDay[sk] = (clicksBySubDay[sk] || 0) + clicks;
    }
    bySub[sub] = (bySub[sub] || 0) + g;
    clicksBySub[sub] = (clicksBySub[sub] || 0) + clicks;
    impressoesBySub[sub] = (impressoesBySub[sub] || 0) + impressoes;
    alcanceBySub[sub] = (alcanceBySub[sub] || 0) + alcance;
    if (!spendClicksBySub[sub]) spendClicksBySub[sub] = { spend: 0, clicks: 0, impressoes: 0 };
    spendClicksBySub[sub].spend += g;
    spendClicksBySub[sub].clicks += clicks;
    spendClicksBySub[sub].impressoes += impressoes;
  }
  return { byDay, bySub, bySubDay, clicksBySub, clicksBySubDay, impressoesBySub, alcanceBySub, spendClicksBySub };
}

/**
 * Mesma lógica do painel de referência:
 * investMetaT = invMeta * (1 + metaTax%)
 * investTotal = investMetaT + invPin   ← este é o invest exibido e o denominador do ROI
 * comissaoLiquida = comissao * (1 - govTax%)
 * lucro = comissaoLiquida - investTotal
 * roi = lucro / investTotal  (em %)
 */
function calcLucroRoi(comissao, invMetaRaw, invPinRaw, tax) {
  const gov = Number(tax?.taxRate || 0) / 100;
  const metaTax = Number(tax?.metaTaxRate != null ? tax.metaTaxRate : 12) / 100;
  const invMeta = Number(invMetaRaw || 0);
  const invPin = Number(invPinRaw || 0);
  const invMetaTaxed = invMeta * (1 + metaTax);
  const invForRoi = invMetaTaxed + invPin;
  const comissaoLiq = Number(comissao || 0) * (1 - gov);
  const lucro = round2(comissaoLiq - invForRoi);
  const roi = invForRoi > 0 ? round2((lucro / invForRoi) * 100) : null;
  return {
    inv_meta: round2(invMeta),
    inv_pin: round2(invPin),
    inv_meta_taxed: round2(invMetaTaxed),
    inv_total_bruto: round2(invMeta + invPin),
    // investTotal do referência = Meta com imposto + Pin bruto
    inv_total: round2(invForRoi),
    comissao_liquida: round2(comissaoLiq),
    lucro,
    roi,
  };
}

function reconcileSubIdsToPeriod(subIds, start, end, tax) {
  if (!start || !end) return subIds || [];
  return (subIds || []).map((sub) => {
    const allDaily = sub.daily || [];
    const days = allDaily.filter((d) => d.data >= start && d.data <= end);

    if (!days.length) {
      const invM = Number(sub.inv_meta || 0);
      const invP = Number(sub.inv_pin || 0);
      if (invM > 0 || invP > 0) {
        const fin = calcLucroRoi(0, invM, invP, tax);
        const clM = Number(sub.cliques_meta || 0);
        const clP = Number(sub.cliques_pin || 0);
        return {
          ...sub,
          faturamento: 0,
          comissao: 0,
          pedidos: 0,
          concluidos: 0,
          pendentes: 0,
          cancelados: 0,
          cliques_shopee: 0,
          cliques_meta: clM,
          cliques_pin: clP,
          cliques_ads: clM + clP,
          abatimento: null,
          abatimento_cliques: null,
          ...fin,
        };
      }
      return {
        ...sub,
        faturamento: 0,
        comissao: 0,
        pedidos: 0,
        concluidos: 0,
        pendentes: 0,
        cancelados: 0,
        lucro: 0,
        roi: null,
        abatimento: null,
        cliques_shopee: 0,
      };
    }

    const agg = {
      faturamento: 0,
      comissao: 0,
      pedidos: 0,
      concluidos: 0,
      pendentes: 0,
      cancelados: 0,
      inv_meta: 0,
      inv_pin: 0,
      cliques_meta: 0,
      cliques_pin: 0,
      cliques_shopee: 0,
    };
    for (const d of days) {
      agg.faturamento += Number(d.faturamento || 0);
      agg.comissao += Number(d.comissao || 0);
      agg.pedidos += Number(d.pedidos || 0);
      agg.concluidos += Number(d.concluidos || 0);
      agg.pendentes += Number(d.pendentes || 0);
      agg.cancelados += Number(d.cancelados || 0);
      agg.inv_meta += Number(d.inv_meta || 0);
      agg.inv_pin += Number(d.inv_pin || 0);
      agg.cliques_meta += Number(d.cliques_meta || 0);
      agg.cliques_pin += Number(d.cliques_pin || 0);
      agg.cliques_shopee += Number(d.cliques_shopee || 0);
    }

    let cliquesShopee = agg.cliques_shopee;

    const fin = calcLucroRoi(agg.comissao, agg.inv_meta, agg.inv_pin, tax);
    const fat = round2(agg.faturamento);
    const com = round2(agg.comissao);
    const clAds = agg.cliques_meta + agg.cliques_pin;
    let abatimentoCliques = null;
    if (cliquesShopee > 0 && clAds > 0) {
      abatimentoCliques = round2((cliquesShopee / clAds) * 100);
    }

    return {
      ...sub,
      faturamento: fat,
      comissao: com,
      pedidos: agg.pedidos,
      concluidos: agg.concluidos,
      pendentes: agg.pendentes,
      cancelados: agg.cancelados,
      inv_meta: fin.inv_meta,
      inv_pin: fin.inv_pin,
      inv_meta_taxed: fin.inv_meta_taxed,
      inv_total: fin.inv_total,
      lucro: fin.lucro,
      roi: fin.roi,
      cliques_meta: agg.cliques_meta,
      cliques_pin: agg.cliques_pin,
      cliques_ads: clAds,
      cliques_shopee: cliquesShopee,
      abatimento: fat > 0 ? round2((com / fat) * 100) : null,
      abatimento_cliques: abatimentoCliques,
    };
  });
}

/**
 * Cruza comissão Shopee (daily/subid já no dash) com gasto Meta+Pin.
 * Atualiza colunas inv_* / lucro / roi no Supabase e devolve kpis enriquecidos.
 */
async function enrichDashboardWithAds(dash, userId = requireUserId(), { persistSubIds = true, persistDaily = true } = {}) {
  const start = dash.range?.startDate;
  const end = dash.range?.endDate;
  if (!start || !end) return dash;

  let tax = { taxRate: 11.7, metaTaxRate: 12 };
  try {
    tax = await loadSettings(userId);
  } catch (e) {
    console.warn("[finance] settings:", e.message);
  }

  let metaRows = [];
  let pinRows = [];
  try {
    metaRows = await loadMetaSpendByDay(start, end, userId);
  } catch (e) {
    console.warn("[finance] meta:", e.message);
  }
  try {
    pinRows = await loadPinSpendByDay(start, end, userId);
  } catch (e) {
    console.warn("[finance] pin:", e.message);
  }

  const meta = sumSpend(metaRows);
  const pin = sumSpend(pinRows);

  const daily = (dash.daily || []).map((d) => {
    const invMeta = meta.byDay[d.data] || 0;
    const invPin = pin.byDay[d.data] || 0;
    const fin = calcLucroRoi(d.comissao, invMeta, invPin, tax);
    const fat = Number(d.faturamento || 0);
    const com = Number(d.comissao || 0);
    const abatimento = fat > 0 ? round2((com / fat) * 100) : null;
    return { ...d, ...fin, abatimento };
  });

  const subIds = (dash.subIds || []).map((r) => {
    const key = String(r.subid || "").trim().toLowerCase();
    const invMeta = meta.bySub[key] || 0;
    const invPin = pin.bySub[key] || 0;
    const fin = calcLucroRoi(r.comissao, invMeta, invPin, tax);
    const dailyRows = (r.daily || []).map((d) => {
      const sk = `${key}|${d.data}`;
      const dFin = calcLucroRoi(d.comissao, meta.bySubDay[sk] || 0, pin.bySubDay[sk] || 0, tax);
      return { ...d, ...dFin };
    });
    let canal = r.canal || null;
    if (!canal) {
      canal = inferCanal(r.subid, fin.inv_meta, fin.inv_pin);
    }
    const status = r.status || (fin.lucro < 0 ? "desativada" : "ativa");
    const cliquesMeta = meta.clicksBySub[key] || 0;
    const cliquesPin = pin.clicksBySub[key] || 0;
    const cliquesAds = cliquesMeta + cliquesPin;
    const cliquesShopee = r.cliques_shopee != null ? Number(r.cliques_shopee) : null;
    const impressoes = meta.impressoesBySub[key] || 0;
    const alcance = meta.alcanceBySub[key] || 0;
    const metaAgg = meta.spendClicksBySub[key] || { spend: 0, clicks: 0, impressoes: 0 };
    const cpc = metaAgg.clicks > 0 ? round2(metaAgg.spend / metaAgg.clicks) : null;
    const ctr = metaAgg.impressoes > 0 ? round2((metaAgg.clicks / metaAgg.impressoes) * 100) : null;
    let abatimentoCliques = null;
    if (cliquesShopee != null && cliquesAds > 0) {
      abatimentoCliques = round2((cliquesShopee / cliquesAds) * 100);
    }
    return {
      ...r,
      ...fin,
      daily: dailyRows,
      canal,
      status,
      cliques_meta: cliquesMeta,
      cliques_pin: cliquesPin,
      cliques_ads: cliquesAds,
      cliques_shopee: cliquesShopee,
      abatimento_cliques: abatimentoCliques,
      impressoes,
      alcance,
      cpc_meta: cpc,
      ctr_meta: ctr,
    };
  });

  const invMeta = round2(daily.reduce((a, d) => a + Number(d.inv_meta || 0), 0));
  const invPin = round2(daily.reduce((a, d) => a + Number(d.inv_pin || 0), 0));
  const comissao = Number(dash.kpis?.comissao || 0);
  const kpisFin = calcLucroRoi(comissao, invMeta, invPin, tax);
  const fat = Number(dash.kpis?.faturamento || 0);
  const abatimento = fat > 0 ? round2((comissao / fat) * 100) : Number(dash.kpis?.abatimento || 0);

  // Totais de mídia a partir das linhas brutas (não só SubIDs com venda Shopee)
  const cliquesMetaTotal = metaRows.reduce((a, r) => a + Number(r.cliques || 0), 0);
  const impressoesTotal = metaRows.reduce((a, r) => a + Number(r.impressoes || 0), 0);
  const alcanceTotal = metaRows.reduce((a, r) => a + Number(r.alcance || 0), 0);
  const cliquesPinTotal = pinRows.reduce((a, r) => a + Number(r.cliques || 0), 0);
  const cliquesShopeeTotal = subIds.reduce((a, r) => a + Number(r.cliques_shopee || 0), 0);
  const cliquesAdsTotal = cliquesMetaTotal + cliquesPinTotal;
  const cpcMeta = cliquesMetaTotal > 0 ? round2(invMeta / cliquesMetaTotal) : null;
  const ctrMeta = impressoesTotal > 0 ? round2((cliquesMetaTotal / impressoesTotal) * 100) : null;
  let abatimentoCliquesKpi = null;
  if (cliquesShopeeTotal > 0 && cliquesAdsTotal > 0) {
    abatimentoCliquesKpi = round2((cliquesShopeeTotal / cliquesAdsTotal) * 100);
  } else if (cliquesShopeeTotal > 0 && cliquesMetaTotal > 0) {
    abatimentoCliquesKpi = round2((cliquesShopeeTotal / cliquesMetaTotal) * 100);
  }

  const kpis = {
    ...(dash.kpis || {}),
    ...kpisFin,
    abatimento,
    taxRate: Number(tax.taxRate || 0),
    metaTaxRate: Number(tax.metaTaxRate != null ? tax.metaTaxRate : 12),
    cliques_meta: cliquesMetaTotal,
    cliques_pin: cliquesPinTotal,
    cliques_ads: cliquesAdsTotal,
    cliques_shopee: cliquesShopeeTotal,
    impressoes: impressoesTotal,
    alcance: alcanceTotal,
    cpc_meta: cpcMeta,
    ctr_meta: ctrMeta,
    abatimento_cliques: abatimentoCliquesKpi,
  };

  // Inclui SubIDs só com gasto Meta/Pin (sem venda Shopee no período) para não perder cliques
  const seenSubs = new Set(subIds.map((r) => String(r.subid || "").trim().toLowerCase()));
  const orphanSubs = [];
  for (const [sub, spend] of Object.entries(meta.bySub)) {
    if (!sub || seenSubs.has(sub) || !(spend > 0)) continue;
    const fin = calcLucroRoi(0, spend, pin.bySub[sub] || 0, tax);
    const cliquesMeta = meta.clicksBySub[sub] || 0;
    const cliquesPin = pin.clicksBySub[sub] || 0;
    const impressoes = meta.impressoesBySub[sub] || 0;
    const alcance = meta.alcanceBySub[sub] || 0;
    const metaAgg = meta.spendClicksBySub[sub] || { spend: 0, clicks: 0, impressoes: 0 };
    orphanSubs.push({
      subid: sub,
      faturamento: 0,
      comissao: 0,
      pedidos: 0,
      concluidos: 0,
      pendentes: 0,
      cancelados: 0,
      unpaid: 0,
      itens: 0,
      abatimento: null,
      cliques_shopee: 0,
      cliques_meta: cliquesMeta,
      cliques_pin: cliquesPin,
      cliques_ads: cliquesMeta + cliquesPin,
      impressoes,
      alcance,
      cpc_meta: metaAgg.clicks > 0 ? round2(metaAgg.spend / metaAgg.clicks) : null,
      ctr_meta: metaAgg.impressoes > 0 ? round2((metaAgg.clicks / metaAgg.impressoes) * 100) : null,
      abatimento_cliques: null,
      canal: inferCanal(sub, spend, pin.bySub[sub] || 0),
      status: "ativa",
      daily: [],
      ...fin,
    });
    seenSubs.add(sub);
  }
  for (const [sub, spend] of Object.entries(pin.bySub)) {
    if (!sub || seenSubs.has(sub) || !(spend > 0)) continue;
    const fin = calcLucroRoi(0, 0, spend, tax);
    const cliquesPin = pin.clicksBySub[sub] || 0;
    orphanSubs.push({
      subid: sub,
      faturamento: 0,
      comissao: 0,
      pedidos: 0,
      concluidos: 0,
      pendentes: 0,
      cancelados: 0,
      unpaid: 0,
      itens: 0,
      abatimento: null,
      cliques_shopee: 0,
      cliques_meta: 0,
      cliques_pin: cliquesPin,
      cliques_ads: cliquesPin,
      impressoes: 0,
      alcance: 0,
      cpc_meta: null,
      ctr_meta: null,
      abatimento_cliques: null,
      canal: "pinterest",
      status: "ativa",
      daily: [],
      ...fin,
    });
  }

  const subIdsAll = reconcileSubIdsToPeriod(
    orphanSubs.length ? subIds.concat(orphanSubs) : subIds,
    start,
    end,
    tax,
  );
  kpis.cliques_shopee = subIdsAll.reduce((a, r) => a + Number(r.cliques_shopee || 0), 0);
  if (kpis.cliques_shopee > 0 && Number(kpis.cliques_ads || 0) > 0) {
    kpis.abatimento_cliques = round2((kpis.cliques_shopee / Number(kpis.cliques_ads)) * 100);
  } else if (kpis.cliques_shopee > 0 && Number(kpis.cliques_meta || 0) > 0) {
    kpis.abatimento_cliques = round2((kpis.cliques_shopee / Number(kpis.cliques_meta)) * 100);
  } else {
    kpis.abatimento_cliques = null;
  }

  try {
    const supabase = getSupabase();
    const now = new Date().toISOString();
    if (persistDaily && daily.length) {
      await supabase.from("daily_metrics").upsert(
        daily.map((d) => ({
          user_id: userId,
          data: d.data,
          faturamento: d.faturamento || 0,
          comissao: d.comissao || 0,
          pedidos: d.pedidos || 0,
          concluidos: d.concluidos || 0,
          pendentes: d.pendentes || 0,
          cancelados: d.cancelados || 0,
          unpaid: d.unpaid || 0,
          inv_meta: d.inv_meta,
          inv_pin: d.inv_pin,
          inv_total: d.inv_total,
          lucro: d.lucro,
          roi: d.roi,
          updated_at: now,
        })),
        { onConflict: "user_id,data" }
      );
    }
    if (persistSubIds && subIdsAll.length) {
      const rows = subIdsAll.map((r) => ({
        user_id: userId,
        subid: r.subid,
        faturamento: r.faturamento || 0,
        comissao: r.comissao || 0,
        pedidos: r.pedidos || 0,
        concluidos: r.concluidos || 0,
        pendentes: r.pendentes || 0,
        cancelados: r.cancelados || 0,
        unpaid: r.unpaid || 0,
        cliques_shopee: r.cliques_shopee != null ? Number(r.cliques_shopee) : 0,
        inv_meta: r.inv_meta,
        inv_pin: r.inv_pin,
        inv_total: r.inv_total,
        lucro: r.lucro,
        roi: r.roi != null ? r.roi : 0,
        updated_at: now,
      }));
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await supabase.from("subid_metrics").upsert(rows.slice(i, i + 200), {
          onConflict: "user_id,subid",
        });
        if (error) throw error;
      }
    }
  } catch (e) {
    console.warn("[finance] persist:", e.message);
  }

  return {
    ...dash,
    daily,
    subIds: applyOpsToSubIds(subIdsAll, await loadSubidOps(userId)),
    kpis,
    tax,
  };
}

module.exports = { enrichDashboardWithAds, sumSpend, calcLucroRoi, reconcileSubIdsToPeriod };
