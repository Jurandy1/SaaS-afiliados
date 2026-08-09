"use strict";

const {
  pullConversionReport,
  classifyStatus,
  parseMoney,
  parseSubId,
  dateFromPurchaseTs,
} = require("./shopee");
const { saveDashboardSnapshot, persistOrdersAndProducts } = require("./store");
const { enrichDashboardWithAds } = require("./finance");

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
  const orders = [];
  const items = [];
  const products = {};

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

    const nodeOrders = Array.isArray(node.orders) ? node.orders : [];
    nodeOrders.forEach((order, idx) => {
      const orderId = String(order.orderId || `${node.conversionId}_${idx}`);
      if (orderSeen.has(orderId)) return;
      orderSeen.add(orderId);

      const status = classifyStatus(order.orderStatus);
      let orderItems = Array.isArray(order.items) ? order.items : [];
      // Se a API não trouxer items, monta um item sintético pelo nó da conversão
      if (!orderItems.length) {
        orderItems = [{
          itemId: `conv_${node.conversionId || orderId}`,
          itemName: `Pedido ${orderId}`,
          shopName: "",
          qty: 1,
          actualAmount: 0,
          itemTotalCommission: node.netCommission || node.totalCommission || 0,
        }];
      }
      let fat = 0;
      let com = 0;
      let qty = 0;
      for (const it of orderItems) {
        const itFat = parseMoney(it.actualAmount);
        const itCom = parseMoney(it.itemTotalCommission);
        const itQty = Number(it.qty || 0) || 0;
        fat += itFat;
        com += itCom;
        qty += itQty;
        const itemId = String(it.itemId || "").trim() || `unknown_${orderId}`;
        const itemName = String(it.itemName || "").slice(0, 200) || `Pedido ${orderId}`;
        const shopName = String(it.shopName || "").slice(0, 120);
        items.push({
          id: `${orderId}_${itemId}`,
          order_id: orderId,
          item_id: itemId,
          item_name: itemName,
          shop_name: shopName,
          qty: itQty,
          faturamento: itFat,
          comissao: itCom,
          data: date,
          subid,
        });
        if (!products[itemId]) {
          products[itemId] = {
            item_id: itemId,
            item_name: itemName,
            shop_name: shopName,
            faturamento: 0,
            comissao: 0,
            pedidos: 0,
            qty: 0,
          };
        }
        products[itemId].faturamento += itFat;
        products[itemId].comissao += itCom;
        products[itemId].qty += itQty;
        products[itemId].pedidos += 1;
      }
      if (com <= 0) com = parseMoney(node.netCommission || node.totalCommission);
      if (fat <= 0 && com > 0) {
        // redistribui comissão no único item quando amount veio zerado
        const only = items.filter((x) => x.order_id === orderId);
        if (only.length === 1) {
          only[0].comissao = com;
          const pid = only[0].item_id;
          if (products[pid] && products[pid].comissao <= 0) products[pid].comissao = com;
        }
      }

      orders.push({
        order_id: orderId,
        conversion_id: String(node.conversionId || ""),
        data: date,
        subid,
        status,
        faturamento: round2(fat),
        comissao: round2(com),
      });

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

  const productList = Object.values(products)
    .map((p) => ({
      ...p,
      faturamento: round2(p.faturamento),
      comissao: round2(p.comissao),
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
    orders,
    orderItems: items,
    products: productList,
  };
}

async function buildDashboard({ startDate, endDate, persist = true }) {
  const { nodes, pages } = await pullConversionReport(startDate, endDate);
  const agg = aggregateReport(nodes);
  let dash = {
    range: { startDate, endDate },
    nodes: nodes.length,
    pages,
    kpis: agg.kpis,
    daily: agg.daily,
    subIds: agg.subIds,
    syncedAt: new Date().toISOString(),
  };

  if (persist) {
    try {
      await saveDashboardSnapshot(dash);
      await persistOrdersAndProducts({
        orders: agg.orders,
        orderItems: agg.orderItems,
        products: agg.products,
      });
    } catch (err) {
      console.warn("[metrics] falha ao gravar Supabase:", err.message || err);
    }
  }

  try {
    dash = await enrichDashboardWithAds(dash);
  } catch (err) {
    console.warn("[metrics] finance enrich:", err.message || err);
  }

  // keep lists for API consumers without bloating sync_runs
  dash.ordersPreview = (agg.orders || []).slice(0, 200);
  dash.productsPreview = (agg.products || []).slice(0, 100);

  return dash;
}

module.exports = { buildDashboard, aggregateReport };
