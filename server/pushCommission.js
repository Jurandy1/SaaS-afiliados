"use strict";

/**
 * Notifica o usuário quando a comissão de ontem (BRT) chega / muda.
 * Dedup por data + fingerprint (com|lucro|pedidos) — não spam a cada sync.
 */

const { getSupabaseAdmin, runWithUser } = require("./auth");
const { buildDashboard } = require("./metrics");
const { shopeeEndDate } = require("./brtDates");
const { sendToUser } = require("./pushNotify");
const { buildCommissionPush, getPushBaseUrl } = require("./pushPayload");

function fingerprint({ com, lucro, pedidos }) {
  return `${Number(com || 0).toFixed(2)}|${Number(lucro || 0).toFixed(2)}|${Number(pedidos || 0)}`;
}

async function alreadyNotified(userId, dateKey, fp) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("push_notify_state")
    .select("fingerprint")
    .eq("user_id", userId)
    .eq("kind", "comissao-ontem")
    .eq("date_key", dateKey)
    .maybeSingle();
  if (error) {
    // Tabela pode não existir ainda — não bloqueia o push
    console.warn("[push] dedup read:", error.message);
    return false;
  }
  return data && data.fingerprint === fp;
}

async function markNotified(userId, dateKey, fp) {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("push_notify_state").upsert(
    {
      user_id: userId,
      kind: "comissao-ontem",
      date_key: dateKey,
      fingerprint: fp,
      notified_at: new Date().toISOString(),
    },
    { onConflict: "user_id,kind,date_key" },
  );
  if (error) console.warn("[push] dedup write:", error.message);
}

/**
 * @param {string} userId
 * @param {{ email?: string, baseUrl?: string, force?: boolean, req?: object }} [opts]
 */
async function notifyYesterdayCommission(userId, opts = {}) {
  const yesterday = shopeeEndDate();
  const email = opts.email || "";
  const baseUrl = opts.baseUrl || getPushBaseUrl(opts.req);
  const force = !!opts.force;

  let com = 0;
  let lucro = 0;
  let pedidos = 0;

  await runWithUser({ id: userId, email }, async () => {
    const dash = await buildDashboard({
      startDate: yesterday,
      endDate: yesterday,
      persist: false,
      persistSubIds: false,
    });
    com = Number(dash.kpis?.comissao || 0);
    lucro = Number(dash.kpis?.lucro || 0);
    pedidos = Number(dash.kpis?.pedidos || 0);
  });

  if (com <= 0) {
    console.log(`[push] skip ${email || userId}: comissão ontem (${yesterday}) = 0`);
    return { sent: false, reason: "com_zero", date: yesterday, com, lucro, pedidos };
  }

  const fp = fingerprint({ com, lucro, pedidos });
  if (!force && (await alreadyNotified(userId, yesterday, fp))) {
    console.log(`[push] skip ${email || userId}: já notificado ${yesterday} fp=${fp}`);
    return { sent: false, reason: "already", date: yesterday, com, lucro, pedidos };
  }

  const payload = buildCommissionPush({
    com,
    lucro,
    pedidos,
    date: yesterday,
    baseUrl,
  });

  // Aquece o banner na Vercel antes do celular tentar baixar
  if (payload.image) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      await fetch(payload.image, { signal: ctrl.signal, cache: "no-cache" });
      clearTimeout(t);
      console.log("[push] banner aquecido");
    } catch (e) {
      console.warn("[push] banner warm falhou:", e.message || e);
    }
  }

  const results = await sendToUser(userId, payload);
  const subCount = Array.isArray(results) ? results.length : 0;
  if (!results) {
    console.warn(`[push] não enviado ${email || userId}: VAPID ausente ou sem subscription`);
    return { sent: false, reason: "no_vapid_or_subs", date: yesterday, com, lucro, pedidos };
  }

  await markNotified(userId, yesterday, fp);
  console.log(`[push] enviado ${email || userId}: ${yesterday} com=${com} lucro=${lucro} subs=${subCount}`);
  return { sent: true, date: yesterday, com, lucro, pedidos, subs: subCount };
}

module.exports = { notifyYesterdayCommission, fingerprint };
