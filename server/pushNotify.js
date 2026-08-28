"use strict";

const webpush = require("web-push");
const { getSupabaseAdmin } = require("./auth");

let _vapidReady = false;
function ensureVapid() {
  if (_vapidReady) return true;
  const pub = process.env.VAPID_PUBLIC_KEY || "";
  const priv = process.env.VAPID_PRIVATE_KEY || "";
  const mailto = process.env.VAPID_MAILTO || "mailto:admin@example.com";
  if (pub && priv) {
    webpush.setVapidDetails(mailto, pub, priv);
    _vapidReady = true;
    return true;
  }
  console.warn("[push] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY ausentes — push desativado");
  return false;
}

async function saveSubscription(userId, subscription) {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("push_subscriptions").upsert(
    { user_id: userId, endpoint: subscription.endpoint, subscription: JSON.stringify(subscription) },
    { onConflict: "endpoint" },
  );
  if (error) throw new Error(error.message);
}

async function removeSubscription(endpoint) {
  const sb = getSupabaseAdmin();
  await sb.from("push_subscriptions").delete().eq("endpoint", endpoint);
}

async function sendToUser(userId, payload) {
  if (!ensureVapid()) return null;
  const sb = getSupabaseAdmin();
  const { data: subs, error } = await sb
    .from("push_subscriptions")
    .select("endpoint, subscription")
    .eq("user_id", userId);

  if (error) {
    console.warn("[push] list subs:", error.message);
    return null;
  }
  if (!subs || !subs.length) {
    console.warn(`[push] user ${userId} sem subscription`);
    return null;
  }

  const body = JSON.stringify(payload);
  const results = await Promise.allSettled(
    subs.map(async (row) => {
      try {
        await webpush.sendNotification(JSON.parse(row.subscription), body);
        return { ok: true, endpoint: row.endpoint };
      } catch (err) {
        console.warn(`[push] send fail ${err.statusCode || ""}:`, err.message || err);
        if (err.statusCode === 410 || err.statusCode === 404) {
          await removeSubscription(row.endpoint);
        }
        throw err;
      }
    }),
  );
  const ok = results.filter((r) => r.status === "fulfilled").length;
  console.log(`[push] sendToUser ${userId}: ${ok}/${subs.length} ok`);
  return results;
}

function getPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || "";
}

module.exports = { saveSubscription, removeSubscription, sendToUser, getPublicKey };
