"use strict";

const { normalizeShopeeSubId } = require("./normalizeSubId");
const { getSupabase } = require("./supabase");
const { requireUserId } = require("./auth");

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
    const i = norms.findIndex((h) => h.includes(a));
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
  return { headers: splitD(lines[0]), rows: lines.slice(1).map((l) => splitD(l)) };
}

function parseClickDate(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
}

function parseShopeeClicksCsv(text) {
  const { headers, rows } = parseCsv(text);
  if (!headers.length) return [];
  const colSub = findCol(headers, "sub_id", "subid", "utm_content", "sub");
  const colDate = findCol(headers, "tempo_dos_cliques", "data_do_clique", "horario", "click_time", "data", "date");
  if (colSub < 0 || colDate < 0) {
    throw new Error("CSV de cliques Shopee: precisa das colunas Sub_id e Tempo dos cliques (ou Data).");
  }
  const byKey = new Map();
  let processed = 0;
  for (const row of rows) {
    const subid = normalizeShopeeSubId(row[colSub]);
    const data = parseClickDate(row[colDate]);
    if (!subid || subid === "organico" || !data) continue;
    const key = `${data}|${subid}`;
    byKey.set(key, (byKey.get(key) || 0) + 1);
    processed += 1;
  }
  const out = [];
  for (const [key, cliques] of byKey) {
    const [data, subid] = key.split("|");
    out.push({ data, subid, cliques });
  }
  return { rows: out, processed };
}

async function importShopeeClicksCsv(text, userId = requireUserId()) {
  const parsed = parseShopeeClicksCsv(text);
  if (!parsed.rows.length) {
    throw new Error("Nenhum clique com SubID e data no CSV. Exporte o Relatório de cliques da Shopee.");
  }
  const supabase = getSupabase();
  const now = new Date().toISOString();
  let gravados = 0;
  for (let i = 0; i < parsed.rows.length; i += 200) {
    const chunk = parsed.rows.slice(i, i + 200).map((r) => ({
      user_id: userId,
      data: r.data,
      subid: r.subid,
      cliques: r.cliques,
      updated_at: now,
    }));
    const { error } = await supabase.from("clique_daily").upsert(chunk, { onConflict: "user_id,data,subid" });
    if (error) throw new Error(error.message);
    gravados += chunk.length;
  }
  const datas = parsed.rows.map((r) => r.data).sort();
  const cliques = parsed.rows.reduce((a, r) => a + Number(r.cliques || 0), 0);
  const subids = new Set(parsed.rows.map((r) => r.subid));
  return {
    linhas: parsed.processed,
    gravados,
    cliques,
    subids: subids.size,
    range: { since: datas[0] || null, until: datas[datas.length - 1] || null },
  };
}

async function loadShopeeClicksByDay(startDate, endDate, userId = requireUserId()) {
  const supabase = getSupabase();
  const all = [];
  const pageSize = 1000;
  for (let from = 0; from < 100000; from += pageSize) {
    const { data, error } = await supabase
      .from("clique_daily")
      .select("data, subid, cliques")
      .eq("user_id", userId)
      .gte("data", startDate)
      .lte("data", endDate)
      .order("data", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) {
      if (/clique_daily|does not exist|schema cache/i.test(error.message || "")) return [];
      throw new Error(error.message);
    }
    const rows = data || [];
    all.push(...rows);
    if (rows.length < pageSize) break;
  }
  return all.map((r) => ({
    data: r.data,
    subid: String(r.subid || "").trim().toLowerCase(),
    cliques: Number(r.cliques || 0),
  }));
}

module.exports = { importShopeeClicksCsv, loadShopeeClicksByDay, parseShopeeClicksCsv };
