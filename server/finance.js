"use strict";

const { getSupabase } = require("./supabase");
const { loadMetaSpendByDay } = require("./meta");
const { loadPinSpendByDay } = require("./pinterest");

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

function sumSpend(rows) {
  const byDay = {};
  const bySub = {};
  for (const r of rows || []) {
    const day = r.data;
    const sub = String(r.subid || "").trim().toLowerCase() || "semsubid";
    const g = Number(r.gasto || 0);
    if (day) {
      byDay[day] = (byDay[day] || 0) + g;
    }
    bySub[sub] = (bySub[sub] || 0) + g;
  }
  return { byDay, bySub };
}

/**
 * Cruza comissão Shopee (daily/subid já no dash) com gasto Meta+Pin.
 * Atualiza colunas inv_* / lucro / roi no Supabase e devolve kpis enriquecidos.
 */
async function enrichDashboardWithAds(dash) {
  const start = dash.range?.startDate;
  const end = dash.range?.endDate;
  if (!start || !end) return dash;

  let metaRows = [];
  let pinRows = [];
  try {
    metaRows = await loadMetaSpendByDay(start, end);
  } catch (e) {
    console.warn("[finance] meta:", e.message);
  }
  try {
    pinRows = await loadPinSpendByDay(start, end);
  } catch (e) {
    console.warn("[finance] pin:", e.message);
  }

  const meta = sumSpend(metaRows);
  const pin = sumSpend(pinRows);

  const daily = (dash.daily || []).map((d) => {
    const invMeta = round2(meta.byDay[d.data] || 0);
    const invPin = round2(pin.byDay[d.data] || 0);
    const invTotal = round2(invMeta + invPin);
    const comissao = Number(d.comissao || 0);
    const lucro = round2(comissao - invTotal);
    const roi = invTotal > 0 ? round2((lucro / invTotal) * 100) : null;
    return { ...d, inv_meta: invMeta, inv_pin: invPin, inv_total: invTotal, lucro, roi };
  });

  const subIds = (dash.subIds || []).map((r) => {
    const key = String(r.subid || "").trim().toLowerCase();
    const invMeta = round2(meta.bySub[key] || 0);
    const invPin = round2(pin.bySub[key] || 0);
    const invTotal = round2(invMeta + invPin);
    const comissao = Number(r.comissao || 0);
    const lucro = round2(comissao - invTotal);
    const roi = invTotal > 0 ? round2((lucro / invTotal) * 100) : null;
    return {
      ...r,
      inv_meta: invMeta,
      inv_pin: invPin,
      inv_total: invTotal,
      lucro,
      roi,
    };
  });

  const invMeta = round2(daily.reduce((a, d) => a + d.inv_meta, 0));
  const invPin = round2(daily.reduce((a, d) => a + d.inv_pin, 0));
  const invTotal = round2(invMeta + invPin);
  const comissao = Number(dash.kpis?.comissao || 0);
  const lucro = round2(comissao - invTotal);
  const roi = invTotal > 0 ? round2((lucro / invTotal) * 100) : null;

  const kpis = {
    ...(dash.kpis || {}),
    inv_meta: invMeta,
    inv_pin: invPin,
    inv_total: invTotal,
    lucro,
    roi,
  };

  // persist finance columns
  try {
    const supabase = getSupabase();
    const now = new Date().toISOString();
    if (daily.length) {
      await supabase.from("daily_metrics").upsert(
        daily.map((d) => ({
          data: d.data,
          faturamento: d.faturamento,
          comissao: d.comissao,
          pedidos: d.pedidos,
          concluidos: d.concluidos,
          pendentes: d.pendentes,
          cancelados: d.cancelados,
          unpaid: d.unpaid,
          inv_meta: d.inv_meta,
          inv_pin: d.inv_pin,
          inv_total: d.inv_total,
          lucro: d.lucro,
          roi: d.roi ?? 0,
          updated_at: now,
        })),
      );
    }
    if (subIds.length) {
      for (let i = 0; i < subIds.length; i += 200) {
        const chunk = subIds.slice(i, i + 200).map((r) => ({
          subid: r.subid,
          faturamento: r.faturamento,
          comissao: r.comissao,
          pedidos: r.pedidos,
          concluidos: r.concluidos,
          pendentes: r.pendentes,
          cancelados: r.cancelados,
          itens: r.itens || 0,
          abatimento: r.abatimento || 0,
          inv_meta: r.inv_meta,
          inv_pin: r.inv_pin,
          inv_total: r.inv_total,
          lucro: r.lucro,
          roi: r.roi ?? 0,
          updated_at: now,
        }));
        await supabase.from("subid_metrics").upsert(chunk);
      }
    }
  } catch (e) {
    console.warn("[finance] persist:", e.message);
  }

  return { ...dash, daily, subIds, kpis, ads: { metaRows: metaRows.length, pinRows: pinRows.length } };
}

module.exports = { enrichDashboardWithAds, sumSpend };
