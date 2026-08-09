"use strict";

const { getSupabase } = require("./supabase");

function maskSecret(secret) {
  const s = String(secret || "");
  if (s.length <= 8) return "••••••••";
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

async function loadCredentials() {
  const envFallback = {
    appId: String(process.env.SHOPEE_APP_ID || "").trim(),
    secret: String(process.env.SHOPEE_SECRET || "").trim(),
    updatedAt: null,
  };

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("app_credentials")
      .select("app_id, secret, updated_at")
      .eq("id", "default")
      .maybeSingle();
    if (error) throw error;
    if (data?.app_id && data?.secret) {
      return {
        appId: String(data.app_id).trim(),
        secret: String(data.secret).trim(),
        updatedAt: data.updated_at || null,
      };
    }
  } catch (err) {
    console.warn("[store] loadCredentials:", err.message || err);
  }
  return envFallback;
}

async function resetAllSyncedData() {
  const supabase = getSupabase();
  const { error: rpcErr } = await supabase.rpc("reset_shopee_data");
  if (!rpcErr) return;

  // Fallback se a function ainda não existir
  await supabase.from("sync_runs").delete().neq("id", 0);
  await supabase.from("daily_metrics").delete().neq("data", "1900-01-01");
  await supabase.from("subid_metrics").delete().neq("subid", "__never__");
}

/**
 * Salva credenciais. Se o APP_ID mudar, zera métricas/sync
 * (cliente novo = dados novos).
 */
async function saveCredentials({ appId, secret }) {
  const payload = {
    appId: String(appId || "").trim(),
    secret: String(secret || "").trim(),
  };
  if (!payload.appId || !payload.secret) {
    throw new Error("APP_ID e SECRET são obrigatórios");
  }

  const prev = await loadCredentials();
  const appChanged = prev.appId && prev.appId !== payload.appId;

  const supabase = getSupabase();
  const { error } = await supabase.from("app_credentials").upsert({
    id: "default",
    app_id: payload.appId,
    secret: payload.secret,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);

  let reset = false;
  if (appChanged) {
    await resetAllSyncedData();
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

async function credentialsPublic() {
  const c = await loadCredentials();
  return {
    configured: Boolean(c.appId && c.secret),
    appId: c.appId || "",
    secretMasked: c.secret ? maskSecret(c.secret) : "",
    updatedAt: c.updatedAt,
  };
}

async function saveDashboardSnapshot(dash) {
  const supabase = getSupabase();
  const now = new Date().toISOString();

  const dailyRows = (dash.daily || []).map((d) => ({
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

  await supabase.from("subid_metrics").delete().neq("subid", "__never__");
  const subRows = (dash.subIds || []).map((r) => ({
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
    start_date: dash.range?.startDate,
    end_date: dash.range?.endDate,
    nodes: dash.nodes || 0,
    pages: dash.pages || 0,
    kpis: dash.kpis || {},
    synced_at: dash.syncedAt || now,
  });
  if (runErr) throw new Error(`sync_runs: ${runErr.message}`);
}

async function persistOrdersAndProducts({ orders, orderItems, products }) {
  const supabase = getSupabase();
  const now = new Date().toISOString();
  if (orders?.length) {
    for (let i = 0; i < orders.length; i += 200) {
      const chunk = orders.slice(i, i + 200).map((o) => ({ ...o, updated_at: now }));
      const { error } = await supabase.from("orders").upsert(chunk);
      if (error) throw new Error(`orders: ${error.message}`);
    }
  }
  if (orderItems?.length) {
    for (let i = 0; i < orderItems.length; i += 200) {
      const chunk = orderItems.slice(i, i + 200).map((o) => ({ ...o, updated_at: now }));
      const { error } = await supabase.from("order_items").upsert(chunk);
      if (error) throw new Error(`order_items: ${error.message}`);
    }
  }
  if (products?.length) {
    for (let i = 0; i < products.length; i += 200) {
      const chunk = products.slice(i, i + 200).map((p) => ({ ...p, updated_at: now }));
      const { error } = await supabase.from("products").upsert(chunk);
      if (error) throw new Error(`products: ${error.message}`);
    }
  }
}

async function loadOrders({ startDate, endDate, limit = 200 } = {}) {
  const supabase = getSupabase();
  let q = supabase.from("orders").select("*").order("data", { ascending: false }).limit(limit);
  if (startDate) q = q.gte("data", startDate);
  if (endDate) q = q.lte("data", endDate);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}

async function loadProducts({ limit = 200 } = {}) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("comissao", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data || [];
}

async function loadSettings() {
  const supabase = getSupabase();
  const { data } = await supabase.from("app_settings").select("*").eq("id", "default").maybeSingle();
  return {
    metaBase: Number(data?.meta_base || process.env.META_BASE || 863959),
    taxRate: Number(data?.tax_rate || 0),
    teamName: data?.team_name || "SaaS SHOPPE",
    teamPlan: data?.team_plan || "Shopee · Meta",
  };
}

async function saveSettings(partial) {
  const prev = await loadSettings();
  const next = {
    meta_base: partial.metaBase != null ? Number(partial.metaBase) : prev.metaBase,
    tax_rate: partial.taxRate != null ? Number(partial.taxRate) : prev.taxRate,
    team_name: partial.teamName != null ? String(partial.teamName) : prev.teamName,
    team_plan: partial.teamPlan != null ? String(partial.teamPlan) : prev.teamPlan,
    updated_at: new Date().toISOString(),
  };
  const supabase = getSupabase();
  const { error } = await supabase.from("app_settings").upsert({ id: "default", ...next });
  if (error) throw new Error(error.message);
  return loadSettings();
}

async function loadDashboardFromDb(startDate, endDate) {
  const supabase = getSupabase();
  const { data: daily, error: dErr } = await supabase
    .from("daily_metrics")
    .select("*")
    .gte("data", startDate)
    .lte("data", endDate)
    .order("data", { ascending: true });
  if (dErr) throw new Error(dErr.message);

  const { data: subIds, error: sErr } = await supabase
    .from("subid_metrics")
    .select("*")
    .order("comissao", { ascending: false });
  if (sErr) throw new Error(sErr.message);

  const { data: lastRun } = await supabase
    .from("sync_runs")
    .select("*")
    .order("synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if ((!daily || !daily.length) && (!subIds || !subIds.length)) return null;

  const kpis = {
    faturamento: 0,
    comissao: 0,
    pedidos: 0,
    concluidos: 0,
    pendentes: 0,
    cancelados: 0,
    unpaid: 0,
    inv_meta: 0,
    inv_pin: 0,
    inv_total: 0,
    lucro: 0,
    roi: null,
    abatimento: 0,
    subIdsCount: (subIds || []).length,
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
  kpis.roi = kpis.inv_total > 0
    ? Math.round((kpis.lucro / kpis.inv_total) * 10000) / 100
    : null;
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

module.exports = {
  loadCredentials,
  saveCredentials,
  credentialsPublic,
  saveDashboardSnapshot,
  loadDashboardFromDb,
  persistOrdersAndProducts,
  loadOrders,
  loadProducts,
  loadSettings,
  saveSettings,
  resetAllSyncedData,
  maskSecret,
};
