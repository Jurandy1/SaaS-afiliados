"use strict";

const fs = require("fs");
const path = require("path");
const embeddedFonts = require("./pushFontsEmbedded");

const FONT_NAME = "Geist-Regular.ttf";

let _fonts = null;
let _ogModule = null;
let _Resvg = null;

// Lazy-load: @resvg/resvg-js ships platform-specific native binaries. If the
// binary for the deploy target is missing (a common Vercel bundling gotcha),
// a top-level require() would crash this whole module and take the banner
// endpoint down with it. Loading it on-demand keeps the main banner path
// (which reads a pre-rendered PNG from disk, see getBagDataUri) working even
// if this native module can't load.
function getResvg() {
  if (_Resvg) return _Resvg;
  ({ Resvg: _Resvg } = require("@resvg/resvg-js"));
  return _Resvg;
}

async function getImageResponse() {
  if (!_ogModule) _ogModule = await import("@vercel/og");
  return _ogModule.ImageResponse;
}

function toArrayBuffer(buf) {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

function loadFontBuffer(name) {
  const disk = path.join(__dirname, "fonts", name);
  if (fs.existsSync(disk)) return fs.readFileSync(disk);
  const og = path.join(__dirname, "..", "node_modules", "@vercel", "og", "dist", "Geist-Regular.ttf");
  if (name === FONT_NAME && fs.existsSync(og)) return fs.readFileSync(og);
  const b64 = embeddedFonts[name];
  if (b64) return Buffer.from(b64, "base64");
  return null;
}

function getOgFonts() {
  if (_fonts) return _fonts;
  const geist = loadFontBuffer(FONT_NAME);
  if (!geist) throw new Error("Fonte Geist não carregada");
  const data = toArrayBuffer(geist);
  _fonts = [400, 500, 700, 800].map((weight) => ({
    name: "Geist",
    data,
    weight,
    style: "normal",
  }));
  return _fonts;
}

function getBagDataUri() {
  const disk = path.join(__dirname, "..", "public", "assets", "push", "shopee-bag-150.png");
  let b64 = "";
  if (fs.existsSync(disk)) {
    b64 = fs.readFileSync(disk).toString("base64");
  } else if (embeddedFonts["shopee-bag-150.png"]) {
    b64 = embeddedFonts["shopee-bag-150.png"];
  } else {
    b64 = renderBagPng(150).toString("base64");
  }
  return b64 ? `data:image/png;base64,${b64}` : "";
}

function fmtMoney(n) {
  return Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildBannerElement({ lucro = 0, com = 0 } = {}) {
  const lucroFmt = fmtMoney(lucro);
  const comFmt = fmtMoney(com);
  const bagUri = getBagDataUri();

  const bagNode = bagUri
    ? {
        type: "img",
        props: {
          src: bagUri,
          width: 210,
          height: 210,
          style: { flexShrink: 0 },
        },
      }
    : { type: "div", props: { style: { width: "210px", height: "210px", flexShrink: 0 } } };

  return {
    type: "div",
    props: {
      style: {
        // 1024x512 = proporção 2:1, recomendada pelo Chrome/Android para a
        // imagem grande ("image") de notificações push — evita corte/recusa
        // de exibição em alguns aparelhos.
        width: "1024px",
        height: "512px",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        padding: "64px 72px",
        gap: "44px",
        borderRadius: "40px",
        background:
          "radial-gradient(120% 160% at 8% 15%, rgba(255,196,120,0.55) 0%, rgba(255,196,120,0) 38%), linear-gradient(128deg, #FF9142 0%, #FF7620 22%, #F5540D 52%, #E23F0D 74%, #C9330A 100%)",
        fontFamily: "Geist",
      },
      children: [
        bagNode,
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: "10px",
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    fontSize: "38px",
                    fontWeight: 700,
                    color: "#ffffff",
                    letterSpacing: "-0.3px",
                    lineHeight: 1.15,
                  },
                  children: "Lucro Líquido",
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    fontSize: "84px",
                    fontWeight: 800,
                    color: "#ffffff",
                    letterSpacing: "-1.2px",
                    lineHeight: 1.05,
                    textShadow: "0 2px 10px rgba(0,0,0,0.15)",
                  },
                  children: `R$ ${lucroFmt}`,
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    alignItems: "baseline",
                    gap: "8px",
                    marginTop: "6px",
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          fontSize: "26px",
                          fontWeight: 500,
                          color: "rgba(255,255,255,0.82)",
                        },
                        children: "Comissão Shopee Total",
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          fontSize: "30px",
                          fontWeight: 700,
                          color: "#ffffff",
                        },
                        children: `R$ ${comFmt}`,
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  };
}

/** Sacola branca + S laranja (sem moeda) */
function buildBagSvg(size) {
  const s = size / 150;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <g transform="translate(${size / 2}, ${size / 2}) scale(${s})">
    <path d="M-28,-18 C-28,-48 28,-48 28,-18" fill="none" stroke="#fff" stroke-width="11" stroke-linecap="round"/>
    <path d="M-48,-14 L-40,52 Q-40,62 -28,62 L28,62 Q40,62 40,52 L48,-14 Z" fill="#fff"/>
    <text x="0" y="38" text-anchor="middle" font-family="Geist,Arial,sans-serif" font-size="52" font-weight="800" fill="#EE4D2D">S</text>
  </g>
</svg>`;
}

/** Moeda 3D (ícone/badge do sistema) */
function buildCoinSvg(size) {
  const r = size / 2;
  const s = size / 118;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="coin" cx="32%" cy="26%" r="72%">
      <stop offset="0%" stop-color="#FFAE5E"/>
      <stop offset="35%" stop-color="#FF7A28"/>
      <stop offset="72%" stop-color="#E8450F"/>
      <stop offset="100%" stop-color="#9E2808"/>
    </radialGradient>
    <filter id="shadow"><feDropShadow dx="0" dy="${3 * s}" stdDeviation="${4 * s}" flood-color="#000" flood-opacity="0.35"/></filter>
  </defs>
  <circle cx="${r}" cy="${r + 2 * s}" r="${r - 2 * s}" fill="#000" opacity="0.2"/>
  <circle cx="${r}" cy="${r}" r="${r - 2 * s}" fill="url(#coin)" filter="url(#shadow)"/>
  <circle cx="${r}" cy="${r}" r="${r * 0.84}" fill="none" stroke="rgba(255,255,255,0.38)" stroke-width="${Math.max(1.5, 2.2 * s)}"/>
  <ellipse cx="${r * 0.72}" cy="${r * 0.55}" rx="${r * 0.12}" ry="${r * 0.08}" fill="rgba(255,255,255,0.88)"/>
  <g transform="translate(${r}, ${r}) scale(${s})">
    <path d="M-14,-4 C-14,-16 14,-16 14,-4" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
    <rect x="-22" y="-4" width="44" height="36" rx="5" fill="#fff"/>
    <text x="0" y="20" text-anchor="middle" font-family="Geist,Arial,sans-serif" font-size="26" font-weight="800" fill="#EE4D2D">S</text>
  </g>
</svg>`;
}

const _cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function bannerCacheKey(params) {
  const { lucro, com } = params;
  return `${Number(lucro).toFixed(2)}|${Number(com || 0).toFixed(2)}|bag-lucro-com`;
}

async function renderCommissionBannerPng(params = {}) {
  const key = bannerCacheKey(params);
  const hit = _cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.buf;

  const ImageResponse = await getImageResponse();
  const response = new ImageResponse(buildBannerElement(params), {
    width: 1024,
    height: 512,
    fonts: getOgFonts(),
  });

  const buf = Buffer.from(await response.arrayBuffer());
  _cache.set(key, { buf, at: Date.now() });
  return buf;
}

function renderCoinPng(size) {
  const svg = buildCoinSvg(size);
  const Resvg = getResvg();
  return new Resvg(svg, {
    fitTo: { mode: "width", value: size },
    font: { loadSystemFonts: false, fontBuffers: [loadFontBuffer(FONT_NAME)].filter(Boolean), defaultFontFamily: "Geist" },
  }).render().asPng();
}

function renderBagPng(size) {
  const svg = buildBagSvg(size);
  const Resvg = getResvg();
  return new Resvg(svg, {
    fitTo: { mode: "width", value: size },
    font: { loadSystemFonts: false, fontBuffers: [loadFontBuffer(FONT_NAME)].filter(Boolean), defaultFontFamily: "Geist" },
  }).render().asPng();
}

module.exports = {
  renderCommissionBannerPng,
  renderCoinPng,
  renderBagPng,
  bannerCacheKey,
  fmtMoney,
};
