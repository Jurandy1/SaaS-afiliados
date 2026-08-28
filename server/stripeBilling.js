"use strict";

const Stripe = require("stripe");
const { getSupabaseAdmin } = require("./auth");
const { getProfile, upsertProfile } = require("./profiles");

const PRICE_MONTHLY = process.env.STRIPE_PRICE_MONTHLY || "price_1U87aaLcve75re8rKD3UjDZa";
const PRICE_6M = process.env.STRIPE_PRICE_6M || "price_1U87aaLcve75re8rXjAdHqri";
const PRICE_12M = process.env.STRIPE_PRICE_12M || "price_1U87aZLcve75re8rgdyW6j06";

const PLANS = [
  {
    id: "monthly",
    label: "Mensal",
    priceLabel: "R$ 69,90",
    periodLabel: "por mês",
    priceId: PRICE_MONTHLY,
    highlight: false,
  },
  {
    id: "6m",
    label: "6 meses",
    priceLabel: "R$ 349,90",
    periodLabel: "a cada 6 meses",
    priceId: PRICE_6M,
    highlight: true,
  },
  {
    id: "12m",
    label: "12 meses",
    priceLabel: "R$ 599,90",
    periodLabel: "por ano",
    priceId: PRICE_12M,
    highlight: false,
  },
];

let _stripe = null;

function getStripe() {
  const key = String(process.env.STRIPE_SECRET_KEY || "").trim();
  if (!key) {
    const err = new Error("STRIPE_SECRET_KEY não configurada");
    err.code = "STRIPE_NOT_CONFIGURED";
    throw err;
  }
  if (!_stripe) _stripe = new Stripe(key);
  return _stripe;
}

function listPlans() {
  return PLANS.map(({ id, label, priceLabel, periodLabel, priceId, highlight }) => ({
    id,
    label,
    priceLabel,
    periodLabel,
    priceId,
    highlight,
  }));
}

function resolvePriceId(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  const byId = PLANS.find((p) => p.id === raw || p.priceId === raw);
  return byId ? byId.priceId : (raw.startsWith("price_") ? raw : null);
}

function publicBaseUrl(req) {
  const env = String(process.env.PUBLIC_BASE_URL || "").trim().replace(/\/$/, "");
  if (env) return env;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (req?.headers?.host) {
    const proto = String(req.headers["x-forwarded-proto"] || "http").split(",")[0].trim();
    return `${proto}://${req.headers.host}`;
  }
  return `http://localhost:${process.env.PORT || 3790}`;
}

async function createCheckoutSession({ priceId, userId, email, req } = {}) {
  const stripe = getStripe();
  const resolved = resolvePriceId(priceId);
  if (!resolved) {
    const err = new Error("Plano inválido");
    err.code = "INVALID_PRICE";
    throw err;
  }

  const base = publicBaseUrl(req);
  const params = {
    mode: "subscription",
    line_items: [{ price: resolved, quantity: 1 }],
    // BRL: cartão precisa estar ativo em Settings → Payment methods
    payment_method_types: ["card"],
    success_url: `${base}/billing-success.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/#planos`,
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    metadata: {},
    subscription_data: { metadata: {} },
  };

  if (userId) {
    params.client_reference_id = String(userId);
    params.metadata.user_id = String(userId);
    params.subscription_data.metadata.user_id = String(userId);
    const profile = await getProfile(userId);
    if (profile?.stripe_customer_id) {
      params.customer = profile.stripe_customer_id;
    } else if (email || profile?.email) {
      params.customer_email = String(email || profile.email).toLowerCase();
    }
  } else if (email) {
    params.customer_email = String(email).toLowerCase();
  }

  const session = await stripe.checkout.sessions.create(params);
  return { url: session.url, sessionId: session.id };
}

async function createPortalSession({ customerId, req } = {}) {
  if (!customerId) {
    const err = new Error("Conta sem cliente Stripe. Assine um plano primeiro.");
    err.code = "NO_STRIPE_CUSTOMER";
    throw err;
  }
  const stripe = getStripe();
  const base = publicBaseUrl(req);
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${base}/app`,
  });
  return { url: session.url };
}

function constructEvent(rawBody, signature) {
  const stripe = getStripe();
  const secret = String(process.env.STRIPE_WEBHOOK_SECRET || "").trim();
  if (!secret) {
    const err = new Error("STRIPE_WEBHOOK_SECRET não configurada");
    err.code = "STRIPE_NOT_CONFIGURED";
    throw err;
  }
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}

async function findProfileByStripeRefs({ userId, customerId, email }) {
  const sb = getSupabaseAdmin();
  if (userId) {
    const p = await getProfile(userId);
    if (p) return p;
  }
  if (customerId) {
    const { data } = await sb
      .from("user_profiles")
      .select("*")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    if (data) return data;
  }
  if (email) {
    const { data } = await sb
      .from("user_profiles")
      .select("*")
      .eq("email", String(email).toLowerCase())
      .maybeSingle();
    if (data) return data;
  }
  return null;
}

function periodEndIso(sub) {
  const ts = sub?.current_period_end;
  if (!ts) return null;
  return new Date(Number(ts) * 1000).toISOString();
}

async function applySubscriptionToProfile(profile, {
  customerId,
  subscriptionId,
  priceId,
  status,
  periodEnd,
  approve = false,
} = {}) {
  if (!profile?.user_id) return null;
  const nextStatus = approve || status === "active" || status === "trialing"
    ? "approved"
    : profile.status;
  const payload = {
    ...profile,
    user_id: profile.user_id,
    stripe_customer_id: customerId || profile.stripe_customer_id || null,
    stripe_subscription_id: subscriptionId || profile.stripe_subscription_id || null,
    stripe_price_id: priceId || profile.stripe_price_id || null,
    subscription_status: status || profile.subscription_status || "none",
    subscription_current_period_end: periodEnd || profile.subscription_current_period_end || null,
    status: nextStatus,
  };
  if (nextStatus === "approved" && !profile.approved_at) {
    payload.approved_at = new Date().toISOString();
  }
  return upsertProfile(payload);
}

async function syncFromSubscription(subscription, { userId, email } = {}) {
  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer?.id;
  const priceId = subscription.items?.data?.[0]?.price?.id || null;
  const metaUserId = subscription.metadata?.user_id || userId || null;
  const profile = await findProfileByStripeRefs({
    userId: metaUserId,
    customerId,
    email,
  });
  if (!profile) {
    console.warn("[stripe] perfil não encontrado p/ sub", subscription.id, customerId, email);
    return null;
  }
  const active = subscription.status === "active" || subscription.status === "trialing";
  return applySubscriptionToProfile(profile, {
    customerId,
    subscriptionId: subscription.id,
    priceId,
    status: subscription.status,
    periodEnd: periodEndIso(subscription),
    approve: active,
  });
}

async function handleCheckoutCompleted(session) {
  const stripe = getStripe();
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  const subscriptionId = typeof session.subscription === "string"
    ? session.subscription
    : session.subscription?.id;
  const email = session.customer_details?.email || session.customer_email || null;
  const userId = session.client_reference_id || session.metadata?.user_id || null;

  let subscription = null;
  if (subscriptionId) {
    subscription = await stripe.subscriptions.retrieve(subscriptionId);
  }

  const profile = await findProfileByStripeRefs({ userId, customerId, email });
  if (!profile) {
    console.warn("[stripe] checkout sem perfil vinculado", session.id, email, userId);
    return { linked: false, email, customerId };
  }

  if (subscription) {
    await syncFromSubscription(subscription, { userId: profile.user_id, email });
  } else {
    await applySubscriptionToProfile(profile, {
      customerId,
      subscriptionId,
      priceId: null,
      status: "active",
      periodEnd: null,
      approve: true,
    });
  }
  return { linked: true, userId: profile.user_id };
}

async function handleWebhookEvent(event) {
  switch (event.type) {
    case "checkout.session.completed":
      return handleCheckoutCompleted(event.data.object);
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return syncFromSubscription(event.data.object);
    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const subId = typeof invoice.subscription === "string"
        ? invoice.subscription
        : invoice.subscription?.id;
      if (!subId) return null;
      const stripe = getStripe();
      const sub = await stripe.subscriptions.retrieve(subId);
      return syncFromSubscription(sub, {
        email: invoice.customer_email || null,
      });
    }
    default:
      return { ignored: event.type };
  }
}

module.exports = {
  PLANS,
  listPlans,
  resolvePriceId,
  publicBaseUrl,
  createCheckoutSession,
  createPortalSession,
  constructEvent,
  handleWebhookEvent,
  getStripe,
};
