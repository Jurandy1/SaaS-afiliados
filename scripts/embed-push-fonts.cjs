"use strict";

const fs = require("fs");
const path = require("path");

const fontsDir = path.join(__dirname, "..", "server", "fonts");
const iconPath = path.join(__dirname, "..", "public", "assets", "push", "shopee-icon.png");
const geistSrc = path.join(__dirname, "..", "node_modules", "@vercel", "og", "dist", "Geist-Regular.ttf");
const outFile = path.join(__dirname, "..", "server", "pushFontsEmbedded.js");

const geistPath = fs.existsSync(path.join(fontsDir, "Geist-Regular.ttf"))
  ? path.join(fontsDir, "Geist-Regular.ttf")
  : geistSrc;

const bagPath = path.join(__dirname, "..", "public", "assets", "push", "shopee-bag-150.png");

const geistB64 = fs.readFileSync(geistPath).toString("base64");
const iconB64 = fs.readFileSync(iconPath).toString("base64");
const bagB64 = fs.existsSync(bagPath) ? fs.readFileSync(bagPath).toString("base64") : "";

const src = `"use strict";

// Gerado por scripts/embed-push-fonts.cjs
module.exports = {
  "Geist-Regular.ttf": ${JSON.stringify(geistB64)},
  "shopee-icon.png": ${JSON.stringify(iconB64)},
  "shopee-bag-150.png": ${JSON.stringify(bagB64)},
};
`;

fs.writeFileSync(outFile, src);
console.log("wrote", outFile, fs.statSync(outFile).size, "bytes");
