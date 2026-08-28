"use strict";

const { getSupabase } = require("./supabase");
const { requireUserId } = require("./auth");
const { buildDashboard } = require("./metrics");
const { syncMetaDaily, metaCredentialsPublic } = require("./meta");
const { attachMtdKpis } = require("./store");
const { enrichDashboardWithAds } = require("./finance");

async function markJob(userId, startDate, endDate, status, extra = {}) {
  const supabase = getSupabase();
  await supabase.from("sync_runs").insert({
    user_id: userId,
    start_date: startDate,
    end_date: endDate,
    nodes: extra.nodes || 0,
    pages: extra.pages || 0,
    kpis: { job_status: status, error: extra.error || null, ...extra.kpis },
  });
}

async function latestJob(userId = requireUserId()) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("sync_runs")
    .select("kpis, synced_at, start_date, end_date, nodes")
    .eq("user_id", userId)
    .order("synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  let status = data?.kpis?.job_status || "idle";
  if (status === "running" && data?.synced_at) {
    const age = Date.now() - new Date(data.synced_at).getTime();
    if (age > 120_000) status = "idle";
  }
  return {
    status: status === "running" ? "running" : status === "error" ? "error" : "idle",
    error: data?.kpis?.error || null,
    syncedAt: data?.synced_at || null,
    startDate: data?.start_date || null,
    endDate: data?.end_date || null,
    nodes: data?.nodes || 0,
  };
}

async function runUserDashboardSync({ startDate, endDate }, userId = requireUserId()) {
  await markJob(userId, startDate, endDate, "running");
  try {
    let metaSync = null;
    try {
      const metaCred = await metaCredentialsPublic(userId);
      if (metaCred.configured) {
        metaSync = await syncMetaDaily({ since: startDate, until: endDate }, userId);
      }
    } catch (e) {
      metaSync = { error: e.message || String(e) };
    }

    let dash = await buildDashboard({ startDate, endDate, persist: true, persistSubIds: true });
    if (metaSync && !metaSync.error) {
      try {
        dash = await enrichDashboardWithAds(dash, userId, { persistSubIds: true, persistDaily: true });
      } catch (_) { /* keep */ }
    }
    dash = await attachMtdKpis(dash, userId);
    await markJob(userId, startDate, endDate, "done", {
      nodes: dash.nodes || 0,
      pages: dash.pages || 0,
      kpis: { metaError: metaSync?.error || null },
    });
    // Push desligado no sync manual — só o job "ontem" (conversões) notifica.
    return { success: true, metaSync, nodes: dash.nodes || 0, push: null };
  } catch (err) {
    await markJob(userId, startDate, endDate, "error", { error: err.message || String(err) }).catch(() => {});
    throw err;
  }
}

module.exports = { latestJob, runUserDashboardSync, markJob };
