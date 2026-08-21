"use strict";

const { getSupabase } = require("./supabase");
const { requireUserId, requestCached } = require("./auth");

const CANAIS = new Set(["meta", "pinterest", "organico", "indefinido"]);
const STATUS_SOURCES = new Set(["manual", "meta", "pinterest"]);

function normalizeStatus(status) {
  if (status == null || status === "") return null;
  const s = String(status).trim().toLowerCase();
  if (s === "pausada" || s === "desativada") return "desativada";
  if (s === "teste") return "teste";
  if (s === "ativa") return "ativa";
  return s;
}

function normalizeCanal(canal) {
  if (canal == null || canal === "") return null;
  const s = String(canal).trim().toLowerCase();
  if (CANAIS.has(s)) return s;
  return null;
}

function normalizeStatusSource(source) {
  if (source == null || source === "") return null;
  const s = String(source).trim().toLowerCase();
  return STATUS_SOURCES.has(s) ? s : null;
}

async function loadSubidOps(userId = requireUserId()) {
  return requestCached(`loadSubidOps:${userId}`, async () => {
    const supabase = getSupabase();
    try {
      const { data, error } = await supabase.from("subid_ops").select("*").eq("user_id", userId);
      if (error) throw error;
      const map = {};
      for (const r of data || []) {
        const rawStatus = r.status || null;
        map[String(r.subid || "").toLowerCase()] = {
          canal: r.canal || null,
          status: rawStatus === "pausada" ? "desativada" : rawStatus,
          produto: r.produto || null,
          status_source: normalizeStatusSource(r.status_source) || null,
        };
      }
      return map;
    } catch (e) {
      console.warn("[subidOps] load:", e.message);
      return {};
    }
  });
}

async function upsertSubidOps(subid, partial, userId = requireUserId()) {
  const key = String(subid || "").trim();
  if (!key) throw new Error("SubID obrigatório");
  const supabase = getSupabase();
  const prevMap = await loadSubidOps(userId);
  const prev = prevMap[key.toLowerCase()] || {};
  const nextStatus =
    partial.status != null ? normalizeStatus(partial.status) : normalizeStatus(prev.status);
  const nextCanal =
    partial.canal !== undefined ? normalizeCanal(partial.canal) : normalizeCanal(prev.canal);

  // UI / cliente: status alterado → trava manual (sync da API não sobrescreve)
  let nextSource = normalizeStatusSource(prev.status_source);
  if (partial.status_source !== undefined) {
    nextSource = normalizeStatusSource(partial.status_source);
  } else if (partial.status != null) {
    nextSource = "manual";
  }

  const row = {
    user_id: userId,
    subid: key,
    canal: nextCanal,
    status: nextStatus,
    produto: partial.produto != null ? partial.produto : prev.produto,
    status_source: nextSource,
    updated_at: new Date().toISOString(),
  };
  let { error } = await supabase.from("subid_ops").upsert(row, { onConflict: "user_id,subid" });
  if (error && /status_source|indefinido|canal/i.test(error.message || "")) {
    try {
      const { ensureConfigSchema } = require("./ensureDb");
      await ensureConfigSchema();
    } catch (_) { /* ignore */ }
    ({ error } = await supabase.from("subid_ops").upsert(row, { onConflict: "user_id,subid" }));
  }
  // Coluna status_source ainda inexistente: grava sem ela
  if (error && /status_source/i.test(error.message || "")) {
    const { status_source: _drop, ...legacy } = row;
    ({ error } = await supabase.from("subid_ops").upsert(legacy, { onConflict: "user_id,subid" }));
  }
  if (error) throw new Error(error.message);
  return row;
}

async function upsertSubidOpsMany(rows, userId = requireUserId()) {
  const list = (rows || []).filter((r) => r && r.subid);
  if (!list.length) return 0;
  const prevMap = await loadSubidOps(userId);
  const now = new Date().toISOString();
  const payload = list.map((r) => {
    const key = String(r.subid).trim();
    const prev = prevMap[key.toLowerCase()] || {};
    let statusSource = normalizeStatusSource(prev.status_source);
    if (r.status_source !== undefined) {
      statusSource = normalizeStatusSource(r.status_source);
    } else if (r.status != null && statusSource !== "manual") {
      // bulk da API/CSV: marca origem, sem roubar trava manual
      statusSource = normalizeStatusSource(r.status_source_hint) || statusSource;
    }
    return {
      user_id: userId,
      subid: key,
      canal: r.canal !== undefined ? normalizeCanal(r.canal) : normalizeCanal(prev.canal),
      status: r.status != null ? normalizeStatus(r.status) : normalizeStatus(prev.status),
      produto: r.produto != null ? r.produto : (prev.produto || null),
      status_source: statusSource,
      updated_at: now,
    };
  });
  const supabase = getSupabase();
  let error = null;
  for (let i = 0; i < payload.length; i += 200) {
    const chunk = payload.slice(i, i + 200);
    ({ error } = await supabase.from("subid_ops").upsert(chunk, { onConflict: "user_id,subid" }));
    if (error && /status_source|indefinido|canal/i.test(error.message || "")) {
      try {
        const { ensureConfigSchema } = require("./ensureDb");
        await ensureConfigSchema();
      } catch (_) { /* ignore */ }
      ({ error } = await supabase.from("subid_ops").upsert(chunk, { onConflict: "user_id,subid" }));
    }
    if (error && /status_source/i.test(error.message || "")) {
      const legacy = chunk.map(({ status_source: _s, ...rest }) => rest);
      ({ error } = await supabase.from("subid_ops").upsert(legacy, { onConflict: "user_id,subid" }));
    }
    if (error) throw new Error(error.message);
  }
  return payload.length;
}

async function persistInferredOps(subIds, userId = requireUserId()) {
  const list = Array.isArray(subIds) ? subIds : [];
  if (!list.length) return 0;
  const opsMap = await loadSubidOps(userId);
  const now = new Date().toISOString();
  const rows = [];
  for (const r of list) {
    const subid = String(r.subid || "").trim();
    if (!subid) continue;
    const key = subid.toLowerCase();
    if (opsMap[key]) continue;
    const canal = inferCanal(r.subid, r.inv_meta, r.inv_pin);
    if (canal !== "indefinido") continue;
    rows.push({
      user_id: userId,
      subid,
      canal: "indefinido",
      status: null,
      status_source: null,
      produto: r.produto || null,
      updated_at: now,
    });
  }
  if (!rows.length) return 0;
  const supabase = getSupabase();
  let { error } = await supabase.from("subid_ops").upsert(rows, { onConflict: "user_id,subid" });
  if (error && /status_source|indefinido|canal/i.test(error.message || "")) {
    try {
      const { ensureConfigSchema } = require("./ensureDb");
      await ensureConfigSchema();
    } catch (_) { /* ignore */ }
    ({ error } = await supabase.from("subid_ops").upsert(rows, { onConflict: "user_id,subid" }));
  }
  if (error && /status_source/i.test(error.message || "")) {
    const legacy = rows.map(({ status_source: _s, ...rest }) => rest);
    ({ error } = await supabase.from("subid_ops").upsert(legacy, { onConflict: "user_id,subid" }));
  }
  if (error) {
    console.warn("[subidOps] persist indefinidos:", error.message);
    return 0;
  }
  return rows.length;
}

function inferCanal(subid, invMeta, invPin) {
  const invM = Number(invMeta || 0);
  const invP = Number(invPin || 0);
  // Canal pago só com gasto real (Meta API / CSV Pin)
  if (invM > 0 && invP <= 0) return "meta";
  if (invP > 0 && invM <= 0) return "pinterest";
  // Sem sinal claro de canal pago: cai como indefinido para o usuário classificar manualmente.
  // "Orgânico" só via classificação manual — nunca inferido.
  return "indefinido";
}

function applyOpsToSubIds(subIds, opsMap) {
  return (subIds || []).map((r) => {
    const key = String(r.subid || "").trim().toLowerCase();
    const op = opsMap[key] || {};
    // Manual (subid_ops) sempre vence; senão inferência por gasto / naming
    const canal = op.canal || inferCanal(r.subid, r.inv_meta, r.inv_pin);
    // Status só de subid_ops (API Meta / CSV Pin / manual). Sem fallback por lucro.
    let status = op.status || r.status || "ativa";
    if (status === "pausada") status = "desativada";
    return {
      ...r,
      canal,
      status,
      produto: op.produto || r.produto || null,
      status_source: op.status_source || null,
    };
  });
}

module.exports = {
  loadSubidOps,
  upsertSubidOps,
  upsertSubidOpsMany,
  applyOpsToSubIds,
  inferCanal,
  persistInferredOps,
  normalizeStatusSource,
};
