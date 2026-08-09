"use strict";

const crypto = require("crypto");
// credentials loaded async via getCredsAsync

const SHOPEE_API_URL = "https://open-api.affiliate.shopee.com.br/graphql";

function getCreds() {
  // sync wrapper — callers must use getCredsAsync in new code; kept for internal use after cache
  throw new Error("Use getCredsAsync()");
}

let _credsCache = new Map();

async function getCredsAsync() {
  const { requireUserId } = require("./auth");
  const userId = requireUserId();
  const cached = _credsCache.get(userId);
  if (cached && Date.now() - cached.at < 5000) return cached.value;
  const { loadCredentials } = require("./store");
  const c = await loadCredentials(userId);
  if (!c.appId || !c.secret) {
    const err = new Error("Configure SHOPEE_APP_ID e SHOPEE_SECRET em Configuração");
    err.code = "SHOPEE_CREDS_MISSING";
    throw err;
  }
  const value = { appId: c.appId, secret: c.secret };
  _credsCache.set(userId, { at: Date.now(), value });
  return value;
}

function clearCredsCache(userId) {
  if (userId) _credsCache.delete(userId);
  else _credsCache.clear();
}

function sign(appId, timestamp, payload, secret) {
  return crypto.createHash("sha256").update(appId + timestamp + payload + secret).digest("hex");
}

async function shopeeGraphql(query, variables = null, { retries = 3 } = {}) {
  const { appId, secret } = await getCredsAsync();
  const bodyObj = variables ? { query, variables } : { query };
  const body = JSON.stringify(bodyObj);
  let lastErr = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = sign(appId, timestamp, body, secret);
    try {
      const res = await fetch(SHOPEE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`,
        },
        body,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status}: ${JSON.stringify(json).slice(0, 200)}`);
        if (res.status === 429 && attempt < retries) {
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
          continue;
        }
        throw lastErr;
      }
      if (json.errors?.length) {
        const msg = json.errors.map((e) => e.message || String(e)).join("; ");
        lastErr = new Error(msg);
        if (/rate|limit|quota|throttl/i.test(msg) && attempt < retries) {
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
          continue;
        }
        throw lastErr;
      }
      return json.data || {};
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        continue;
      }
    }
  }
  throw lastErr || new Error("Falha na API Shopee");
}

async function shopeeGraphqlWithCreds(appId, secret, query, variables = null, { retries = 2 } = {}) {
  const id = String(appId || "").trim();
  const sec = String(secret || "").trim();
  if (!id || !sec) throw new Error("Informe APP_ID e SECRET da Shopee");
  const bodyObj = variables ? { query, variables } : { query };
  const body = JSON.stringify(bodyObj);
  let lastErr = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = sign(id, timestamp, body, sec);
    try {
      const res = await fetch(SHOPEE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `SHA256 Credential=${id}, Timestamp=${timestamp}, Signature=${signature}`,
        },
        body,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        lastErr = new Error(`Shopee HTTP ${res.status}`);
        if (res.status === 429 && attempt < retries) {
          await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
          continue;
        }
        throw lastErr;
      }
      if (json.errors?.length) {
        const msg = json.errors.map((e) => e.message || String(e)).join("; ");
        throw new Error(`Shopee: ${msg}`);
      }
      return json.data || {};
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
        continue;
      }
    }
  }
  throw lastErr || new Error("Falha ao validar API Shopee");
}

/** Teste rápido de credencial (conta logada). */
async function testCredentials() {
  const data = await shopeeGraphql(`{
    productOfferV2(page: 1, limit: 1, listType: 0, sortType: 2) {
      nodes { itemId productName priceMin commissionRate }
      pageInfo { hasNextPage }
    }
  }`);
  const node = data?.productOfferV2?.nodes?.[0] || null;
  return { ok: true, sample: node };
}

/** Valida APP_ID + SECRET sem precisar de sessão. */
async function testCredentialsPair(appId, secret) {
  const data = await shopeeGraphqlWithCreds(appId, secret, `{
    productOfferV2(page: 1, limit: 1, listType: 0, sortType: 2) {
      nodes { itemId productName priceMin commissionRate }
      pageInfo { hasNextPage }
    }
  }`);
  const node = data?.productOfferV2?.nodes?.[0] || null;
  return { ok: true, sample: node };
}

function classifyStatus(raw) {
  const s = String(raw || "").toUpperCase().trim();
  if (!s) return "pendente";
  if (s.includes("CANCEL") || s.includes("REFUND") || s.includes("FRAUD") || s.includes("REJECT") || s.includes("VOID") || s.includes("INVALID") || s === "FAILED" || s === "EXPIRED") {
    return "cancelada";
  }
  if (s === "UNPAID") return "unpaid";
  if (s.includes("COMPLETE") || s.includes("CONCLU") || s.includes("SETTLE") || s.includes("FINISH")) return "concluida";
  return "pendente";
}

function parseMoney(v) {
  const n = Number(String(v ?? "0").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function parseSubId(utmContent) {
  const { normalizeShopeeSubId } = require("./normalizeSubId");
  return normalizeShopeeSubId(utmContent) || "organico";
}

function toUnixDayStart(dateStr) {
  // dateStr YYYY-MM-DD em BRT ≈ UTC-3
  const [y, m, d] = dateStr.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d, 3, 0, 0) / 1000);
}

function toUnixDayEnd(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d + 1, 2, 59, 59) / 1000);
}

function dateFromPurchaseTs(ts) {
  const ms = Number(ts) * 1000 - 3 * 3600 * 1000; // approx BRT
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Puxa conversionReport completo no intervalo (scrollId, gap 1.2s).
 */
async function pullConversionReport(startDate, endDate) {
  const startTs = toUnixDayStart(startDate);
  const endTs = toUnixDayEnd(endDate);
  const nodes = [];
  let scrollId = null;
  let hasNext = true;
  let pages = 0;

  while (hasNext && pages < 80) {
    pages += 1;
    const scrollClause = scrollId ? `, scrollId: "${scrollId}"` : "";
    const query = `{
      conversionReport(
        conversionStatus: ALL
        categoryType: ALL
        orderStatus: ALL
        buyerType: ALL
        productType: ALL
        fraudStatus: ALL
        device: ALL
        purchaseTimeStart: ${startTs}
        purchaseTimeEnd: ${endTs}
        limit: 100
        ${scrollClause}
      ) {
        nodes {
          purchaseTime
          conversionId
          totalCommission
          netCommission
          utmContent
          orders {
            orderId
            orderStatus
            items {
              itemId
              itemName
              shopName
              qty
              actualAmount
              itemTotalCommission
              fraudStatus
            }
          }
        }
        pageInfo { hasNextPage scrollId }
      }
    }`;

    const data = await shopeeGraphql(query);
    const report = data?.conversionReport || {};
    const batch = Array.isArray(report.nodes) ? report.nodes : [];
    nodes.push(...batch);
    hasNext = Boolean(report.pageInfo?.hasNextPage);
    scrollId = report.pageInfo?.scrollId || null;
    if (hasNext) await new Promise((r) => setTimeout(r, 1200));
  }

  return { nodes, pages, startTs, endTs };
}

module.exports = {
  testCredentials,
  testCredentialsPair,
  pullConversionReport,
  classifyStatus,
  parseMoney,
  parseSubId,
  dateFromPurchaseTs,
  getCredsAsync,
  clearCredsCache,
};
