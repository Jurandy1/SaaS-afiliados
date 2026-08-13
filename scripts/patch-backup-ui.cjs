"use strict";
const fs = require("fs");
const path = require("path");
const p = path.join(__dirname, "..", "public", "app.js");
let s = fs.readFileSync(p, "utf8");
const start = s.indexOf("  /* ——— Backup de produtos ——— */");
const end = s.indexOf("  async function loadDataView(view)");
if (start < 0 || end < 0) {
  console.error("markers not found", start, end);
  process.exit(1);
}
const insert = `  async function renderBackupPage() {
    if (window.BackupUI) await window.BackupUI.mount();
  }

`;
s = s.slice(0, start) + insert + s.slice(end);
s = s.replace(
  "Monitore comissão e preço dos produtos que você promove.",
  "Cadastre produtos Shopee como reserva — monitora preço, comissão e período."
);
fs.writeFileSync(p, s);
console.log("OK patched app.js");
