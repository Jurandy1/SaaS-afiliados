"use strict";

const fs = require("fs");
const path = require("path");
const { Resvg } = require("@resvg/resvg-js");
const embeddedFonts = require("./pushFontsEmbedded");

const ICON_PATH = path.join(__dirname, "..", "public", "assets", "push", "shopee-icon.png");
const FONT_NAMES = ["Inter-ExtraBold.woff", "Inter-Medium.woff"];

let _iconB64 = null;
let _fontBuffers = null;

function loadFontBuffer(name) {
  const disk = path.join(__dirname, "fonts", name);
  if (fs.existsSync(disk)) return fs.readFileSync(disk);
  const b64 = embeddedFonts[name];
  if (b64) return Buffer.from(b64, "base64");
  return null;
}

function getFontBuffers() {
  if (_fontBuffers) return _fontBuffers;
  _fontBuffers = FONT_NAMES.map(loadFontBuffer).filter(Boolean);
  return _fontBuffers;
}

function getIconB64() {
  if (_iconB64) return _iconB64;
  if (fs.existsSync(ICON_PATH)) {
    _iconB64 = fs.readFileSync(ICON_PATH).toString("base64");
  } else if (embeddedFonts["shopee-icon.png"]) {
    _iconB64 = embeddedFonts["shopee-icon.png"];
  }
  return _iconB64 || "";
}

function fmtMoney(n) {
  return Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeXml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildBannerSvg({ com = 0, lucro = 0, pedidos = 0, date = "" }) {
  const comFmt = fmtMoney(com);
  const lucroFmt = fmtMoney(lucro);
  const iconB64 = getIconB64();
  const iconImg = iconB64
    ? `<image href="data:image/png;base64,${iconB64}" x="28" y="28" width="62" height="62" preserveAspectRatio="xMidYMid meet"/>`
    : "";
  const subtitle = pedidos > 0
    ? `Lucro Líquido: R$ ${lucroFmt} · ${pedidos} pedido${pedidos !== 1 ? "s" : ""}`
    : `Lucro Líquido: R$ ${lucroFmt}`;
  const dateLine = date ? escapeXml(date) : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="210" viewBox="0 0 900 210">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF9142"/>
      <stop offset="22%" stop-color="#FF7620"/>
      <stop offset="52%" stop-color="#F5540D"/>
      <stop offset="74%" stop-color="#E23F0D"/>
      <stop offset="100%" stop-color="#C9330A"/>
    </linearGradient>
    <radialGradient id="shine" cx="8%" cy="15%" r="60%">
      <stop offset="0%" stop-color="#FFC478" stop-opacity="0.55"/>
      <stop offset="38%" stop-color="#FFC478" stop-opacity="0"/>
    </radialGradient>
    <filter id="blurA"><feGaussianBlur stdDeviation="9"/></filter>
    <filter id="blurB"><feGaussianBlur stdDeviation="3"/></filter>
    <linearGradient id="fita1" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/>
      <stop offset="0.5" stop-color="#fff" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="coin" cx="32%" cy="28%" r="70%">
      <stop offset="0%" stop-color="#FF9E52"/>
      <stop offset="42%" stop-color="#FF6E1E"/>
      <stop offset="78%" stop-color="#D8420D"/>
      <stop offset="100%" stop-color="#A82A07"/>
    </radialGradient>
  </defs>
  <rect width="900" height="210" fill="url(#bg)"/>
  <rect width="900" height="210" fill="url(#shine)"/>
  <path d="M120,150 C300,60 420,230 620,110 C760,30 850,90 940,40" fill="none" stroke="#fff" stroke-opacity="0.16" stroke-width="46" filter="url(#blurA)"/>
  <path d="M60,190 C260,270 400,60 640,170 C800,240 900,150 980,190" fill="none" stroke="#fff" stroke-opacity="0.10" stroke-width="60" filter="url(#blurA)"/>
  <path d="M150,120 C330,40 450,200 660,80 C790,10 880,70 950,20" fill="none" stroke="url(#fita1)" stroke-width="5" filter="url(#blurB)"/>
  <path d="M100,175 C290,250 430,80 660,180 C820,250 910,170 970,205" fill="none" stroke="url(#fita1)" stroke-width="4" filter="url(#blurB)"/>
  <radialGradient id="vin" cx="100%" cy="120%" r="120%">
    <stop offset="0%" stop-color="#000" stop-opacity="0.28"/>
    <stop offset="55%" stop-color="#000" stop-opacity="0"/>
  </radialGradient>
  <rect width="900" height="210" fill="url(#vin)"/>
  <g transform="translate(42,46)">
    <circle cx="59" cy="59" r="59" fill="url(#coin)" stroke="rgba(0,0,0,0.15)" stroke-width="1"/>
    <circle cx="59" cy="59" r="48" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="2"/>
    <circle cx="42" cy="38" r="8" fill="rgba(255,255,255,0.9)"/>
    ${iconImg}
  </g>
  <g transform="translate(160,52)">
    <rect x="0" y="0" width="178" height="32" rx="16" fill="#fff"/>
    <text x="14" y="21" font-family="Inter" font-size="13" font-weight="800" fill="#E8460F">COMISSÃO TOTAL</text>
    <text x="0" y="88" font-family="Inter" font-size="52" font-weight="800" fill="#ffffff">R$ ${escapeXml(comFmt)}</text>
    <text x="0" y="118" font-family="Inter" font-size="14" font-weight="500" fill="rgba(255,255,255,0.78)">${escapeXml(subtitle)}</text>
    ${dateLine ? `<text x="0" y="140" font-family="Inter" font-size="12" font-weight="500" fill="rgba(255,255,255,0.55)">${dateLine}</text>` : ""}
  </g>
</svg>`;
}

function buildCoinSvg(size) {
  const iconB64 = getIconB64();
  const iconSize = Math.round(size * 0.56);
  const iconOffset = Math.round((size - iconSize) / 2);
  const iconImg = iconB64
    ? `<image href="data:image/png;base64,${iconB64}" x="${iconOffset}" y="${iconOffset}" width="${iconSize}" height="${iconSize}" preserveAspectRatio="xMidYMid meet"/>`
    : "";
  const r = size / 2;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="coin" cx="32%" cy="28%" r="70%">
      <stop offset="0%" stop-color="#FF9E52"/>
      <stop offset="42%" stop-color="#FF6E1E"/>
      <stop offset="78%" stop-color="#D8420D"/>
      <stop offset="100%" stop-color="#A82A07"/>
    </radialGradient>
  </defs>
  <circle cx="${r}" cy="${r}" r="${r - 1}" fill="url(#coin)"/>
  <circle cx="${r}" cy="${r}" r="${r * 0.82}" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="${Math.max(1, size * 0.02)}"/>
  <circle cx="${r * 0.7}" cy="${r * 0.55}" r="${size * 0.08}" fill="rgba(255,255,255,0.9)"/>
  ${iconImg}
</svg>`;
}

const _cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function bannerCacheKey(params) {
  const { com, lucro, pedidos, date } = params;
  return `${Number(com).toFixed(2)}|${Number(lucro).toFixed(2)}|${pedidos}|${date || ""}`;
}

function renderSvgToPng(svg, width) {
  const fonts = getFontBuffers();
  if (!fonts.length) {
    throw new Error("Fontes Inter não carregadas");
  }
  const resvg = new Resvg(svg, {
    fitTo: width ? { mode: "width", value: width } : undefined,
    font: {
      loadSystemFonts: false,
      fontBuffers: fonts,
      defaultFontFamily: "Inter",
    },
  });
  return resvg.render().asPng();
}

function renderCommissionBannerPng(params = {}) {
  const key = bannerCacheKey(params);
  const hit = _cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.buf;

  const svg = buildBannerSvg(params);
  const buf = renderSvgToPng(svg, 900);
  _cache.set(key, { buf, at: Date.now() });
  return buf;
}

function renderCoinPng(size) {
  const svg = buildCoinSvg(size);
  return renderSvgToPng(svg, size);
}

module.exports = {
  buildBannerSvg,
  renderCommissionBannerPng,
  renderCoinPng,
  bannerCacheKey,
  fmtMoney,
};
