"use strict";

const { normalizeSubId } = require("./normalizeSubId");
const { getSupabase } = require("./supabase");
const { requireUserId } = require("./auth");

function parseMoney(val) {
  if (val == null || val === "") return 0;
  let s = String(val).trim().replace("R$", "").replace(/\s/g, "");
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  return parseFloat(s) || 0;
}

function normalizeHeader(h) {
  return String(h || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function findCol(headers, ...aliases) {
  const norms = headers.map((h) => normalizeHeader(h));
  const wanted = aliases.map((a) => normalizeHeader(a)).filter(Boolean);
  for (const a of wanted) {
    const exact = norms.indexOf(a);
    if (exact >= 0) return exact;
  }
  for (const a of wanted) {
    const i = norms.findIndex((h) => h.startsWith(`${a}_`) || h.endsWith(`_${a}`));
    if (i >= 0) return i;
  }
  return -1;
}

function parseCsv(text) {
  const lines = String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { headers: [], rows: [] };

  const delim = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ";" : ",";
  const splitD = (line) => {
    const out = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = !inQ;
      } else if (ch === delim && !inQ) {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
    out.push(cur);
    return out.map((c) => c.trim());
  };

  const headers = splitD(lines[0]);
  const rows = lines.slice(1).map((l) => splitD(l));
  return { headers, rows };
}

function parseDateCell(dateRaw) {
  const s = String(dateRaw || "").trim();
  if (!s) return null;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split("/");
    return `${y}-${m}-${d}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

function parsePinterestCsv(text) {
  const { headers, rows } = parseCsv(text);
  const iName = findCol(headers, "ad_name", "nome_do_anuncio", "nome", "ad name", "pin_description", "pin description");
  const iDesc = findCol(headers, "pin_description", "pin description", "description");
  const iSpend = findCol(
    headers,
    "spend_in_account_currency",
    "amount_spent",
    "spend",
    "gasto",
    "amount spent"
  );
  const iClicks = findCol(
    headers,
    "paid_pin_clicks",
    "pin_clicks",
    "paid_clicks",
    "cliques",
    "clicks",
    "paid clicks"
  );
  const iStatus = findCol(headers, "ad_entity_status", "campaign_entity_status", "status");
  const iDate = findCol(headers, "date", "data", "day");
  const iAdId = findCol(headers, "ad_id", "ad id");

  const parsed = [];
  for (const row of rows) {
    const adName = iName >= 0 ? String(row[iName] || "").trim() : "";
    const pinDesc = iDesc >= 0 && iDesc !== iName ? String(row[iDesc] || "").trim() : "";
    const label = adName || pinDesc;
    if (!label) continue;
    const data = parseDateCell(iDate >= 0 ? row[iDate] : "");
    if (!data) continue;
    const spend = iSpend >= 0 ? parseMoney(row[iSpend]) : 0;
    const adId = iAdId >= 0 ? String(row[iAdId] || "").trim() : "";
    const subid = normalizeSubId(adName || pinDesc);
    if (!subid) continue;
    const id = `${adId || subid}_${data}`;
    parsed.push({
      id,
      ad_id: adId,
      data,
      ad_name: adName || pinDesc,
      subid,
      gasto: Math.round(spend * 100) / 100,
      cliques: iClicks >= 0 ? parseInt(String(row[iClicks] || "0").replace(/[^0-9]/g, ""), 10) || 0 : 0,
      status: iStatus >= 0 ? String(row[iStatus] || "").trim() : "",
      updated_at: new Date().toISOString(),
    });
  }
  return parsed;
}

async function importPinterestCsv(text, userId = requireUserId()) {
  const parsed = parsePinterestCsv(text);
  if (!parsed.length) {
    throw new Error("Nenhuma linha válida no CSV Pinterest. Use o export do Ads Manager (Date + Ad name + Spend).");
  }
  const rows = parsed.map((r) => ({ ...r, user_id: userId }));
  const supabase = getSupabase();
  let gravados = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { error } = await supabase.from("pinterest_ads_daily").upsert(chunk);
    if (error) throw new Error(error.message);
    gravados += chunk.length;
  }
  const classificados = await applyPinterestCsvOps(parsed, userId);
  const subids = new Set(rows.map((r) => r.subid));
  const datas = rows.map((r) => r.data).sort();
  const gasto = Math.round(rows.reduce((a, r) => a + Number(r.gasto || 0), 0) * 100) / 100;
  const cliques = rows.reduce((a, r) => a + Number(r.cliques || 0), 0);
  return {
    linhas: rows.length,
    gravados,
    subids: subids.size,
    gasto,
    cliques,
    classificados: classificados.total,
    ativas: classificados.ativas,
    desativadas: classificados.desativadas,
    range: { since: datas[0] || null, until: datas[datas.length - 1] || null },
  };
}

function pinStatusFromEntity(raw) {
  const s = String(raw || "").trim().toUpperCase();
  if (!s) return null;
  if (["ACTIVE", "ENABLED", "RUNNING"].includes(s)) return "ativa";
  if (
    ["PAUSED", "ARCHIVED", "DELETED", "DISABLED", "INACTIVE", "DRAFT", "ADVERTISER_DISABLED"].includes(s)
  ) {
    return "desativada";
  }
  return null;
}

function summarizePinSubIds(rows) {
  const bySub = new Map();
  for (const r of rows || []) {
    const subid = String(r.subid || "").trim();
    if (!subid) continue;
    const prev = bySub.get(subid) || { subid, gasto: 0, cliques: 0, data: "", statusRaw: "" };
    prev.gasto += Number(r.gasto || 0);
    prev.cliques += Number(r.cliques || 0);
    const day = String(r.data || "");
    if (!prev.data || day >= prev.data) {
      prev.data = day;
      prev.statusRaw = r.status || prev.statusRaw;
    }
    bySub.set(subid, prev);
  }
  return [...bySub.values()];
}

async function applyPinterestCsvOps(rows, userId = requireUserId()) {
  const { upsertSubidOpsMany, loadSubidOps } = require("./subidOps");
  const prevMap = await loadSubidOps(userId);
  const ops = [];
  for (const r of summarizePinSubIds(rows)) {
    const prev = prevMap[String(r.subid || "").toLowerCase()] || {};
    // Cliente travou status na mão (ou legado sem origem) — só classifica canal se ainda indefinido
    const isManualOrLegacy = prev.status_source === "manual"
      || prev.status === "teste"
      || (prev.status && !prev.status_source);
    if (isManualOrLegacy) {
      if (!prev.canal || prev.canal === "indefinido") {
        ops.push({ subid: r.subid, canal: "pinterest" });
      }
      continue;
    }
    const fromEntity = pinStatusFromEntity(r.statusRaw);
    // Só grava status com certeza do CSV (entity status). Sem chute por gasto zero.
    const row = { subid: r.subid, canal: "pinterest" };
    if (fromEntity) {
      row.status = fromEntity;
      row.status_source = "pinterest";
    }
    ops.push(row);
  }
  if (!ops.length) return { total: 0, ativas: 0, desativadas: 0 };
  await upsertSubidOpsMany(ops, userId);
  return {
    total: ops.length,
    ativas: ops.filter((o) => o.status === "ativa").length,
    desativadas: ops.filter((o) => o.status === "desativada").length,
  };
}

async function loadPinSpendByDay(startDate, endDate, userId = requireUserId()) {
  const supabase = getSupabase();
  const pageSize = 1000;
  const maxPages = 20;
  const all = [];
  for (let page = 0; page < maxPages; page++) {
    const from = page * pageSize;
    const { data, error } = await supabase
      .from("pinterest_ads_daily")
      .select("data, subid, gasto, cliques")
      .eq("user_id", userId)
      .gte("data", startDate)
      .lte("data", endDate)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data || !data.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
  }
  return all;
}

module.exports = {
  parsePinterestCsv,
  importPinterestCsv,
  loadPinSpendByDay,
};
