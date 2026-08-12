/**
 * Gera DESIGN-INDEX-PARA-IA.html — páginas COMPLETAS com números fake.
 * Uso: node scripts/build-design-index.cjs
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const assetsDir = path.join(root, "public", "assets");
const outPath = path.join(root, "DESIGN-INDEX-PARA-IA.html");

function b64(file) {
  const buf = fs.readFileSync(path.join(assetsDir, file));
  const ext = path.extname(file).slice(1).toLowerCase();
  const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

const A = {
  dashboard: b64("dashboard.png"),
  meta: b64("meta.png"),
  pinterest: b64("pinterest.png"),
  shopee: b64("shopee.png"),
  produtos: b64("produtos.png"),
  tag: b64("tag.png"),
  config: b64("configuracao.png"),
  lucro: b64("lucro.png"),
};

function sidebar(active) {
  const item = (key, icon, label, badge) => {
    const on = active === key ? " active" : "";
    const b = badge != null ? `<span class="nav-badge">${badge}</span>` : "";
    return `<div class="nav-item${on}"><img src="${icon}" alt="" /><span>${label}</span>${b}</div>`;
  };
  return `
<aside class="sidebar">
  <div>
    <div class="brand-name">Afiliados</div>
    <div class="brand-sub">painel · v.1</div>
  </div>
  <div class="account-pill">
    <div class="account-avatar">AF</div>
    <div>
      <div class="account-title">afiliado@teste.com</div>
      <div class="account-sub"><i class="dot"></i>Shopee · Meta conectados</div>
    </div>
  </div>
  <div class="nav-sec-title">Operação</div>
  ${item("dashboard", A.dashboard, "Dashboard", "100")}
  ${item("meta", A.meta, "Campanhas Meta", "72")}
  ${item("pin", A.pinterest, "Campanhas Pinterest", "6")}
  ${item("org", A.shopee, "Campanhas orgânicas", "22")}
  ${item("produtos", A.produtos, "Produtos", "312")}
  <div class="nav-sec-title">Sistema</div>
  ${item("canais", A.tag, "Canais e status")}
  ${item("config", A.config, "Configurações")}
  <div class="sidebar-foot">
    <div class="api-box">
      <div class="api-top"><b>APIs</b><span class="mono">20:12</span></div>
      <div class="api-line"><i class="dot ok"></i>Shopee <span class="mono">ok</span></div>
      <div class="api-line"><i class="dot ok"></i>Meta Ads <span class="mono">ok</span></div>
      <div class="api-line"><i class="dot warn"></i>Pinterest CSV <span class="mono">manual</span></div>
    </div>
  </div>
</aside>`;
}

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>SYSTEM INDEX · Páginas completas com dados fake · v.1</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
<style>
:root {
  --bg:#f7f6f2; --ink:#111418; --ink-2:#2a2f37; --muted:#6b7280; --faint:#9aa1ab;
  --line:#ecebe4; --line-2:#e2e1d8; --hair:#f1efe8; --accent:#ea5a2b;
  --meta:#1877F2; --pin:#E60023; --green:#0f8a5f; --danger:#b91c1c;
  --amber:#a97a1a; --amber-soft:#fbf5e0;
  --display:"Fraunces",Georgia,serif; --sans:"Inter",system-ui,sans-serif;
  --mono:"JetBrains Mono",ui-monospace,monospace; --sidebar-w:246px;
}
*{box-sizing:border-box} html,body{margin:0}
body{font-family:var(--sans);font-size:14px;line-height:1.5;color:#cbd5e1;background:#0b1220}
.doc{max-width:1320px;margin:0 auto;padding:28px 18px 100px}
.doc>h1,.doc>h2{font-family:var(--display);font-weight:600;letter-spacing:-.01em;color:#fff}
.doc>h1{font-size:28px;margin:0 0 8px}
.doc>h2{font-size:20px;margin:40px 0 12px;padding-bottom:8px;border-bottom:1px solid #1e293b}
.lead{color:#94a3b8;max-width:80ch;margin:0 0 16px}
.badge{display:inline-flex;padding:4px 10px;border-radius:99px;font-size:11px;font-weight:700;background:#1e293b;color:#fbbf24;letter-spacing:.04em;text-transform:uppercase;margin-bottom:12px}
.toc a{display:inline-block;margin:0 8px 8px 0;padding:6px 10px;border-radius:8px;background:#1e293b;text-decoration:none;font-size:12px;color:#e2e8f0}
.card{background:#111827;border:1px solid #1f2937;border-radius:14px;padding:16px 18px;margin-bottom:14px}
.card strong{color:#f8fafc}.card ul{margin:8px 0 0;padding-left:18px}.card li{margin:4px 0;color:#cbd5e1}
.warn{border-color:#92400e;background:#1c1408}.warn strong{color:#fbbf24}
.ok{border-color:#065f46;background:#071510}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:900px){.grid-2{grid-template-columns:1fr}}
.mock-wrap{margin:14px 0 28px;border:1px solid #334155;border-radius:16px;overflow:hidden;box-shadow:0 30px 80px -40px rgba(0,0,0,.85)}
.mock-label{background:#1e293b;color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:10px 14px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}
.app{display:grid;grid-template-columns:var(--sidebar-w) minmax(0,1fr);background:var(--bg);background-image:radial-gradient(ellipse 60% 34% at 6% -4%,rgba(234,90,43,.045),transparent 60%),radial-gradient(ellipse 50% 30% at 100% 0%,rgba(24,119,242,.03),transparent 60%);color:var(--ink);font-family:var(--sans);min-height:640px}
.sidebar{background:#fbfaf6;border-right:1px solid var(--line-2);padding:18px 12px 14px;display:flex;flex-direction:column}
.brand-name{font-family:var(--display);font-size:16px;font-weight:600}
.brand-sub{font-size:10.5px;color:var(--faint);font-family:var(--mono);margin-top:3px}
.account-pill{display:flex;gap:10px;align-items:center;margin:14px 4px;padding:9px 10px;background:#fff;border:1px solid var(--line);border-radius:11px}
.account-avatar{width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,#2a2f37,#111418);color:#fff;display:grid;place-items:center;font-size:10.5px;font-weight:700}
.account-title{font-size:12.5px;font-weight:600}.account-sub{font-size:10.5px;color:var(--muted);display:flex;align-items:center;gap:5px}
.dot{width:6px;height:6px;border-radius:99px;background:#22c55e;display:inline-block}.dot.warn{background:#fbbf24}.dot.ok{background:#22c55e}
.nav-sec-title{font-size:9.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--faint);margin:10px 8px 6px}
.nav-item{display:flex;align-items:center;gap:9px;padding:9px 10px;border-radius:9px;font-size:13px;font-weight:500;color:var(--ink-2);position:relative}
.nav-item.active{background:#f1efe8;font-weight:600;color:var(--ink)}
.nav-item.active::before{content:"";position:absolute;left:-12px;top:8px;bottom:8px;width:2px;background:var(--ink);border-radius:2px}
.nav-item img{width:16px;height:16px;object-fit:contain}
.nav-badge{margin-left:auto;font-family:var(--mono);font-size:10.5px;color:var(--faint)}
.sidebar-foot{margin-top:auto;padding-top:12px;border-top:1px solid var(--line)}
.api-box{font-size:11px;color:var(--muted);padding:10px;background:#fff;border:1px solid var(--line);border-radius:10px}
.api-top{display:flex;justify-content:space-between;margin-bottom:6px;color:var(--ink);font-weight:600}
.api-line{display:flex;align-items:center;gap:6px;margin:3px 0}
.api-line .mono{margin-left:auto;font-family:var(--mono);font-size:10px;color:var(--faint)}
.main{min-width:0;display:flex;flex-direction:column}
.topbar{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 24px;border-bottom:1px solid var(--line);background:rgba(255,255,255,.72)}
.crumbs{font-size:12.5px;color:var(--muted)}.crumbs strong{color:var(--ink)}
.content{padding:22px 24px 36px;display:flex;flex-direction:column;gap:16px}
.eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);font-weight:700}
.eyebrow i{width:6px;height:6px;border-radius:99px;background:#22c55e}
.page-head{display:flex;justify-content:space-between;align-items:flex-end;gap:14px;flex-wrap:wrap}
.page-head h1{font-family:var(--display);font-size:34px;font-weight:500;letter-spacing:-.025em;margin:6px 0 0;line-height:1.05;color:var(--ink)}
.page-sub{margin:4px 0 0;color:var(--muted);font-size:13px;max-width:58ch}
.actions{display:flex;gap:8px;flex-wrap:wrap}
.btn{display:inline-flex;align-items:center;gap:7px;padding:8px 12px;border-radius:9px;font-size:12.5px;font-weight:600;border:1px solid var(--line-2);background:#fff;color:var(--ink)}
.btn img{width:14px;height:14px;object-fit:contain}
.btn-meta{background:#eff6ff;border-color:#cfe0fb;color:#1d4ed8}
.btn-shopee{background:var(--accent);border:0;color:#fff}
.btn.primary{background:var(--accent);border:0;color:#fff}
.btn.ghost{background:#fff}
.period-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:#fff;border:1px solid var(--line-2);border-radius:12px;padding:6px 8px 6px 6px}
.period-main{display:inline-flex;align-items:center;gap:10px;padding:8px 14px;background:var(--ink);color:#fff;border-radius:9px;font-size:12.5px;font-weight:600;font-family:var(--mono)}
.presets{margin-left:auto;display:flex;background:#f6f4ec;border:1px solid var(--line);border-radius:9px;padding:3px}
.preset{padding:6px 12px;border-radius:7px;font-size:12px;font-weight:600;color:var(--muted)}.preset.on{background:#fff;color:var(--ink);box-shadow:0 1px 2px rgba(15,23,42,.06)}
.channel-tabs{display:flex;flex-wrap:wrap;gap:8px;padding-bottom:2px;border-bottom:1px solid var(--line)}
.ch{display:inline-flex;align-items:center;gap:7px;padding:7px 14px;border-radius:999px;font-size:12px;font-weight:600;border:1px solid var(--line-2);background:#fff;color:#475569}
.ch img{width:14px;height:14px;object-fit:contain}
.ch.on{background:var(--ink);color:#fff;border-color:transparent}
.ch.meta{background:#eff6ff;color:#1d4ed8;border-color:#cfe0fb}
.ch.pin{background:#fef2f4;color:#c8385f;border-color:#fecdd3}
.ch.org{background:#f0fdf4;color:#047857;border-color:#bbf7d0}
.zone{font-size:10.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--faint);display:flex;align-items:center;gap:10px}
.zone::before{content:"";width:20px;height:1px;background:var(--line-2)}
.kpi-grid{display:grid;grid-template-columns:1.08fr .95fr .95fr .95fr;gap:14px}
.kpi-hero{color:#fff;border-radius:20px;padding:22px;background:linear-gradient(155deg,#0b3d2c 0%,#0f8a5f 65%,#34c48c 100%)}
.kpi-hero .lab{font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;font-weight:700;display:flex;gap:8px;align-items:center;opacity:.92}
.kpi-hero .lab img{width:18px;height:18px}
.kpi-hero .val{font-family:var(--mono);font-size:34px;font-weight:500;margin:12px 0 6px;letter-spacing:-.02em}
.kpi-hero .note{font-size:12px;opacity:.9}
.kpi-hero .foot{display:flex;gap:18px;margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,.18);flex-wrap:wrap}
.kpi-hero .mini span{display:block;font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;opacity:.72;font-weight:700}
.kpi-hero .mini b{font-family:var(--mono);font-size:14px}
.kpi-ch{border-radius:20px;padding:18px;color:#fff;min-height:150px;display:flex;flex-direction:column}
.kpi-ch.is-shopee{background:linear-gradient(155deg,#c73a1f,#ea5a2b 60%,#ff8f6b)}
.kpi-ch.is-meta{background:linear-gradient(155deg,#0b3d95,#1877F2 60%,#5aa3ff)}
.kpi-ch.is-pin{background:linear-gradient(155deg,#8a0015,#e60023 60%,#ff5a72)}
.kpi-ch .top{display:flex;justify-content:space-between;align-items:center}
.kpi-ch .top img{width:22px;height:22px;object-fit:contain}
.kpi-ch .pill{font-size:10px;font-family:var(--mono);font-weight:600;background:rgba(255,255,255,.18);padding:3px 8px;border-radius:99px}
.kpi-ch .lab{font-size:11px;font-weight:600;opacity:.92;margin-top:12px}
.kpi-ch .val{font-family:var(--mono);font-size:24px;font-weight:600;margin-top:auto;letter-spacing:-.01em}
.kpi-ch .foot{font-size:11.5px;opacity:.92;margin-top:6px;padding-top:8px;border-top:1px solid rgba(255,255,255,.18)}
.kpi-help{display:flex;gap:12px;align-items:flex-start;padding:12px 14px;background:var(--amber-soft);border:1px solid #f0e0b6;border-radius:12px;font-size:12.5px;color:var(--amber)}
.kpi-help .i{width:22px;height:22px;border-radius:99px;background:#f59e0b;color:#fff;display:grid;place-items:center;font-weight:800;flex-shrink:0;font-family:var(--display)}
.ops{display:grid;grid-template-columns:1.15fr .85fr;gap:14px}
.sec{background:#fff;border:1px solid var(--line-2);border-radius:14px;overflow:hidden}
.sec.meta{border-left:3px solid var(--meta)}
.sec-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;padding:14px 16px;border-bottom:1px solid var(--line)}
.sec.meta .sec-head{background:linear-gradient(90deg,#f4f8ff,transparent 60%)}
.sec-title{font-family:var(--display);font-size:17px;font-weight:600;margin:0;letter-spacing:-.01em}
.sec-sub{font-size:11.5px;color:var(--muted);margin-top:1px}
.sug-count{font-size:11.5px;color:#1d4ed8;font-weight:600;background:#eff6ff;padding:5px 10px;border-radius:99px;border:1px solid #cfe0fb}
.sug-row{display:grid;grid-template-columns:150px 90px 1fr 120px;gap:10px;align-items:center;padding:12px 16px;border-bottom:1px solid var(--hair);font-size:12.5px}
.sug-row:last-child{border-bottom:0}
.sug-id{font-family:var(--mono);color:#1d4ed8;font-weight:600;display:flex;align-items:center;gap:7px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sug-id img{width:14px;height:14px}
.tag{display:inline-flex;padding:3px 8px;border-radius:6px;font-size:10.5px;font-weight:700}
.tag.pausar{background:#fef2f2;color:var(--danger)}.tag.escalar{background:#ecfdf5;color:#047857}.tag.testar{background:#fefce8;color:#a16207}
.act{justify-self:end;padding:7px 12px;border-radius:8px;font-size:12px;font-weight:700;color:#fff;border:0}
.act.pausar{background:var(--danger)}.act.escalar{background:var(--green)}.act.testar{background:#a16207}
.bars{display:flex;align-items:flex-end;gap:6px;height:120px;padding:14px 16px 8px}
.bar{flex:1;border-radius:5px 5px 0 0;background:linear-gradient(180deg,#34c48c,var(--green));min-width:0}
.bar.neg{background:linear-gradient(180deg,#f87171,var(--danger))}
.chart-meta{display:flex;justify-content:space-between;padding:10px 16px 14px;border-top:1px solid var(--hair);font-size:12px}
.chart-meta .mono{font-family:var(--mono);font-weight:600;color:var(--ink)}
.chart-meta .green{color:var(--green)}
table.data{width:100%;border-collapse:collapse;font-size:12.5px;min-width:720px}
table.data th{text-align:left;padding:10px 12px;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--faint);font-weight:700;border-bottom:1px solid var(--line);background:#fbfaf6;white-space:nowrap}
table.data th.num,table.data td.num{text-align:right;font-family:var(--mono)}
table.data td{padding:10px 12px;border-bottom:1px solid var(--hair);white-space:nowrap}
table.data tr:nth-child(even) td{background:#fdfcf7}
table.data tfoot td{background:var(--ink);color:#fff;font-family:var(--mono);font-weight:600;border:0;padding:12px}
table.data .pos{color:var(--green);font-weight:600}
table.data .neg{color:var(--danger);font-weight:600}
table.data tfoot .pos{color:#34c48c}
.chip{display:inline-flex;align-items:center;gap:6px;padding:3px 9px;border-radius:7px;font-size:11px;font-weight:700;border:1px solid #e2e8f0}
.chip img{width:12px;height:12px}
.chip.meta{background:#eff6ff;color:#1d4ed8;border-color:#cfe0fb}
.chip.org{background:#f0fdf4;color:#047857;border-color:#bbf7d0}
.chip.pin{background:#fef2f4;color:#c8385f;border-color:#fecdd3}
.status{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:99px;font-size:11px;font-weight:700;background:#ecfdf5;color:#047857}
.status i{width:6px;height:6px;border-radius:99px;background:#10b981}
.status.pause{background:#fef2f2;color:var(--danger)}.status.pause i{background:#ef4444}
.status.teste{background:#fefce8;color:#a16207}.status.teste i{background:#eab308}
.table-wrap{overflow:auto}
.pager{display:flex;justify-content:space-between;align-items:center;padding:10px 16px;border-top:1px solid var(--line);background:#fbfaf6;font-size:11.5px;color:var(--muted)}
.count-pill{font-size:11.5px;color:var(--muted);font-weight:600;background:#f6f4ec;padding:4px 10px;border-radius:99px;margin-left:8px}
.chan-counts{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.chan-count{display:inline-flex;align-items:center;gap:7px;padding:6px 12px;border-radius:99px;border:1px solid var(--line-2);background:#fff;font-size:12px;font-weight:600;color:var(--muted)}
.chan-count b{font-family:var(--mono);color:var(--ink)}
.chan-count img{width:14px;height:14px;object-fit:contain}
.cfg-section-title{font-family:var(--display);font-size:18px;font-weight:600;margin:0;color:var(--ink)}
.cfg-section-sub{margin:2px 0 10px;font-size:12.5px;color:var(--muted)}
.cfg-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.cfg-card{background:#fff;border:1px solid var(--line-2);border-radius:14px;overflow:hidden}
.cfg-card header{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,#fbfaf6,#fff)}
.cfg-card header img{width:20px;height:20px;object-fit:contain}
.cfg-card .body{padding:14px 16px;display:grid;gap:10px}
.field{display:grid;gap:4px}
.field label{font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.field .fake{border:1px solid var(--line-2);border-radius:9px;padding:9px 11px;background:#fbfaf6;font-family:var(--mono);font-size:12.5px;color:var(--ink)}
.field-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.state{font-size:11px;font-weight:600;background:#ecfdf5;color:var(--green);padding:4px 10px;border-radius:99px}
.state.manual{background:#f6f4ec;color:var(--muted)}
.hint{font-size:11.5px;color:var(--muted);margin:0;padding:8px 10px;background:#fbfaf6;border:1px solid var(--line);border-radius:9px}
.auth-shell{min-height:560px;display:grid;place-items:center;padding:40px;background:var(--bg);background-image:radial-gradient(ellipse 60% 34% at 6% -4%,rgba(234,90,43,.045),transparent 60%)}
.auth-card{width:min(420px,100%);background:#fff;border:1px solid var(--line-2);border-radius:16px;padding:28px;box-shadow:0 16px 40px -28px rgba(17,20,24,.25)}
.auth-tabs{display:flex;gap:4px;background:#f6f4ec;padding:3px;border-radius:10px;margin:18px 0}
.auth-tabs span{flex:1;text-align:center;padding:8px;border-radius:8px;font-size:13px;font-weight:600;color:var(--muted)}
.auth-tabs span.on{background:#fff;color:var(--ink);box-shadow:0 1px 2px rgba(15,23,42,.06)}
.admin-app{display:grid;grid-template-columns:220px 1fr;min-height:520px;background:#0f1116;color:#e8eaef}
.admin-rail{background:#14171e;border-right:1px solid #232833;padding:18px 14px}
.admin-rail .t{font-family:var(--display);font-size:16px;font-weight:600;color:#fff}
.admin-rail .s{font-family:var(--mono);font-size:10.5px;color:#8b93a7;margin-top:3px}
.admin-item{padding:9px 10px;border-radius:8px;font-size:13px;color:#aab2c0;margin-top:4px}
.admin-item.on{background:#1c212b;color:#fff}
.admin-main{padding:22px}
.admin-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:14px}
.admin-stat{background:#14171e;border:1px solid #232833;border-radius:12px;padding:16px}
.admin-stat b{display:block;font-family:var(--mono);font-size:28px;color:#fff;margin-top:6px}
.admin-stat span{font-size:11px;color:#8b93a7;text-transform:uppercase;letter-spacing:.08em;font-weight:700}
@media(max-width:1100px){
  .kpi-grid{grid-template-columns:1fr 1fr}.ops{grid-template-columns:1fr}.cfg-grid{grid-template-columns:1fr}.app{grid-template-columns:210px 1fr}
}
@media(max-width:780px){
  .kpi-grid{grid-template-columns:1fr}.app{grid-template-columns:1fr}.sidebar{display:none}
  .sug-row{grid-template-columns:1fr auto}.admin-stats{grid-template-columns:1fr}
}
.anno{margin:-12px 0 28px;padding:10px 12px;border-left:3px solid #38bdf8;background:#0c1a2e;color:#bae6fd;font-size:12.5px;border-radius:0 8px 8px 0}
.mono{font-family:var(--mono)}
</style>
</head>
<body>
<div class="doc">
  <div class="badge">System Index · páginas completas · dados fake</div>
  <h1>Painel de Afiliados v.1 — páginas alimentadas</h1>
  <p class="lead">Arquivo único com <b style="color:#fff">todas as páginas principais preenchidas com números fictícios</b> para a IA entender estrutura, densidade e hierarquia. Não invente seções novas. Idioma: pt-BR.</p>
  <div class="toc">
    <a href="#brief">Brief</a>
    <a href="#p-dash">Dashboard</a>
    <a href="#p-meta">Campanhas Meta</a>
    <a href="#p-canais">Canais</a>
    <a href="#p-config">Configurações</a>
    <a href="#p-produtos">Produtos</a>
    <a href="#p-auth">Auth</a>
    <a href="#p-admin">Admin</a>
    <a href="#regras">Regras</a>
  </div>

  <div class="grid-2" id="brief">
    <div class="card ok"><strong>Use isto para</strong><ul>
      <li>Ver densidade real de cada página com dados.</li>
      <li>Melhorar estrutura/organização sem perder o ritmo da home.</li>
      <li>Manter ícones, KPIs, tabelas e fluxos existentes.</li>
    </ul></div>
    <div class="card warn"><strong>Não faça</strong><ul>
      <li>Não remova os 4 KPIs nem invente projeção de metas.</li>
      <li>Não repita Comissão/Invest/ROI no header (só nos cards).</li>
      <li>Sugestões Meta = máx. 4. Labels humanas em Config.</li>
    </ul></div>
  </div>

  <!-- ===================== DASHBOARD ===================== -->
  <h2 id="p-dash">1. Dashboard (completo · dados fake)</h2>
  <div class="mock-wrap">
    <div class="mock-label"><span>view-dashboard · Geral · 05–11 ago 2026</span><span>100 SubIDs · sync 11/08 20:12</span></div>
    <div class="app">
      ${sidebar("dashboard")}
      <div class="main">
        <header class="topbar">
          <div class="crumbs">Painel / <strong>Dashboard</strong></div>
          <div class="mono" style="font-size:11.5px;color:var(--muted)">05/08 – 11/08 · 2026</div>
        </header>
        <div class="content">
          <div class="page-head">
            <div>
              <div class="eyebrow"><i></i> Ao vivo · 100 SubIDs no período</div>
              <h1>Dashboard</h1>
              <p class="page-sub">Lucro, sugestões Meta e operação por SubID.</p>
            </div>
            <div class="actions">
              <span class="btn">↓ Exportar CSV</span>
              <span class="btn btn-meta"><img src="${A.meta}" alt="" /> Sincronizar Meta</span>
              <span class="btn btn-shopee"><img src="${A.shopee}" alt="" /> Puxar Shopee</span>
            </div>
          </div>
          <div class="period-bar">
            <div class="period-main">05 ago – 11 ago 2026 ▾</div>
            <span style="font-size:11.5px;color:var(--muted)">7 dias</span>
            <div class="presets"><span class="preset on">7 dias</span><span class="preset">Este mês</span><span class="preset">MTD</span><span class="preset">30 dias</span></div>
          </div>
          <div class="channel-tabs">
            <span class="ch on">Geral <span class="mono" style="opacity:.55">100</span></span>
            <span class="ch meta"><img src="${A.meta}" alt="" />Meta Ads <span class="mono" style="opacity:.7">72</span></span>
            <span class="ch pin"><img src="${A.pinterest}" alt="" />Pinterest <span class="mono" style="opacity:.7">6</span></span>
            <span class="ch org"><img src="${A.shopee}" alt="" />Shopee orgânico <span class="mono" style="opacity:.7">22</span></span>
            <span class="ch">Por SubID</span>
          </div>

          <div class="zone">Zona 1 · Executivo</div>
          <div class="kpi-grid">
            <article class="kpi-hero">
              <div class="lab"><img src="${A.lucro}" alt="" /> Lucro líquido</div>
              <div class="val">R$ 6.337<span style="opacity:.7;font-size:.64em">,64</span></div>
              <div class="note">= comissão − mídia − impostos</div>
              <div class="foot">
                <div class="mini"><span>ROI</span><b>154,66%</b></div>
                <div class="mini"><span>Abatimento</span><b>6,22%</b></div>
                <div class="mini"><span>SubIDs ativos</span><b>100</b></div>
              </div>
            </article>
            <article class="kpi-ch is-shopee">
              <div class="top"><img src="${A.shopee}" alt="" /><span class="pill">Shopee API</span></div>
              <div class="lab">Faturamento bruto</div>
              <div class="val">R$ 167.639<span style="opacity:.7;font-size:.7em">,84</span></div>
              <div class="foot">Comissão <b class="mono">R$ 10.028,32</b></div>
            </article>
            <article class="kpi-ch is-meta">
              <div class="top"><img src="${A.meta}" alt="" /><span class="pill">Meta Ads</span></div>
              <div class="lab">Invest em anúncios</div>
              <div class="val">R$ 3.653<span style="opacity:.7;font-size:.7em">,27</span></div>
              <div class="foot">taxado no ROI</div>
            </article>
            <article class="kpi-ch is-pin">
              <div class="top"><img src="${A.pinterest}" alt="" /><span class="pill">CSV manual</span></div>
              <div class="lab">Invest em anúncios</div>
              <div class="val">R$ 428<span style="opacity:.7;font-size:.7em">,90</span></div>
              <div class="foot">importado no período</div>
            </article>
          </div>
          <div class="kpi-help"><span class="i">i</span><span><b style="color:#7a5813">Como ler:</b> Shopee = o que você <b>ganhou</b>. Meta e Pinterest = o que você <b>gastou</b>. Lucro (verde) = comissão − mídia − impostos.</span></div>

          <div class="zone">Zona 2 · Operação</div>
          <div class="ops">
            <section class="sec meta">
              <header class="sec-head">
                <div style="display:flex;gap:10px;align-items:center">
                  <img src="${A.meta}" alt="" width="22" height="22" />
                  <div>
                    <h2 class="sec-title">Sugestões Meta</h2>
                    <div class="sec-sub">ROI 15d · &lt;40% pausa · +20% escala · máx. 4</div>
                  </div>
                </div>
                <span class="sug-count">4 ações</span>
              </header>
              <div class="sug-row">
                <div class="sug-id"><img src="${A.meta}" alt="" />summer_kids04</div>
                <span class="tag pausar">PAUSAR</span>
                <div>ROI 15d <b class="mono" style="color:var(--danger)">12,4%</b> · invest <span class="mono">R$ 842,00</span> · 3 vendas</div>
                <button class="act pausar" type="button">Pausar</button>
              </div>
              <div class="sug-row">
                <div class="sug-id"><img src="${A.meta}" alt="" />banho_verao_08</div>
                <span class="tag pausar">PAUSAR</span>
                <div>ROI 15d <b class="mono" style="color:var(--danger)">−8,1%</b> · invest <span class="mono">R$ 510,20</span> · 1 venda</div>
                <button class="act pausar" type="button">Pausar</button>
              </div>
              <div class="sug-row">
                <div class="sug-id"><img src="${A.meta}" alt="" />cozinha_pro12</div>
                <span class="tag escalar">ESCALAR</span>
                <div>ROI 15d <b class="mono" style="color:var(--green)">86,0%</b> · consistente 4d · +20%</div>
                <button class="act escalar" type="button">Escalar +20%</button>
              </div>
              <div class="sug-row">
                <div class="sug-id"><img src="${A.meta}" alt="" />teste_util02</div>
                <span class="tag testar">TESTAR</span>
                <div>Teste ROI <b class="mono" style="color:var(--danger)">−74%</b> · reduzir −70%</div>
                <button class="act testar" type="button">Reduzir −70%</button>
              </div>
            </section>
            <section class="sec">
              <header class="sec-head">
                <div>
                  <h2 class="sec-title">Lucro por dia</h2>
                  <div class="sec-sub">05 – 11 ago 2026</div>
                </div>
                <div style="font-size:11px;color:var(--muted)"><span style="color:var(--green)">■</span> Lucro · <span style="color:var(--danger)">■</span> Prejuízo</div>
              </header>
              <div class="bars">
                <div class="bar" style="height:55%"></div>
                <div class="bar" style="height:72%"></div>
                <div class="bar" style="height:40%"></div>
                <div class="bar neg" style="height:28%"></div>
                <div class="bar" style="height:88%"></div>
                <div class="bar" style="height:64%"></div>
                <div class="bar" style="height:95%"></div>
              </div>
              <div class="chart-meta">
                <div><div style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);font-weight:700">Média/dia</div><div class="mono">R$ 905,37</div></div>
                <div style="text-align:right"><div style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);font-weight:700">Melhor dia</div><div class="mono green">09/08 · R$ 1.240</div></div>
              </div>
            </section>
          </div>

          <div class="zone">Zona 3 · Detalhamento</div>
          <section class="sec">
            <header class="sec-head">
              <div>
                <h2 class="sec-title">Resumo diário</h2>
                <div class="sec-sub">Fat · Com · Inv · Lucro · ROI · Abat.</div>
              </div>
              <div class="mono" style="font-size:11px;color:var(--faint)">7 linhas · sync 11/08/2026 20:12</div>
            </header>
            <div class="table-wrap">
              <table class="data">
                <thead>
                  <tr>
                    <th>Dia</th><th class="num">Faturamento</th><th class="num">Comissão</th>
                    <th class="num">Inv. Meta</th><th class="num">Inv. Pin</th><th class="num">Inv. Total</th>
                    <th class="num">Lucro</th><th class="num">ROI</th><th class="num">Abat.</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td class="mono">11/08/2026</td><td class="num">R$ 24.120,00</td><td class="num">R$ 1.510,20</td>
                    <td class="num">R$ 520,00</td><td class="num">R$ 40,00</td><td class="num">R$ 560,00</td>
                    <td class="num pos">R$ 920,10</td><td class="num pos">164,30%</td><td class="num">5,8%</td>
                  </tr>
                  <tr>
                    <td class="mono">10/08/2026</td><td class="num">R$ 21.004,40</td><td class="num">R$ 1.402,10</td>
                    <td class="num">R$ 610,40</td><td class="num">R$ 55,20</td><td class="num">R$ 665,60</td>
                    <td class="num pos">R$ 710,00</td><td class="num pos">106,67%</td><td class="num">6,1%</td>
                  </tr>
                  <tr>
                    <td class="mono">09/08/2026</td><td class="num">R$ 28.870,00</td><td class="num">R$ 1.734,20</td>
                    <td class="num">R$ 494,10</td><td class="num">R$ 80,00</td><td class="num">R$ 574,10</td>
                    <td class="num pos">R$ 1.240,10</td><td class="num pos">216,01%</td><td class="num">5,4%</td>
                  </tr>
                  <tr>
                    <td class="mono">08/08/2026</td><td class="num">R$ 12.480,00</td><td class="num">R$ 780,00</td>
                    <td class="num">R$ 720,00</td><td class="num">R$ 90,00</td><td class="num">R$ 810,00</td>
                    <td class="num neg">−R$ 84,00</td><td class="num neg">−10,37%</td><td class="num">7,2%</td>
                  </tr>
                  <tr>
                    <td class="mono">07/08/2026</td><td class="num">R$ 19.220,00</td><td class="num">R$ 1.180,40</td>
                    <td class="num">R$ 410,00</td><td class="num">R$ 60,00</td><td class="num">R$ 470,00</td>
                    <td class="num pos">R$ 612,00</td><td class="num pos">130,21%</td><td class="num">6,0%</td>
                  </tr>
                  <tr>
                    <td class="mono">06/08/2026</td><td class="num">R$ 26.110,00</td><td class="num">R$ 1.680,00</td>
                    <td class="num">R$ 390,00</td><td class="num">R$ 53,70</td><td class="num">R$ 443,70</td>
                    <td class="num pos">R$ 1.040,00</td><td class="num pos">234,39%</td><td class="num">5,9%</td>
                  </tr>
                  <tr>
                    <td class="mono">05/08/2026</td><td class="num">R$ 35.835,44</td><td class="num">R$ 1.741,42</td>
                    <td class="num">R$ 508,77</td><td class="num">R$ 50,00</td><td class="num">R$ 558,77</td>
                    <td class="num pos">R$ 899,44</td><td class="num pos">160,97%</td><td class="num">6,4%</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total</td><td class="num">R$ 167.639,84</td><td class="num">R$ 10.028,32</td>
                    <td class="num">R$ 3.653,27</td><td class="num">R$ 428,90</td><td class="num">R$ 4.082,17</td>
                    <td class="num pos">R$ 6.337,64</td><td class="num pos">155,25%</td><td class="num">6,22%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <section class="sec">
            <header class="sec-head">
              <div style="display:flex;align-items:baseline;gap:8px">
                <h2 class="sec-title">SubIDs</h2>
                <span class="count-pill">100 no período</span>
              </div>
              <div style="font-size:11.5px;color:var(--muted)">Ordenar por Lucro ▾</div>
            </header>
            <div class="table-wrap">
              <table class="data">
                <thead>
                  <tr>
                    <th>SubID</th><th>Canal</th><th class="num">Fat.</th><th class="num">Comissão</th>
                    <th class="num">Invest</th><th class="num">Lucro</th><th class="num">ROI</th><th class="num">Ped.</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td class="mono">kitbanho09</td>
                    <td><span class="chip meta"><img src="${A.meta}" alt="" />Meta</span></td>
                    <td class="num">R$ 18.220,00</td><td class="num">R$ 1.120,00</td><td class="num">R$ 410,00</td>
                    <td class="num pos">R$ 640,00</td><td class="num pos">156%</td><td class="num">42</td>
                    <td><span class="status"><i></i>Ativa</span></td>
                  </tr>
                  <tr>
                    <td class="mono">org_home_03</td>
                    <td><span class="chip org"><img src="${A.shopee}" alt="" />Orgânico</span></td>
                    <td class="num">R$ 9.400,00</td><td class="num">R$ 620,00</td><td class="num">R$ 0,00</td>
                    <td class="num pos">R$ 547,00</td><td class="num" style="color:var(--faint)">—</td><td class="num">19</td>
                    <td><span class="status"><i></i>Ativa</span></td>
                  </tr>
                  <tr>
                    <td class="mono">cozinha_pro12</td>
                    <td><span class="chip meta"><img src="${A.meta}" alt="" />Meta</span></td>
                    <td class="num">R$ 14.680,00</td><td class="num">R$ 940,00</td><td class="num">R$ 505,00</td>
                    <td class="num pos">R$ 435,00</td><td class="num pos">86%</td><td class="num">28</td>
                    <td><span class="status"><i></i>Ativa</span></td>
                  </tr>
                  <tr>
                    <td class="mono">pin_deco05</td>
                    <td><span class="chip pin"><img src="${A.pinterest}" alt="" />Pinterest</span></td>
                    <td class="num">R$ 5.240,00</td><td class="num">R$ 338,00</td><td class="num">R$ 120,00</td>
                    <td class="num pos">R$ 182,20</td><td class="num pos">151%</td><td class="num">11</td>
                    <td><span class="status"><i></i>Ativa</span></td>
                  </tr>
                  <tr>
                    <td class="mono">teste33sp</td>
                    <td><span class="chip meta"><img src="${A.meta}" alt="" />Meta</span></td>
                    <td class="num">R$ 2.100,00</td><td class="num">R$ 140,00</td><td class="num">R$ 842,00</td>
                    <td class="num neg">−R$ 720,00</td><td class="num neg">−85%</td><td class="num">3</td>
                    <td><span class="status pause"><i></i>Pausada</span></td>
                  </tr>
                  <tr>
                    <td class="mono">softcasa02</td>
                    <td><span class="chip meta"><img src="${A.meta}" alt="" />Meta</span></td>
                    <td class="num">R$ 3.480,00</td><td class="num">R$ 210,00</td><td class="num">R$ 390,00</td>
                    <td class="num neg">−R$ 148,00</td><td class="num neg">−38%</td><td class="num">7</td>
                    <td><span class="status teste"><i></i>Em teste</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="pager"><span>Mostrando 6 de 100 SubIDs</span><div><span class="btn ghost" style="padding:6px 12px">Anterior</span> <span class="btn" style="padding:6px 12px">Próximo →</span></div></div>
          </section>
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--faint);flex-wrap:wrap;gap:8px">
            <span>Painel de Afiliados · v.1 · pt-BR</span>
            <span class="mono">Última sync 11/08/2026 · 20:12 BRT</span>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="anno">Dashboard completo: header limpo + período + tabs + 4 KPIs + Como ler + Sugestões (4) + chart + resumo diário + SubIDs paginados.</div>

  <!-- ===================== META CHANNEL ===================== -->
  <h2 id="p-meta">2. Campanhas Meta (mesmo shell · filtro Meta)</h2>
  <div class="mock-wrap">
    <div class="mock-label"><span>channel = meta · título muda · sugestões visíveis</span><span>72 SubIDs Meta</span></div>
    <div class="app">
      ${sidebar("meta")}
      <div class="main">
        <header class="topbar"><div class="crumbs">Painel / <strong>Campanhas Meta</strong></div><div class="mono" style="font-size:11.5px;color:var(--muted)">05/08 – 11/08 · 2026</div></header>
        <div class="content">
          <div class="page-head">
            <div>
              <div class="eyebrow"><i></i> Meta · 72 SubIDs no período</div>
              <h1>Campanhas Meta</h1>
              <p class="page-sub">Investimento, ROI e sugestões só do canal Meta.</p>
            </div>
            <div class="actions">
              <span class="btn btn-meta"><img src="${A.meta}" alt="" /> Sincronizar Meta</span>
            </div>
          </div>
          <div class="channel-tabs">
            <span class="ch">Geral</span>
            <span class="ch on" style="background:#1877F2!important">Meta Ads 72</span>
            <span class="ch pin"><img src="${A.pinterest}" alt="" />Pinterest</span>
            <span class="ch org"><img src="${A.shopee}" alt="" />Orgânico</span>
          </div>
          <div class="kpi-grid">
            <article class="kpi-hero">
              <div class="lab"><img src="${A.lucro}" alt="" /> Lucro líquido</div>
              <div class="val">R$ 4.812<span style="opacity:.7;font-size:.64em">,40</span></div>
              <div class="foot">
                <div class="mini"><span>ROI</span><b>131,70%</b></div>
                <div class="mini"><span>SubIDs</span><b>72</b></div>
              </div>
            </article>
            <article class="kpi-ch is-shopee">
              <div class="top"><img src="${A.shopee}" alt="" /><span class="pill">Shopee</span></div>
              <div class="lab">Faturamento (via Meta)</div>
              <div class="val">R$ 112.440<span style="opacity:.7;font-size:.7em">,00</span></div>
              <div class="foot">Comissão <b>R$ 7.180,00</b></div>
            </article>
            <article class="kpi-ch is-meta">
              <div class="top"><img src="${A.meta}" alt="" /><span class="pill">Meta Ads</span></div>
              <div class="lab">Invest em anúncios</div>
              <div class="val">R$ 3.653<span style="opacity:.7;font-size:.7em">,27</span></div>
              <div class="foot">100% deste canal</div>
            </article>
            <article class="kpi-ch is-pin" style="opacity:.55">
              <div class="top"><img src="${A.pinterest}" alt="" /><span class="pill">Pin</span></div>
              <div class="lab">Invest</div>
              <div class="val">R$ 0<span style="opacity:.7;font-size:.7em">,00</span></div>
              <div class="foot">fora do filtro</div>
            </article>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="anno">Campanhas Pinterest / Orgânicas seguem o mesmo padrão: título + contagem + KPIs filtrados. Sugestões Meta somem fora de Geral/Meta.</div>

  <!-- ===================== CANAIS ===================== -->
  <h2 id="p-canais">3. Canais e status (completo · dados fake)</h2>
  <div class="mock-wrap">
    <div class="mock-label"><span>view-canais · classificação</span><span>Meta 72 · Pin 6 · Org 22</span></div>
    <div class="app">
      ${sidebar("canais")}
      <div class="main">
        <header class="topbar"><div class="crumbs">Painel / <strong>Canais e status</strong></div></header>
        <div class="content">
          <div>
            <div class="eyebrow">Operação</div>
            <h1 style="font-family:var(--display);font-size:32px;font-weight:500;margin:6px 0 0;color:var(--ink)">Canais e status</h1>
            <p class="page-sub">Classifique cada SubID por canal e estágio da campanha.</p>
            <div class="chan-counts">
              <span class="chan-count"><img src="${A.meta}" alt="" /> Meta <b>72</b></span>
              <span class="chan-count"><img src="${A.pinterest}" alt="" /> Pin <b>6</b></span>
              <span class="chan-count"><img src="${A.shopee}" alt="" /> Org <b>22</b></span>
            </div>
          </div>
          <section class="sec">
            <header class="sec-head">
              <div>
                <h2 class="sec-title">SubIDs<span class="count-pill">100</span></h2>
                <div class="sec-sub">Alterações salvam automaticamente</div>
              </div>
              <div style="display:flex;gap:8px">
                <span class="btn ghost" style="padding:6px 10px">25 / pág</span>
                <span class="btn ghost" style="padding:6px 10px;min-width:160px;justify-content:flex-start;color:var(--faint)">Buscar SubID…</span>
              </div>
            </header>
            <div class="table-wrap">
              <table class="data">
                <thead><tr><th>SubID</th><th>Canal</th><th>Status</th></tr></thead>
                <tbody>
                  <tr><td class="mono">kitbanho09</td><td><span class="chip meta"><img src="${A.meta}" alt="" />Meta ▾</span></td><td><span class="status"><i></i>Ativa ▾</span></td></tr>
                  <tr><td class="mono">org_home_03</td><td><span class="chip org"><img src="${A.shopee}" alt="" />Orgânico ▾</span></td><td><span class="status"><i></i>Ativa ▾</span></td></tr>
                  <tr><td class="mono">cozinha_pro12</td><td><span class="chip meta"><img src="${A.meta}" alt="" />Meta ▾</span></td><td><span class="status"><i></i>Ativa ▾</span></td></tr>
                  <tr><td class="mono">pin_deco05</td><td><span class="chip pin"><img src="${A.pinterest}" alt="" />Pinterest ▾</span></td><td><span class="status"><i></i>Ativa ▾</span></td></tr>
                  <tr><td class="mono">teste33sp</td><td><span class="chip meta"><img src="${A.meta}" alt="" />Meta ▾</span></td><td><span class="status pause"><i></i>Pausada ▾</span></td></tr>
                  <tr><td class="mono">softcasa02</td><td><span class="chip meta"><img src="${A.meta}" alt="" />Meta ▾</span></td><td><span class="status teste"><i></i>Em teste ▾</span></td></tr>
                  <tr><td class="mono">verao_kids11</td><td><span class="chip meta"><img src="${A.meta}" alt="" />Meta ▾</span></td><td><span class="status"><i></i>Ativa ▾</span></td></tr>
                  <tr><td class="mono">org_kitcama</td><td><span class="chip org"><img src="${A.shopee}" alt="" />Orgânico ▾</span></td><td><span class="status"><i></i>Ativa ▾</span></td></tr>
                </tbody>
              </table>
            </div>
            <div class="pager"><span>Mostrando 8 de 100</span><div><span class="btn ghost" style="padding:6px 12px">Anterior</span> <span class="btn" style="padding:6px 12px">Próximo →</span></div></div>
          </section>
        </div>
      </div>
    </div>
  </div>

  <!-- ===================== CONFIG ===================== -->
  <h2 id="p-config">4. Configurações (completo · preenchida)</h2>
  <div class="mock-wrap">
    <div class="mock-label"><span>view-config · Conexões + Cálculo</span><span>sem CTA Canais duplicado</span></div>
    <div class="app">
      ${sidebar("config")}
      <div class="main">
        <header class="topbar"><div class="crumbs">Painel / <strong>Configurações</strong></div></header>
        <div class="content">
          <div>
            <div class="eyebrow">Sistema</div>
            <h1 style="font-family:var(--display);font-size:32px;font-weight:500;margin:6px 0 0;color:var(--ink)">Configurações</h1>
            <p class="page-sub">Conecte Shopee, Meta e Pinterest e ajuste impostos.</p>
          </div>
          <div>
            <h2 class="cfg-section-title">Conexões</h2>
            <p class="cfg-section-sub">Fontes que alimentam o painel. Salve e teste antes de sincronizar.</p>
            <div class="cfg-grid">
              <article class="cfg-card">
                <header>
                  <div style="display:flex;gap:10px;align-items:center"><img src="${A.shopee}" alt="" /><div><b>Shopee Affiliate</b><div style="font-size:11px;color:var(--muted)">Comissão, pedidos e SubIDs</div></div></div>
                  <span class="state">Conectada</span>
                </header>
                <div class="body">
                  <div class="field-row">
                    <div class="field"><label>App ID</label><div class="fake">18108270013</div></div>
                    <div class="field"><label>Secret</label><div class="fake">••••••••••••8f2a</div></div>
                  </div>
                  <p class="hint">Trocar o App ID reseta métricas Shopee e puxa a nova conta.</p>
                  <div class="actions"><span class="btn primary">Salvar</span><span class="btn ghost">Testar</span></div>
                </div>
              </article>
              <article class="cfg-card">
                <header>
                  <div style="display:flex;gap:10px;align-items:center"><img src="${A.meta}" alt="" /><div><b>Meta Ads</b><div style="font-size:11px;color:var(--muted)">Invest e ROI por SubID</div></div></div>
                  <span class="state">Conectada</span>
                </header>
                <div class="body">
                  <div class="field"><label>Access token</label><div class="fake">EAAGm0PX4ZCpsBO••••••••</div></div>
                  <div class="field-row">
                    <div class="field"><label>Contas de anúncio</label><div class="fake">1396814339…, 3872115821…</div></div>
                    <div class="field"><label>Versão da API</label><div class="fake">v19.0</div></div>
                  </div>
                  <div class="actions"><span class="btn primary">Salvar</span><span class="btn ghost">Testar</span><span class="btn ghost">Sincronizar</span></div>
                </div>
              </article>
              <article class="cfg-card">
                <header>
                  <div style="display:flex;gap:10px;align-items:center"><img src="${A.pinterest}" alt="" /><div><b>Pinterest</b><div style="font-size:11px;color:var(--muted)">Invest via CSV</div></div></div>
                  <span class="state manual">Manual</span>
                </header>
                <div class="body">
                  <div class="field"><label>Arquivo CSV</label><div class="fake">pinterest_ago2026.csv · 42 KB</div></div>
                  <p class="hint">Último import: 11/08/2026 · R$ 428,90 no período</p>
                  <div class="actions"><span class="btn primary">Importar CSV</span></div>
                </div>
              </article>
            </div>
          </div>
          <div>
            <h2 class="cfg-section-title">Cálculo e equipe</h2>
            <p class="cfg-section-sub">Impostos e identidade do painel.</p>
            <article class="cfg-card" style="max-width:720px">
              <header>
                <div style="display:flex;gap:10px;align-items:center"><img src="${A.config}" alt="" /><div><b>Impostos e equipe</b><div style="font-size:11px;color:var(--muted)">Entram na fórmula de lucro e ROI</div></div></div>
              </header>
              <div class="body">
                <div class="field-row">
                  <div class="field"><label>Imposto s/ comissão (%)</label><div class="fake">11,70</div></div>
                  <div class="field"><label>Imposto s/ invest Meta (%)</label><div class="fake">12,00</div></div>
                </div>
                <div class="field-row">
                  <div class="field"><label>Nome da equipe</label><div class="fake">Operação Casa &amp; Decor</div></div>
                  <div class="field"><label>Plano / subtítulo</label><div class="fake">Shopee · Meta · Pin</div></div>
                </div>
                <p class="hint">Lucro = comissão × (1 − gov%) − (invest Meta × (1 + taxa Meta%) + invest Pin)</p>
                <div class="actions"><span class="btn primary">Salvar ajustes</span></div>
              </div>
            </article>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ===================== PRODUTOS ===================== -->
  <h2 id="p-produtos">5. Produtos (tabela alimentada)</h2>
  <div class="mock-wrap">
    <div class="mock-label"><span>view-data · produtos</span><span>312 produtos com venda</span></div>
    <div class="app">
      ${sidebar("produtos")}
      <div class="main">
        <header class="topbar"><div class="crumbs">Painel / <strong>Produtos</strong></div></header>
        <div class="content">
          <div class="page-head">
            <div>
              <div class="eyebrow">Base de dados</div>
              <h1 style="font-family:var(--display);font-size:32px;font-weight:500;margin:6px 0 0;color:var(--ink)">Produtos</h1>
              <p class="page-sub">312 produtos com venda no período 05/08 a 11/08.</p>
            </div>
            <div class="actions"><span class="btn ghost">Voltar ao painel</span></div>
          </div>
          <section class="sec">
            <header class="sec-head">
              <div><h2 class="sec-title">Produtos</h2><div class="sec-sub">período do painel</div></div>
              <div style="display:flex;gap:8px"><span class="btn ghost" style="padding:6px 10px">25 / pág</span><span class="btn ghost" style="padding:6px 10px;color:var(--faint)">Buscar…</span></div>
            </header>
            <div class="table-wrap">
              <table class="data">
                <thead><tr><th>Produto</th><th>Loja</th><th class="num">Pedidos</th><th class="num">Qtd</th><th class="num">Faturamento</th><th class="num">Comissão</th></tr></thead>
                <tbody>
                  <tr><td>Kit Banho Soft 5 peças</td><td>CasaPremium BR</td><td class="num">84</td><td class="num">91</td><td class="num">R$ 22.480,00</td><td class="num">R$ 1.348,80</td></tr>
                  <tr><td>Jogo de Panelas Antiaderente</td><td>CozinhaPro</td><td class="num">61</td><td class="num">61</td><td class="num">R$ 18.220,00</td><td class="num">R$ 1.093,20</td></tr>
                  <tr><td>Organizador Closet Modular</td><td>HomeOrg</td><td class="num">47</td><td class="num">52</td><td class="num">R$ 9.870,00</td><td class="num">R$ 592,20</td></tr>
                  <tr><td>Luminária LED Touch</td><td>Luz&amp;Casa</td><td class="num">39</td><td class="num">44</td><td class="num">R$ 6.240,00</td><td class="num">R$ 374,40</td></tr>
                  <tr><td>Jogo de Lençol Casal 400 fios</td><td>SoftCasa</td><td class="num">33</td><td class="num">33</td><td class="num">R$ 8.910,00</td><td class="num">R$ 534,60</td></tr>
                  <tr><td>Escorredor Retrátil Silicone</td><td>CozinhaPro</td><td class="num">28</td><td class="num">35</td><td class="num">R$ 2.660,00</td><td class="num">R$ 159,60</td></tr>
                </tbody>
              </table>
            </div>
            <div class="pager"><span>Mostrando 6 de 312</span><div><span class="btn" style="padding:6px 12px">Próximo →</span></div></div>
          </section>
        </div>
      </div>
    </div>
  </div>

  <!-- ===================== AUTH ===================== -->
  <h2 id="p-auth">6. Auth (login)</h2>
  <div class="mock-wrap">
    <div class="mock-label"><span>auth-gate · sem demo de senha</span><span>registro pede Shopee obrigatório</span></div>
    <div class="auth-shell">
      <div class="auth-card">
        <div class="brand-name">Afiliados</div>
        <div class="brand-sub">painel · v.1</div>
        <div class="auth-tabs"><span class="on">Entrar</span><span>Criar conta</span></div>
        <div class="field" style="margin-bottom:10px"><label>Email</label><div class="fake">seu@email.com</div></div>
        <div class="field" style="margin-bottom:14px"><label>Senha</label><div class="fake">••••••••</div></div>
        <span class="btn primary" style="width:100%;justify-content:center">Entrar</span>
        <p style="margin:14px 0 0;font-size:12px;color:var(--muted)">Cada conta usa a própria Shopee e o próprio Meta.</p>
      </div>
    </div>
  </div>

  <!-- ===================== ADMIN ===================== -->
  <h2 id="p-admin">7. Admin (resumo · dados fake)</h2>
  <div class="mock-wrap">
    <div class="mock-label"><span>admin.html · tema escuro separado</span><span>Afiliados · admin · v.1</span></div>
    <div class="admin-app">
      <aside class="admin-rail">
        <div class="t">Afiliados</div>
        <div class="s">admin · v.1</div>
        <div style="margin-top:18px">
          <div class="admin-item on">Resumo</div>
          <div class="admin-item">Pendentes <span class="mono" style="float:right;color:#fbbf24">4</span></div>
          <div class="admin-item">Usuários</div>
        </div>
      </aside>
      <div class="admin-main">
        <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8b93a7;font-weight:700">Gestão</div>
        <h2 style="font-family:var(--display);font-size:28px;font-weight:500;margin:6px 0 4px;color:#fff">Resumo</h2>
        <p style="margin:0;color:#8b93a7;font-size:13px">Visão operacional das contas do sistema.</p>
        <div class="admin-stats">
          <div class="admin-stat"><span>Pendentes</span><b>4</b></div>
          <div class="admin-stat"><span>Aprovados</span><b>38</b></div>
          <div class="admin-stat"><span>Total contas</span><b>42</b></div>
        </div>
        <div style="margin-top:16px;background:#14171e;border:1px solid #232833;border-radius:12px;overflow:hidden">
          <div style="padding:12px 16px;border-bottom:1px solid #232833;color:#fff;font-weight:600">Fila de aprovação</div>
          <table class="data" style="min-width:0">
            <thead><tr><th style="background:#12151c;color:#8b93a7">Email</th><th style="background:#12151c;color:#8b93a7">Empresa</th><th style="background:#12151c;color:#8b93a7">Shopee</th><th style="background:#12151c;color:#8b93a7">Ação</th></tr></thead>
            <tbody>
              <tr><td style="background:#14171e;color:#e8eaef;border-color:#232833">nova@loja.com</td><td style="background:#14171e;color:#aab2c0;border-color:#232833">Loja Norte</td><td style="background:#14171e;color:#aab2c0;border-color:#232833" class="mono">18108…</td><td style="background:#14171e;border-color:#232833"><span style="color:#34c48c;font-weight:700">Aprovar</span></td></tr>
              <tr><td style="background:#14171e;color:#e8eaef;border-color:#232833">ops@casa.br</td><td style="background:#14171e;color:#aab2c0;border-color:#232833">Casa BR</td><td style="background:#14171e;color:#aab2c0;border-color:#232833" class="mono">19022…</td><td style="background:#14171e;border-color:#232833"><span style="color:#34c48c;font-weight:700">Aprovar</span></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <h2 id="regras">Regras rígidas</h2>
  <div class="card warn">
    <ul>
      <li>Sidebar 246px · trilho preto no ativo · badges mono · marca sem logo ao lado (“painel · v.1”).</li>
      <li>4 KPIs na ordem Lucro → Shopee → Meta → Pin; vazio = <code>—</code>.</li>
      <li>Sugestões Meta máx. 4; Config em 2 seções; sem repetir ROI no header.</li>
      <li>Formato BR; ícones dos assets embutidos; sem frameworks novos.</li>
    </ul>
  </div>
  <p class="lead" style="margin-top:24px">Fim · <code>node scripts/build-design-index.cjs</code> · arquivo: <code>DESIGN-INDEX-PARA-IA.html</code></p>
</div>
</body>
</html>
`;

fs.writeFileSync(outPath, html, "utf8");
console.log(`OK → ${outPath} (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB)`);
