"use strict";

const fs = require("fs");
const path = require("path");

const fontsDir = path.join(__dirname, "..", "server", "fonts");
const iconPath = path.join(__dirname, "..", "public", "assets", "push", "shopee-icon.png");
const outFile = path.join(__dirname, "..", "server", "pushFontsEmbedded.js");

const files = ["Inter-ExtraBold.woff", "Inter-Medium.woff"];
const entries = files.map((name) => {
  const buf = fs.readFileSync(path.join(fontsDir, name));
  return `  ${JSON.stringify(name)}: ${JSON.stringify(buf.toString("base64"))},`;
});

const iconB64 = fs.readFileSync(iconPath).toString("base64");

const src = `"use strict";

// Gerado por scripts/embed-push-fonts.cjs — não editar manualmente
module.exports = {
${entries.join("\n")}
  "shopee-icon.png": ${JSON.stringify(iconB64)},
};
`;

fs.writeFileSync(outFile, src);
console.log("wrote", outFile, fs.statSync(outFile).size, "bytes");
