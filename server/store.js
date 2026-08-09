"use strict";

const { getSupabase } = require("./supabase");
const { requireUserId } = require("./auth");

function maskSecret(secret) {
  const s = String(secret || "");
  if (s.length <= 8) return "••••••••";
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

async function loadCredentials(userId = requireUserId()) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("app_credentials")
    .select("app_id, secret, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data?.app_id && data?.secret) {
    return {
      appId: String(data.app_id).trim(),
      secret: String(data.secret).trim(),
      updatedAt: data.updated_at || null,
    };
  }
  return { appId: "", secret: "", updatedAt: null };
}

async function resetAllSyncedData(userId = requireUserId()) {
  const supabase = getSupabase();
  const { error: rpcErr } = await supabase.rpc("reset_shopee_data_for_user", { p_user_id: userId });
  if (!rpcErr) return;
  await supabase.from("sync_runs").delete().eq("user_id", userId);
  await supabase.from("daily_metrics").delete().eq("user_id", userId);
  await supabase.from("subid_metrics").delete().eq("user_id", userId);
  await supabase.from("order_items").delete().eq("user_id", userId);
  await supabase.from("orders").delete().eq("user_id", userId);
  await supabase.from("products").delete().eq("user_id", userId);
}

async function saveCredentials({ appId, secret }, userId = requireUserId()) {
  const payload = {
    appId: String(appId || "").trim(),
    secret: String(secret || "").trim(),
  };
  if (!payload.appId || !payload.secret) {
    throw new Error("APP_ID e SECRET são obrigatórios");
  }

  const prev = await loadCredentials(userId);
  const appChanged = prev.appId && prev.appId !== payload.appId;

  const supabase = getSupabase();
  const { error } = await supabase.from("app_credentials").upsert({
    user_id: userId,
    app_id: payload.appId,
    secret: payload.secret,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);

  let reset = false;
  if (appChanged) {
    await resetAllSyncedData(userId);
    reset = true;
  }

  return {
    appId: payload.appId,
    secretMasked: maskSecret(payload.secret),
    updatedAt: new Date().toISOString(),
    configured: true,
    reset,
  };
}

async function credentialsPublic(userId = requireUserId()) {
  const c = await loadCredentials(userId);
  return {
    configured: Boolean(c.appId && c.secret),
    appId: c.appId || "",
    secretMasked: c.secret ? maskSecret(c.secret) : "",
    updatedAt: c.updatedAt,
  };
}

async function saveDashboardSnapshot(dash, userId = requireUserId()) {
  const supabase = getSupabase();
  const now = new Date().toISOString();

  const dailyRows = (dash.daily || []).map((d) => ({
    user_id: userId,
    data: d.data,
    faturamento: d.faturamento,
    comissao: d.comissao,
    pedidos: d.pedidos,
    concluidos: d.concluidos,
    pendentes: d.pendentes,
    cancelados: d.cancelados,
    unpaid: d.unpaid,
    inv_meta: d.inv_meta || 0,
    inv_pin: d.inv_pin || 0,
    inv_total: d.inv_total || 0,
    lucro: d.lucro != null ? d.lucro : d.comissao || 0,
    roi: d.roi || 0,
    updated_at: now,
  }));
  if (dailyRows.length) {
    const { error } = await supabase.from("daily_metrics").upsert(dailyRows);
    if (error) throw new Error(`daily_metrics: ${error.message}`);
  }

  await supabase.from("subid_metrics").delete().eq("user_id", userId);
  const subRows = (dash.subIds || []).map((r) => ({
    user_id: userId,
    subid: r.subid,
    faturamento: r.faturamento,
    comissao: r.comissao,
    pedidos: r.pedidos,
    concluidos: r.concluidos,
    pendentes: r.pendentes,
    cancelados: r.cancelados,
    itens: r.itens || 0,
    abatimento: r.abatimento || 0,
    inv_meta: r.inv_meta || 0,
    inv_pin: r.inv_pin || 0,
    inv_total: r.inv_total || 0,
    lucro: r.lucro != null ? r.lucro : r.comissao || 0,
    roi: r.roi || 0,
    updated_at: now,
  }));
  if (subRows.length) {
    for (let i = 0; i < subRows.length; i += 200) {
      const chunk = subRows.slice(i, i + 200);
      const { error } = await supabase.from("subid_metrics").upsert(chunk);
      if (error) throw new Error(`subid_metrics: ${error.message}`);
    }
  }

  const { error: runErr } = await supabase.from("sync_runs").insert({
    user_id: userId,
    start_date: dash.range?.startDate,
    end_date: dash.range?.endDate,
    nodes: dash.nodes || 0,
    pages: dash.pages || 0,
    kpis: dash.kpis || {},
    synced_at: dash.syncedAt || now,
  });
  if (runErr) throw new Error(`sync_runs: ${runErr.message}`);
}

async function persistOrdersAndProducts({ orders, orderItems, products }, userId = requireUserId()) {
  const supabase = getSupabase();
  const now = new Date().toISOString();

  function dedupeBy(rows, keyFn) {
    const map = new Map();
    for (const row of rows || []) {
      const k = keyFn(row);
      if (!k) continue;
      map.set(k, row);
    }
    return [...map.values()];
  }

  const ordersUnique = dedupeBy(orders, (o) => String(o.order_id || ""));
  const itemsUnique = dedupeBy(orderItems, (o) => String(o.id || `${o.order_id}_${o.item_id}`));
  const productsUnique = dedupeBy(products, (p) => String(p.item_id || ""));

  if (ordersUnique.length) {
    for (let i = 0; i < ordersUnique.length; i += 200) {
      const chunk = ordersUnique.slice(i, i + 200).map((o) => ({ ...o, user_id: userId, updated_at: now }));
      const { error } = await supabase.from("orders").upsert(chunk);
      if (error) throw new Error(`orders: ${error.message}`);
    }
  }
  if (itemsUnique.length) {
    for (let i = 0; i < itemsUnique.length; i += 200) {
      const chunk = itemsUnique.slice(i, i + 200).map((o) => ({ ...o, user_id: userId, updated_at: now }));
      const { error } = await supabase.from("order_items").upsert(chunk);
      if (error) throw new Error(`order_items: ${error.message}`);
    }
  }
  if (productsUnique.length) {
    for (let i = 0; i < productsUnique.length; i += 200) {
      const chunk = productsUnique.slice(i, i + 200).map((p) => ({ ...p, user_id: userId, updated_at: now }));
      const { error } = await supabase.from("products").upsert(chunk);
      if (error) throw new Error(`products: ${error.message}`);
    }
  }
}

async function loadDashboardFromDb(startDate, endDate, userId = requireUserId()) {
  const supabase = getSupabase();
  const { data: daily, error: dErr } = await supabase
    .from("daily_metrics")
    .select("*")
    .eq("user_id", userId)
    .gte("data", startDate)
    .lte("data", endDate)
    .order("data", { ascending: true });
  if (dErr) throw new Error(dErr.message);

  const { data: subIds, error: sErr } = await supabase
    .from("subid_metrics")
    .select("*")
    .eq("user_id", userId)
    .order("comissao", { ascending: false });
  if (sErr) throw new Error(sErr.message);

  const { data: lastRun } = await supabase
    .from("sync_runs")
    .select("*")
    .eq("user_id", userId)
    .order("synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if ((!daily || !daily.length) && (!subIds || !subIds.length)) return null;

  const kpis = {
    faturamento: 0, comissao: 0, pedidos: 0, concluidos: 0, pendentes: 0,
    cancelados: 0, unpaid: 0, inv_meta: 0, inv_pin: 0, inv_total: 0, lucro: 0,
    roi: null, abatimento: 0, subIdsCount: (subIds || []).length,
  };
  for (const d of daily || []) {
    kpis.faturamento += Number(d.faturamento || 0);
    kpis.comissao += Number(d.comissao || 0);
    kpis.pedidos += Number(d.pedidos || 0);
    kpis.concluidos += Number(d.concluidos || 0);
    kpis.pendentes += Number(d.pendentes || 0);
    kpis.cancelados += Number(d.cancelados || 0);
    kpis.unpaid += Number(d.unpaid || 0);
    kpis.inv_meta += Number(d.inv_meta || 0);
    kpis.inv_pin += Number(d.inv_pin || 0);
    kpis.inv_total += Number(d.inv_total || 0);
    kpis.lucro += Number(d.lucro != null ? d.lucro : (d.comissao || 0) - (d.inv_total || 0));
  }
  kpis.faturamento = Math.round(kpis.faturamento * 100) / 100;
  kpis.comissao = Math.round(kpis.comissao * 100) / 100;
  kpis.inv_meta = Math.round(kpis.inv_meta * 100) / 100;
  kpis.inv_pin = Math.round(kpis.inv_pin * 100) / 100;
  kpis.inv_total = Math.round(kpis.inv_total * 100) / 100;
  kpis.lucro = Math.round(kpis.lucro * 100) / 100;
  kpis.roi = kpis.inv_total > 0 ? Math.round((kpis.lucro / kpis.inv_total) * 10000) / 100 : null;
  kpis.abatimento = kpis.faturamento > 0
    ? Math.round((kpis.comissao / kpis.faturamento) * 10000) / 100
    : 0;

  return {
    range: { startDate, endDate },
    nodes: lastRun?.nodes || 0,
    pages: lastRun?.pages || 0,
    kpis,
    daily: (daily || []).map((d) => ({
      data: d.data,
      faturamento: Number(d.faturamento || 0),
      comissao: Number(d.comissao || 0),
      pedidos: Number(d.pedidos || 0),
      concluidos: Number(d.concluidos || 0),
      pendentes: Number(d.pendentes || 0),
      cancelados: Number(d.cancelados || 0),
      unpaid: Number(d.unpaid || 0),
      inv_meta: Number(d.inv_meta || 0),
      inv_pin: Number(d.inv_pin || 0),
      inv_total: Number(d.inv_total || 0),
      lucro: Number(d.lucro != null ? d.lucro : 0),
      roi: d.roi != null ? Number(d.roi) : null,
    })),
    subIds: (subIds || []).map((r) => ({
      subid: r.subid,
      faturamento: Number(r.faturamento || 0),
      comissao: Number(r.comissao || 0),
      pedidos: Number(r.pedidos || 0),
      concluidos: Number(r.concluidos || 0),
      pendentes: Number(r.pendentes || 0),
      cancelados: Number(r.cancelados || 0),
      itens: Number(r.itens || 0),
      abatimento: Number(r.abatimento || 0),
      inv_meta: Number(r.inv_meta || 0),
      inv_pin: Number(r.inv_pin || 0),
      inv_total: Number(r.inv_total || 0),
      lucro: Number(r.lucro != null ? r.lucro : 0),
      roi: r.roi != null ? Number(r.roi) : null,
    })),
    syncedAt: lastRun?.synced_at || null,
    fromDb: true,
  };
}

async function attachMenuPreviews(dash, startDate, endDate, userId = requireUserId()) {
  if (!dash) return dash;
  try {
    const [orders, products] = await Promise.all([
      loadOrders({ startDate, endDate, limit: 5000 }, userId),
      loadProducts({ limit: 100 }, userId),
    ]);
    dash.ordersPreview = (orders || []).slice(0, 200);
    dash.productsPreview = products;

    // Histórico diário por SubID (para expandir na tabela)
    const bySubDay = {};
    for (const o of orders || []) {
      const sub = String(o.subid || "organico");
      const day = o.data;
      if (!day) continue;
      if (!bySubDay[sub]) bySubDay[sub] = {};
      if (!bySubDay[sub][day]) {
        bySubDay[sub][day] = {
          data: day,
          faturamento: 0,
          comissao: 0,
          pedidos: 0,
          concluidos: 0,
          pendentes: 0,
          cancelados: 0,
        };
      }
      const row = bySubDay[sub][day];
      row.pedidos += 1;
      const st = String(o.status || "");
      if (st === "cancelada") {
        row.cancelados += 1;
        continue;
      }
      if (st === "unpaid") continue;
      row.faturamento += Number(o.faturamento || 0);
      row.comissao += Number(o.comissao || 0);
      if (st === "concluida") row.concluidos += 1;
      else row.pendentes += 1;
    }

    dash.subIds = (dash.subIds || []).map((r) => {
      if (Array.isArray(r.daily) && r.daily.length) return r;
      const days = bySubDay[r.subid] || {};
      const daily = Object.values(days)
        .map((d) => ({
          ...d,
          faturamento: Math.round(d.faturamento * 100) / 100,
          comissao: Math.round(d.comissao * 100) / 100,
        }))
        .sort((a, b) => String(a.data).localeCompare(String(b.data)));
      return { ...r, daily };
    });
  } catch (_) {
    dash.ordersPreview = dash.ordersPreview || [];
    dash.productsPreview = dash.productsPreview || [];
  }
  return dash;
}

async function loadOrders({ startDate, endDate, limit = 200 } = {}, userId = requireUserId()) {
  const supabase = getSupabase();
  let q = supabase.from("orders").select("*").eq("user_id", userId).order("data", { ascending: false }).limit(limit);
  if (startDate) q = q.gte("data", startDate);
  if (endDate) q = q.lte("data", endDate);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}

async function loadProducts({ limit = 200 } = {}, userId = requireUserId()) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("user_id", userId)
    .order("comissao", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  if (data?.length) return data;

  // Fallback: agrega order_items se a tabela products estiver vazia
  const { data: rows, error: iErr } = await supabase
    .from("order_items")
    .select("item_id,item_name,shop_name,qty,faturamento,comissao")
    .eq("user_id", userId)
    .limit(5000);
  if (iErr) throw new Error(iErr.message);
  const map = {};
  for (const r of rows || []) {
    const id = String(r.item_id || "unknown");
    if (!map[id]) {
      map[id] = {
        item_id: id,
        item_name: r.item_name || "",
        shop_name: r.shop_name || "",
        faturamento: 0,
        comissao: 0,
        pedidos: 0,
        qty: 0,
      };
    }
    map[id].faturamento += Number(r.faturamento || 0);
    map[id].comissao += Number(r.comissao || 0);
    map[id].qty += Number(r.qty || 0);
    map[id].pedidos += 1;
  }
  return Object.values(map)
    .map((p) => ({
      ...p,
      faturamento: Math.round(p.faturamento * 100) / 100,
      comissao: Math.round(p.comissao * 100) / 100,
    }))
    .sort((a, b) => b.comissao - a.comissao)
    .slice(0, limit);
}

async function loadSettings(userId = requireUserId()) {
  const supabase = getSupabase();
  const { data } = await supabase.from("app_settings").select("*").eq("user_id", userId).maybeSingle();
  return {
    metaBase: Number(data?.meta_base || 863959),
    taxRate: Number(data?.tax_rate || 0),
    teamName: data?.team_name || "Minha conta",
    teamPlan: data?.team_plan || "Shopee · Meta",
  };
}

async function saveSettings(partial, userId = requireUserId()) {
  const prev = await loadSettings(userId);
  const next = {
    user_id: userId,
    meta_base: partial.metaBase != null ? Number(partial.metaBase) : prev.metaBase,
    tax_rate: partial.taxRate != null ? Number(partial.taxRate) : prev.taxRate,
    team_name: partial.teamName != null ? String(partial.teamName) : prev.teamName,
    team_plan: partial.teamPlan != null ? String(partial.teamPlan) : prev.teamPlan,
    updated_at: new Date().toISOString(),
  };
  const supabase = getSupabase();
  const { error } = await supabase.from("app_settings").upsert(next);
  if (error) throw new Error(error.message);
  return loadSettings(userId);
}

module.exports = {
  loadCredentials,
  saveCredentials,
  credentialsPublic,
  saveDashboardSnapshot,
  persistOrdersAndProducts,
  loadDashboardFromDb,
  attachMenuPreviews,
  loadOrders,
  loadProducts,
  loadSettings,
  saveSettings,
  resetAllSyncedData,
  maskSecret,
};
