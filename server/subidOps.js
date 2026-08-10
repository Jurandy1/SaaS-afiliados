"use strict";

const { getSupabase } = require("./supabase");
const { requireUserId } = require("./auth");

async function loadSubidOps(userId = requireUserId()) {
  const supabase = getSupabase();
  try {
    const { data, error } = await supabase.from("subid_ops").select("*").eq("user_id", userId);
    if (error) throw error;
    const map = {};
    for (const r of data || []) {
      map[String(r.subid || "").toLowerCase()] = {
        canal: r.canal || null,
        status: r.status || null,
        produto: r.produto || null,
      };
    }
    return map;
  } catch (e) {
    console.warn("[subidOps] load:", e.message);
    return {};
  }
}

async function upsertSubidOps(subid, partial, userId = requireUserId()) {
  const key = String(subid || "").trim();
  if (!key) throw new Error("SubID obrigatório");
  const supabase = getSupabase();
  const prevMap = await loadSubidOps(userId);
  const prev = prevMap[key.toLowerCase()] || {};
  const row = {
    user_id: userId,
    subid: key,
    canal: partial.canal != null ? partial.canal : prev.canal,
    status: partial.status != null ? partial.status : prev.status,
    produto: partial.produto != null ? partial.produto : prev.produto,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("subid_ops").upsert(row, { onConflict: "user_id,subid" });
  if (error) throw new Error(error.message);
  return row;
}

function applyOpsToSubIds(subIds, opsMap) {
  return (subIds || []).map((r) => {
    const key = String(r.subid || "").trim().toLowerCase();
    const op = opsMap[key] || {};
    let canal = op.canal || r.canal || null;
    if (!canal) {
      const invM = Number(r.inv_meta || 0);
      const invP = Number(r.inv_pin || 0);
      if (invM > 0 && invP <= 0) canal = "meta";
      else if (invP > 0 && invM <= 0) canal = "pinterest";
      else if (invM <= 0 && invP <= 0) canal = "organico";
      else canal = "meta";
    }
    const status = op.status || r.status || (Number(r.lucro || 0) < 0 ? "pausada" : "ativa");
    return { ...r, canal, status, produto: op.produto || r.produto || null };
  });
}

module.exports = { loadSubidOps, upsertSubidOps, applyOpsToSubIds };
