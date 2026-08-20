"use strict";

const fs = require("fs");
const path = require("path");
const { renderCoinPng } = require("../server/pushBanner");

const outDir = path.join(__dirname, "..", "public", "assets", "push");
fs.mkdirSync(outDir, { recursive: true });

for (const size of [72, 118, 192, 512]) {
  const buf = renderCoinPng(size);
  const file = path.join(outDir, `shopee-coin-${size}.png`);
  fs.writeFileSync(file, buf);
  console.log("wrote", file, buf.length, "bytes");
}
