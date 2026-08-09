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

  // Substitui métricas do período sincronizado
  const dailyRows = (dash.daily || []).map((d) => ({
    data: d.data,
    faturamento: d.faturamento,
    comissao: d.comissao,
    pedidos: d.pedidos,
    concluidos: d.concluidos,
    pendentes: d.pendentes,
    cancelados: d.cancelados,
    unpaid: d.unpaid,
    updated_at: now,
  }));
  if (dailyRows.length) {
    const { error } = await supabase.from("daily_metrics").upsert(dailyRows);
    if (error) throw new Error(`daily_metrics: ${error.message}`);
  }

  // SubIDs: dump completo do último sync (visão atual)
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
    updated_at: now,
  }));
  if (subRows.length) {
    // upsert em chunks
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
  }
  kpis.faturamento = Math.round(kpis.faturamento * 100) / 100;
  kpis.comissao = Math.round(kpis.comissao * 100) / 100;
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
  resetAllSyncedData,
  maskSecret,
};
