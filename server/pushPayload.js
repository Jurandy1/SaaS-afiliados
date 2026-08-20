"use strict";

const { fmtMoney } = require("./pushBanner");

function getPushBaseUrl(req) {
  const env = String(process.env.PUBLIC_BASE_URL || "").trim().replace(/\/$/, "");
  if (env) return env;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (req?.headers?.host) {
    const proto = String(req.headers["x-forwarded-proto"] || "http").split(",")[0].trim();
    return `${proto}://${req.headers.host}`;
  }
  const port = process.env.PORT || 3790;
  return `http://localhost:${port}`;
}

function formatDateBr(iso) {
  if (!iso) return "";
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function buildCommissionPush({ com, lucro, pedidos, date, baseUrl }) {
  const comNum = Number(com || 0);
  const lucroNum = Number(lucro || 0);
  const pedidosNum = Number(pedidos || 0);
  const comFmt = fmtMoney(comNum);
  const lucroFmt = fmtMoney(lucroNum);
  const origin = String(baseUrl || "").replace(/\/$/, "") || "https://saa-s-afiliados.vercel.app";
  const qs = new URLSearchParams({
    com: String(comNum),
    lucro: String(lucroNum),
    pedidos: String(pedidosNum),
  });
  if (date) qs.set("d", date);
  qs.set("v", "14");

  return {
    title: "Lucro Líquido",
    body: `R$ ${lucroFmt}`,
    icon: `${origin}/assets/shopee.png`,
    badge: `${origin}/assets/push/shopee-coin-72.png`,
    image: `${origin}/api/push/banner.png?${qs.toString()}`,
    tag: "comissao-ontem",
    url: "/",
    com: comNum,
    lucro: lucroNum,
    pedidos: pedidosNum,
    date: date || null,
    comFmt,
    lucroFmt,
  };
}

module.exports = { getPushBaseUrl, buildCommissionPush, formatDateBr };
