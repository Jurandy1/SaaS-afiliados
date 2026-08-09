"use strict";

const {
  pullConversionReport,
  classifyStatus,
  parseMoney,
  parseSubId,
  dateFromPurchaseTs,
} = require("./shopee");
const { saveDashboardSnapshot } = require("./store");

function emptyDay(date) {
  return {
    data: date,
    faturamento: 0,
    comissao: 0,
    pedidos: 0,
    concluidos: 0,
    pendentes: 0,
    cancelados: 0,
    unpaid: 0,
  };
}

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

function aggregateReport(nodes) {
  const byDay = {};
  const bySubId = {};
  const orderSeen = new Set();

  let faturamento = 0;
  let comissao = 0;
  let pedidos = 0;
  let concluidos = 0;
  let pendentes = 0;
  let cancelados = 0;
  let unpaid = 0;

  for (const node of nodes || []) {
    const subid = parseSubId(node.utmContent);
    const date = dateFromPurchaseTs(node.purchaseTime);
    if (!byDay[date]) byDay[date] = emptyDay(date);
    if (!bySubId[subid]) {
      bySubId[subid] = {
        subid,
        faturamento: 0,
        comissao: 0,
        pedidos: 0,
        concluidos: 0,
        pendentes: 0,
        cancelados: 0,
        itens: 0,
      };
    }

    const orders = Array.isArray(node.orders) ? node.orders : [];
    orders.forEach((order, idx) => {
      const orderId = String(order.orderId || `${node.conversionId}_${idx}`);
      if (orderSeen.has(orderId)) return;
      orderSeen.add(orderId);

      const status = classifyStatus(order.orderStatus);
      const items = Array.isArray(order.items) ? order.items : [];
      let fat = 0;
      let com = 0;
      let qty = 0;
      for (const it of items) {
        fat += parseMoney(it.actualAmount);
        com += parseMoney(it.itemTotalCommission);
        qty += Number(it.qty || 0) || 0;
      }
      if (com <= 0) com = parseMoney(node.netCommission || node.totalCommission);

      pedidos += 1;
      byDay[date].pedidos += 1;
      bySubId[subid].pedidos += 1;
      bySubId[subid].itens += qty;

      if (status === "cancelada") {
        cancelados += 1;
        byDay[date].cancelados += 1;
        bySubId[subid].cancelados += 1;
        return;
      }
      if (status === "unpaid") {
        unpaid += 1;
        byDay[date].unpaid += 1;
        return;
      }

      faturamento += fat;
      comissao += com;
      byDay[date].faturamento += fat;
      byDay[date].comissao += com;
      bySubId[subid].faturamento += fat;
      bySubId[subid].comissao += com;

      if (status === "concluida") {
        concluidos += 1;
        byDay[date].concluidos += 1;
        bySubId[subid].concluidos += 1;
      } else {
        pendentes += 1;
        byDay[date].pendentes += 1;
        bySubId[subid].pendentes += 1;
      }
    });
  }

  const daily = Object.values(byDay).sort((a, b) => a.data.localeCompare(b.data));
  const subIds = Object.values(bySubId)
    .map((r) => ({
      ...r,
      faturamento: round2(r.faturamento),
      comissao: round2(r.comissao),
      abatimento: r.faturamento > 0 ? round2((r.comissao / r.faturamento) * 100) : 0,
    }))
    .sort((a, b) => b.comissao - a.comissao);

  return {
    kpis: {
      faturamento: round2(faturamento),
      comissao: round2(comissao),
      pedidos,
      concluidos,
      pendentes,
      cancelados,
      unpaid,
      abatimento: faturamento > 0 ? round2((comissao / faturamento) * 100) : 0,
      subIdsCount: subIds.length,
    },
    daily: daily.map((d) => ({
      ...d,
      faturamento: round2(d.faturamento),
      comissao: round2(d.comissao),
    })),
    subIds,
  };
}

async function buildDashboard({ startDate, endDate, persist = true }) {
  const { nodes, pages } = await pullConversionReport(startDate, endDate);
  const agg = aggregateReport(nodes);
  const dash = {
    range: { startDate, endDate },
    nodes: nodes.length,
    pages,
    ...agg,
    syncedAt: new Date().toISOString(),
  };
  if (persist) {
    try {
      await saveDashboardSnapshot(dash);
    } catch (err) {
      console.warn("[metrics] falha ao gravar Supabase:", err.message || err);
    }
  }
  return dash;
}

module.exports = { buildDashboard, aggregateReport };
