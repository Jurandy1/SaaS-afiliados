"use strict";

const { normalizeSubId } = require("./normalizeSubId");
const { getSupabase } = require("./supabase");

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
  const map = {};
  headers.forEach((h, i) => {
    map[normalizeHeader(h)] = i;
  });
  for (const a of aliases) {
    const k = normalizeHeader(a);
    if (map[k] != null) return map[k];
  }
  return -1;
}

function parseCsv(text) {
  const lines = String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { headers: [], rows: [] };
  const split = (line) => {
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
      } else if (ch === "," && !inQ) {
        out.push(cur);
        cur = "";
      } else if ((ch === ";" || ch === "\t") && !inQ && out.length === 0 && !line.includes(",")) {
        // allow ; delimiter if no commas in line — handled below
        cur += ch;
      } else cur += ch;
    }
    out.push(cur);
    return out.map((c) => c.trim());
  };

  // detect delimiter
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

function parsePinterestCsv(text) {
  const { headers, rows } = parseCsv(text);
  const iName = findCol(headers, "ad_name", "nome_do_anuncio", "nome", "ad name");
  const iSpend = findCol(headers, "spend", "gasto", "amount spent");
  const iClicks = findCol(headers, "pin_clicks", "cliques", "clicks", "paid clicks");
  const iStatus = findCol(headers, "ad_entity_status", "status");
  const iDate = findCol(headers, "date", "data", "day");
  const iAdId = findCol(headers, "ad_id", "ad id");

  const parsed = [];
  for (const row of rows) {
    const adName = iName >= 0 ? String(row[iName] || "").trim() : "";
    if (!adName) continue;
    const spend = iSpend >= 0 ? parseMoney(row[iSpend]) : 0;
    const dateRaw = iDate >= 0 ? String(row[iDate] || "").trim() : "";
    let data = dateRaw;
    // normalize DD/MM/YYYY or YYYY-MM-DD
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateRaw)) {
      const [d, m, y] = dateRaw.split("/");
      data = `${y}-${m}-${d}`;
    } else if (/^\d{4}-\d{2}-\d{2}/.test(dateRaw)) {
      data = dateRaw.slice(0, 10);
    }
    const adId = iAdId >= 0 ? String(row[iAdId] || "").trim() : "";
    const subid = normalizeSubId(adName);
    const id = `${adId || subid || adName.slice(0, 20)}_${data || "nodate"}`;
    parsed.push({
      id,
      ad_id: adId,
      data: data || null,
      ad_name: adName,
      subid,
      gasto: Math.round(spend * 100) / 100,
      cliques: iClicks >= 0 ? parseInt(String(row[iClicks] || "0").replace(/[^0-9]/g, ""), 10) || 0 : 0,
      status: iStatus >= 0 ? String(row[iStatus] || "").trim() : "",
      updated_at: new Date().toISOString(),
    });
  }
  return parsed;
}

async function importPinterestCsv(text) {
  const rows = parsePinterestCsv(text);
  if (!rows.length) throw new Error("Nenhuma linha válida no CSV Pinterest");
  const supabase = getSupabase();
  let gravados = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { error } = await supabase.from("pinterest_ads_daily").upsert(chunk);
    if (error) throw new Error(error.message);
    gravados += chunk.length;
  }
  return { linhas: rows.length, gravados };
}

async function loadPinSpendByDay(startDate, endDate) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("pinterest_ads_daily")
    .select("data, subid, gasto, ad_name, ad_id, cliques")
    .gte("data", startDate)
    .lte("data", endDate);
  if (error) {
    // table may be empty / date nulls
    const { data: all } = await supabase.from("pinterest_ads_daily").select("*");
    return (all || []).filter((r) => r.data && r.data >= startDate && r.data <= endDate);
  }
  return data || [];
}

module.exports = {
  parsePinterestCsv,
  importPinterestCsv,
  loadPinSpendByDay,
};
