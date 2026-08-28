import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const pub = path.join(root, "public");

const cssBlock = [
  ["tailwind.css", "css-tailwind"],
  ["gemini-app.css", "css-gemini-app"],
  ["backup.css", "css-backup"],
]
  .map(([file, id]) => {
    const css = fs.readFileSync(path.join(pub, file), "utf8");
    return `<style id="${id}">\n/* === ${file} (completo) === */\n${css}\n</style>`;
  })
  .join("\n");

const idxExtras = `<style id="css-design-index">
/* Overrides só para este index visual */
#idx-banner{background:linear-gradient(105deg,#0f172a,#1e293b 60%,#334155);color:#fff;padding:1.25rem 1.5rem;border-bottom:1px solid rgba(255,255,255,.08)}
#idx-banner h1{margin:0;font-size:1.15rem;font-weight:800;display:flex;align-items:center;gap:.5rem}
#idx-banner h1 i{color:#ee4d2d}
#idx-banner p{margin:.35rem 0 0;font-size:.8rem;color:#94a3b8;max-width:72ch;line-height:1.5}
#idx-banner .tags{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.65rem}
#idx-banner .tags span{font-size:.68rem;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);padding:.2rem .5rem;border-radius:.4rem}
#idx-fab{position:fixed;bottom:1.25rem;right:1.25rem;z-index:9999;background:#ee4d2d;color:#fff;border:0;border-radius:999px;padding:.8rem 1.1rem;font-weight:800;font-size:.78rem;cursor:pointer;box-shadow:0 12px 30px rgba(238,77,45,.35);display:inline-flex;align-items:center;gap:.45rem;font-family:inherit}
#idx-fab:hover{background:#d83f21}
#idx-panel{position:fixed;top:0;right:0;bottom:0;width:min(420px,100vw);background:#0f172a;color:#e2e8f0;z-index:10000;transform:translateX(100%);transition:transform .25s ease;display:flex;flex-direction:column;box-shadow:-12px 0 40px rgba(0,0,0,.35)}
#idx-panel.is-open{transform:translateX(0)}
#idx-panel-head{display:flex;align-items:center;justify-content:space-between;padding:1rem 1.1rem;border-bottom:1px solid rgba(255,255,255,.08)}
#idx-panel-head h3{margin:0;font-size:.88rem;font-weight:800;color:#fff}
#idx-panel-close{background:transparent;border:0;color:#94a3b8;font-size:1.1rem;cursor:pointer}
#idx-panel-body{padding:.85rem 1rem;overflow-y:auto;flex:1}
.idx-sec{margin-bottom:1rem}
.idx-sec h4{margin:0 0 .4rem;font-size:.62rem;text-transform:uppercase;letter-spacing:.08em;color:#ee4d2d;font-weight:800}
.idx-btn{display:block;width:100%;text-align:left;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:.55rem;padding:.5rem .65rem;margin-bottom:.3rem;color:#e2e8f0;font-size:.74rem;cursor:pointer;font-family:inherit}
.idx-btn:hover{background:rgba(238,77,45,.12);border-color:rgba(238,77,45,.4)}
.idx-btn.is-active{background:rgba(238,77,45,.22);border-color:#ee4d2d}
.idx-btn small{display:block;color:#94a3b8;font-size:.62rem;margin-top:.1rem}
.mock-row td{font-size:.78rem}
.mock-row td.num{text-align:right;font-variant-numeric:tabular-nums}
</style>`;

let html = fs.readFileSync(path.join(pub, "design-index.src.html"), "utf8");
html = html.replace("<!-- EMBED_CSS -->", cssBlock + "\n" + idxExtras);
fs.writeFileSync(path.join(pub, "design-index.html"), html, "utf8");
console.log("design-index.html gerado:", Math.round(fs.statSync(path.join(pub, "design-index.html")).size / 1024), "KB");
