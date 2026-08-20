"use strict";

const fs = require("fs");
const path = require("path");
const { Resvg } = require("@resvg/resvg-js");
const embeddedFonts = require("./pushFontsEmbedded");

const ICON_PATH = path.join(__dirname, "..", "public", "assets", "push", "shopee-icon.png");
const FONT_NAME = "Geist-Regular.ttf";

let _iconB64 = null;
let _fonts = null;
let _ogModule = null;

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

function buildBannerElement({ com = 0, lucro = 0, pedidos = 0 }) {
  const comFmt = fmtMoney(com);
  const lucroFmt = fmtMoney(lucro);
  const pedidosNum = Number(pedidos || 0);
  const subtitle = pedidosNum > 0
    ? `Lucro Líquido: R$ ${lucroFmt} · ${pedidosNum} pedido${pedidosNum !== 1 ? "s" : ""}`
    : `Lucro Líquido: R$ ${lucroFmt}`;
  const iconB64 = getIconB64();

  const coinChild = iconB64
    ? {
        type: "img",
        props: {
          src: `data:image/png;base64,${iconB64}`,
          width: 66,
          height: 66,
        },
      }
    : { type: "div", props: { style: { width: 66, height: 66 } } };

  return {
    type: "div",
    props: {
      style: {
        width: "900px",
        height: "210px",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        padding: "0 42px",
        gap: "28px",
        background:
          "radial-gradient(120% 160% at 8% 15%, rgba(255,196,120,0.55) 0%, rgba(255,196,120,0) 38%), linear-gradient(128deg, #FF9142 0%, #FF7620 22%, #F5540D 52%, #E23F0D 74%, #C9330A 100%)",
        fontFamily: "Geist",
      },
      children: [
        {
          type: "div",
          props: {
            style: {
              width: "118px",
              height: "118px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "radial-gradient(circle at 32% 28%, #FF9E52 0%, #FF6E1E 42%, #D8420D 78%, #A82A07 100%)",
              flexShrink: 0,
              boxShadow: "0 3px 0 rgba(0,0,0,0.25), 0 6px 14px rgba(0,0,0,0.35)",
            },
            children: coinChild,
          },
        },
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column", gap: "10px", flex: 1 },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    backgroundColor: "#ffffff",
                    color: "#E8460F",
                    fontWeight: 700,
                    fontSize: "14px",
                    padding: "8px 16px",
                    borderRadius: "999px",
                  },
                  children: "COMISSÃO TOTAL",
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    fontSize: "52px",
                    fontWeight: 700,
                    color: "#ffffff",
                    letterSpacing: "-1px",
                    lineHeight: 1.05,
                  },
                  children: `R$ ${comFmt}`,
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    fontSize: "14px",
                    fontWeight: 400,
                    color: "rgba(255,255,255,0.78)",
                    lineHeight: 1.35,
                  },
                  children: subtitle,
                },
              },
            ],
          },
        },
      ],
    },
  };
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
  return `${Number(com).toFixed(2)}|${Number(lucro).toFixed(2)}|${pedidos}|${date || ""}|og`;
}

async function renderCommissionBannerPng(params = {}) {
  const key = bannerCacheKey(params);
  const hit = _cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.buf;

  const ImageResponse = await getImageResponse();
  const response = new ImageResponse(buildBannerElement(params), {
    width: 900,
    height: 210,
    fonts: getOgFonts(),
  });

  const buf = Buffer.from(await response.arrayBuffer());
  _cache.set(key, { buf, at: Date.now() });
  return buf;
}

function renderCoinPng(size) {
  const svg = buildCoinSvg(size);
  return new Resvg(svg, {
    fitTo: { mode: "width", value: size },
    font: { loadSystemFonts: false },
  }).render().asPng();
}

module.exports = {
  renderCommissionBannerPng,
  renderCoinPng,
  bannerCacheKey,
  fmtMoney,
};
