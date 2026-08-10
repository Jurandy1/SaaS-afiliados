"use strict";

const { getSupabase } = require("./supabase");
const { loadMetaSpendByDay } = require("./meta");
const { loadPinSpendByDay } = require("./pinterest");
const { requireUserId } = require("./auth");
const { loadSettings } = require("./store");
const { loadSubidOps, applyOpsToSubIds } = require("./subidOps");

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

function sumSpend(rows) {
  const byDay = {};
  const bySub = {};
  const bySubDay = {};
  for (const r of rows || []) {
    const day = r.data;
    const sub = String(r.subid || "").trim().toLowerCase() || "semsubid";
    const g = Number(r.gasto || 0);
    if (day) {
      byDay[day] = (byDay[day] || 0) + g;
      const sk = `${sub}|${day}`;
      bySubDay[sk] = (bySubDay[sk] || 0) + g;
    }
    bySub[sub] = (bySub[sub] || 0) + g;
  }
  return { byDay, bySub, bySubDay };
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

/**
 * Cruza comissão Shopee (daily/subid já no dash) com gasto Meta+Pin.
 * Atualiza colunas inv_* / lucro / roi no Supabase e devolve kpis enriquecidos.
 */
async function enrichDashboardWithAds(dash, userId = requireUserId()) {
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
      if (fin.inv_meta > 0 && fin.inv_pin <= 0) canal = "meta";
      else if (fin.inv_pin > 0 && fin.inv_meta <= 0) canal = "pinterest";
      else if (fin.inv_meta <= 0 && fin.inv_pin <= 0) canal = "organico";
      else canal = "meta";
    }
    const status = r.status || (fin.lucro < 0 ? "pausada" : "ativa");
    return {
      ...r,
      ...fin,
      daily: dailyRows,
      canal,
      status,
    };
  });

  const invMeta = round2(daily.reduce((a, d) => a + Number(d.inv_meta || 0), 0));
  const invPin = round2(daily.reduce((a, d) => a + Number(d.inv_pin || 0), 0));
  const comissao = Number(dash.kpis?.comissao || 0);
  const kpisFin = calcLucroRoi(comissao, invMeta, invPin, tax);
  const fat = Number(dash.kpis?.faturamento || 0);
  const abatimento = fat > 0 ? round2((comissao / fat) * 100) : Number(dash.kpis?.abatimento || 0);

  const kpis = {
    ...(dash.kpis || {}),
    ...kpisFin,
    abatimento,
    taxRate: Number(tax.taxRate || 0),
    metaTaxRate: Number(tax.metaTaxRate != null ? tax.metaTaxRate : 12),
  };

  try {
    const supabase = getSupabase();
    const now = new Date().toISOString();
    if (daily.length) {
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
    if (subIds.length) {
      await supabase.from("subid_metrics").upsert(
        subIds.map((r) => ({
          user_id: userId,
          subid: r.subid,
          faturamento: r.faturamento || 0,
          comissao: r.comissao || 0,
          pedidos: r.pedidos || 0,
          concluidos: r.concluidos || 0,
          pendentes: r.pendentes || 0,
          cancelados: r.cancelados || 0,
          unpaid: r.unpaid || 0,
          inv_meta: r.inv_meta,
          inv_pin: r.inv_pin,
          inv_total: r.inv_total,
          lucro: r.lucro,
          roi: r.roi != null ? r.roi : 0,
          updated_at: now,
        })),
        { onConflict: "user_id,subid" }
      );
    }
  } catch (e) {
    console.warn("[finance] persist:", e.message);
  }

  return {
    ...dash,
    daily,
    subIds: applyOpsToSubIds(subIds, await loadSubidOps(userId)),
    kpis,
    tax,
  };
}

module.exports = { enrichDashboardWithAds, sumSpend, calcLucroRoi };
