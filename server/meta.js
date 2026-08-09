"use strict";

const { normalizeSubId } = require("./normalizeSubId");
const { getSupabase } = require("./supabase");

function maskToken(token) {
  const s = String(token || "");
  if (s.length <= 10) return s ? "••••••••" : "";
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function parseAccountIds(raw) {
  return String(raw || "")
    .split(",")
    .flatMap((part) => {
      const m = String(part || "").match(/\d{5,}/g);
      return m && m[0] ? [m[0]] : [];
    })
    .filter(Boolean);
}

function actId(id) {
  const d = String(id || "").replace(/^act_/i, "");
  return `act_${d}`;
}

async function loadMetaCredentials() {
  const envFallback = {
    accessToken: String(process.env.META_ACCESS_TOKEN || "").trim(),
    adAccountIds: String(process.env.META_AD_ACCOUNT_IDS || "").trim(),
    apiVersion: String(process.env.META_API_VERSION || "v19.0").trim() || "v19.0",
    lastSyncAt: null,
    lastSyncMeta: {},
  };
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("meta_credentials")
      .select("*")
      .eq("id", "default")
      .maybeSingle();
    if (error) throw error;
    if (data && (data.access_token || data.ad_account_ids)) {
      return {
        accessToken: String(data.access_token || "").trim() || envFallback.accessToken,
        adAccountIds: String(data.ad_account_ids || "").trim() || envFallback.adAccountIds,
        apiVersion: String(data.api_version || "v19.0").trim() || "v19.0",
        lastSyncAt: data.last_sync_at || null,
        lastSyncMeta: data.last_sync_meta || {},
      };
    }
  } catch (err) {
    console.warn("[meta] loadCredentials:", err.message || err);
  }
  return envFallback;
}

async function saveMetaCredentials({ accessToken, adAccountIds, apiVersion }) {
  const prev = await loadMetaCredentials();
  const next = {
    accessToken: accessToken != null && String(accessToken).trim()
      ? String(accessToken).trim()
      : prev.accessToken,
    adAccountIds: adAccountIds != null
      ? String(adAccountIds).trim()
      : prev.adAccountIds,
    apiVersion: (apiVersion && String(apiVersion).trim()) || prev.apiVersion || "v19.0",
  };
  if (!next.accessToken) throw new Error("META_ACCESS_TOKEN é obrigatório");
  if (!parseAccountIds(next.adAccountIds).length) {
    throw new Error("Informe ao menos um META_AD_ACCOUNT_ID");
  }

  const supabase = getSupabase();
  const { error } = await supabase.from("meta_credentials").upsert({
    id: "default",
    access_token: next.accessToken,
    ad_account_ids: next.adAccountIds,
    api_version: next.apiVersion,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);

  return metaCredentialsPublic();
}

async function metaCredentialsPublic() {
  const c = await loadMetaCredentials();
  const ids = parseAccountIds(c.adAccountIds);
  return {
    configured: Boolean(c.accessToken && ids.length),
    tokenMasked: c.accessToken ? maskToken(c.accessToken) : "",
    adAccountIds: c.adAccountIds || "",
    accountsCount: ids.length,
    apiVersion: c.apiVersion || "v19.0",
    lastSyncAt: c.lastSyncAt,
    lastSyncMeta: c.lastSyncMeta || {},
  };
}

async function metaFetchAll(url) {
  const out = [];
  let next = url;
  let pages = 0;
  while (next && pages < 40) {
    pages += 1;
    const res = await fetch(next);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) {
      const msg = json.error?.message || JSON.stringify(json).slice(0, 200);
      throw new Error(msg);
    }
    const data = Array.isArray(json.data) ? json.data : [];
    out.push(...data);
    next = json.paging?.next || null;
  }
  return out;
}

function brtDateISO(d = new Date()) {
  const ms = d.getTime() - 3 * 3600 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

function rangeDaysBack(daysBack) {
  const days = Math.max(1, Math.min(90, Number(daysBack) || 7));
  const until = brtDateISO(new Date(Date.now() - 24 * 3600 * 1000)); // ontem BRT approx
  const untilDate = new Date(`${until}T15:00:00Z`);
  const sinceDate = new Date(untilDate.getTime() - (days - 1) * 86400000);
  const since = sinceDate.toISOString().slice(0, 10);
  return { since, until, days };
}

async function testMetaCredentials() {
  const c = await loadMetaCredentials();
  if (!c.accessToken) throw new Error("Token Meta não configurado");
  const ver = c.apiVersion || "v19.0";
  const url = `https://graph.facebook.com/${ver}/me?fields=id,name&access_token=${encodeURIComponent(c.accessToken)}`;
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(json.error?.message || "Falha no teste Meta");

  const accounts = parseAccountIds(c.adAccountIds);
  let sampleSpend = null;
  if (accounts[0]) {
    const params = new URLSearchParams({
      access_token: c.accessToken,
      fields: "spend",
      date_preset: "yesterday",
      level: "account",
    });
    try {
      const insights = await metaFetchAll(
        `https://graph.facebook.com/${ver}/${actId(accounts[0])}/insights?${params}`,
      );
      sampleSpend = insights[0]?.spend ?? null;
    } catch (e) {
      return {
        ok: true,
        user: { id: json.id, name: json.name },
        accounts: accounts.length,
        warning: `Token OK, mas insights da conta ${accounts[0]}: ${e.message}`,
      };
    }
  }
  return {
    ok: true,
    user: { id: json.id, name: json.name },
    accounts: accounts.length,
    sampleSpend,
  };
}

async function syncMetaDaily({ daysBack = 7 } = {}) {
  const c = await loadMetaCredentials();
  const token = c.accessToken;
  const accountIds = parseAccountIds(c.adAccountIds);
  const apiVersion = c.apiVersion || "v19.0";
  if (!token) throw new Error("META_ACCESS_TOKEN não configurado");
  if (!accountIds.length) throw new Error("META_AD_ACCOUNT_IDS não configurado");

  const { since, until, days } = rangeDaysBack(daysBack);
  const fields = [
    "ad_id", "ad_name", "adset_name", "campaign_name",
    "spend", "impressions", "clicks", "ctr", "cpc", "reach",
    "date_start", "date_stop",
  ].join(",");

  const rowsOut = [];
  const errors = [];
  const started = Date.now();

  for (const accountId of accountIds) {
    const params = new URLSearchParams({
      access_token: token,
      level: "ad",
      fields,
      time_increment: "1",
      time_range: JSON.stringify({ since, until }),
      limit: "500",
    });
    const url = `https://graph.facebook.com/${apiVersion}/${actId(accountId)}/insights?${params}`;
    try {
      const rows = await metaFetchAll(url);
      for (const row of rows) {
        const adId = String(row.ad_id || "").trim();
        const date = String(row.date_start || "").trim();
        if (!adId || !date) continue;
        rowsOut.push({
          ad_id: adId,
          data: date,
          ad_name: String(row.ad_name || ""),
          subid: normalizeSubId(row.ad_name || ""),
          adset_name: String(row.adset_name || ""),
          campaign_name: String(row.campaign_name || ""),
          gasto: Math.round((parseFloat(row.spend || 0) || 0) * 100) / 100,
          impressoes: parseInt(row.impressions || 0, 10) || 0,
          alcance: parseInt(row.reach || 0, 10) || 0,
          cliques: parseInt(row.clicks || 0, 10) || 0,
          ctr: Math.round((parseFloat(row.ctr || 0) || 0) * 10000) / 10000,
          cpc: Math.round((parseFloat(row.cpc || 0) || 0) * 100) / 100,
          account_id: String(accountId),
          updated_at: new Date().toISOString(),
        });
      }
    } catch (e) {
      errors.push(`Conta ${accountId}: ${e.message || e}`);
    }
  }

  const supabase = getSupabase();
  let gravados = 0;
  for (let i = 0; i < rowsOut.length; i += 200) {
    const chunk = rowsOut.slice(i, i + 200);
    const { error } = await supabase.from("meta_ads_daily").upsert(chunk);
    if (error) throw new Error(`meta_ads_daily: ${error.message}`);
    gravados += chunk.length;
  }

  const meta = {
    range: { since, until, daysBack: days },
    linhas: rowsOut.length,
    gravados,
    erros: errors,
    elapsedMs: Date.now() - started,
  };

  await supabase.from("meta_credentials").upsert({
    id: "default",
    access_token: token,
    ad_account_ids: c.adAccountIds,
    api_version: apiVersion,
    last_sync_at: new Date().toISOString(),
    last_sync_meta: meta,
    updated_at: new Date().toISOString(),
  });

  return meta;
}

async function loadMetaSpendByDay(startDate, endDate) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("meta_ads_daily")
    .select("data, subid, gasto, campaign_name, ad_name, ad_id, cliques, impressoes")
    .gte("data", startDate)
    .lte("data", endDate);
  if (error) throw new Error(error.message);
  return data || [];
}

async function loadCampaigns(startDate, endDate) {
  const rows = await loadMetaSpendByDay(startDate, endDate);
  const byCamp = {};
  for (const r of rows) {
    const key = r.campaign_name || "(sem campanha)";
    if (!byCamp[key]) byCamp[key] = { campaign: key, gasto: 0, ads: 0, cliques: 0, impressoes: 0 };
    byCamp[key].gasto += Number(r.gasto || 0);
    byCamp[key].ads += 1;
    byCamp[key].cliques += Number(r.cliques || 0);
    byCamp[key].impressoes += Number(r.impressoes || 0);
  }
  return Object.values(byCamp)
    .map((c) => ({ ...c, gasto: Math.round(c.gasto * 100) / 100 }))
    .sort((a, b) => b.gasto - a.gasto);
}

module.exports = {
  loadMetaCredentials,
  saveMetaCredentials,
  metaCredentialsPublic,
  testMetaCredentials,
  syncMetaDaily,
  loadMetaSpendByDay,
  loadCampaigns,
  parseAccountIds,
  maskToken,
};
