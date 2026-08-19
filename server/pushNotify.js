"use strict";

const webpush = require("web-push");
const { getSupabaseAdmin } = require("./auth");

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_MAILTO = process.env.VAPID_MAILTO || "mailto:admin@example.com";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_MAILTO, VAPID_PUBLIC, VAPID_PRIVATE);
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
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;
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
  return VAPID_PUBLIC;
}

module.exports = { saveSubscription, removeSubscription, sendToUser, getPublicKey };
