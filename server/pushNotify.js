"use strict";

const webpush = require("web-push");
const { getSupabaseAdmin } = require("./auth");

let _vapidReady = false;
function ensureVapid() {
  if (_vapidReady) return;
  const pub = process.env.VAPID_PUBLIC_KEY || "";
  const priv = process.env.VAPID_PRIVATE_KEY || "";
  const mailto = process.env.VAPID_MAILTO || "mailto:admin@example.com";
  if (pub && priv) {
    webpush.setVapidDetails(mailto, pub, priv);
    _vapidReady = true;
  }
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
  ensureVapid();
  if (!_vapidReady) return;
  const sb = getSupabaseAdmin();
  const { data: subs } = await sb
    .from("push_subscriptions")
    .select("endpoint, subscription")
    .eq("user_id", userId);

  if (!subs || !subs.length) return;

  const body = JSON.stringify(payload);
  const results = await Promise.allSettled(
    subs.map(async (row) => {
      try {
        await webpush.sendNotification(JSON.parse(row.subscription), body);
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await removeSubscription(row.endpoint);
        }
      }
    }),
  );
  return results;
}

function getPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || "";
}

module.exports = { saveSubscription, removeSubscription, sendToUser, getPublicKey };
