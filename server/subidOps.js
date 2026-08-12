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

function inferCanal(subid, invMeta, invPin) {
  const invM = Number(invMeta || 0);
  const invP = Number(invPin || 0);
  if (invM > 0 && invP <= 0) return "meta";
  if (invP > 0 && invM <= 0) return "pinterest";
  if (invM > 0 && invP > 0) return "indefinido";
  const sid = String(subid || "").trim().toLowerCase();
  // Convenção comum: SubIDs Pin### sem CSV ainda → Pinterest
  if (/^pin\d/.test(sid) || /^pin[_-]/.test(sid) || sid === "pinterest") return "pinterest";
  // Sem mídia paga = orgânico (stories, links, busca, etc.)
  return "organico";
}

function applyOpsToSubIds(subIds, opsMap) {
  return (subIds || []).map((r) => {
    const key = String(r.subid || "").trim().toLowerCase();
    const op = opsMap[key] || {};
    // Manual (subid_ops) sempre vence; senão inferência por gasto / naming
    const canal = op.canal || inferCanal(r.subid, r.inv_meta, r.inv_pin);
    let status = op.status || r.status || (Number(r.lucro || 0) < 0 ? "desativada" : "ativa");
    if (status === "pausada") status = "desativada";
    return { ...r, canal, status, produto: op.produto || r.produto || null };
  });
}

module.exports = { loadSubidOps, upsertSubidOps, applyOpsToSubIds, inferCanal };
