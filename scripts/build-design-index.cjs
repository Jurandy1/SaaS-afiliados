/**
 * Gera DESIGN-INDEX-PARA-IA.html — arquivo único autocontido
 * para entregar a uma IA melhorar design, layout e informação.
 *
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

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>DESIGN INDEX · Painel de Afiliados · Briefing para IA</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
<style>
/* ========== TOKENS (iguais ao produto) ========== */
:root {
  --bg: #f2f4f8;
  --bg-grad:
    radial-gradient(ellipse 70% 40% at 8% -6%, rgba(238, 77, 45, 0.045), transparent 62%),
    radial-gradient(ellipse 46% 34% at 98% 0%, rgba(24, 119, 242, 0.04), transparent 58%);
  --text: #0f172a;
  --soft: #334155;
  --muted: #64748b;
  --faint: #94a3b8;
  --line: #eef1f5;
  --line2: #e6e9ef;
  --card: #ffffff;
  --shopee: #EE4D2D;
  --meta: #1877F2;
  --pin: #E60023;
  --green: #059669;
  --ink: #0f172a;
  --display: "Fraunces", Georgia, serif;
  --sans: "Inter", system-ui, sans-serif;
  --mono: "JetBrains Mono", ui-monospace, monospace;
  --sidebar-w: 246px;
  --r: 14px;
  --shadow: 0 1px 2px rgba(15,23,42,.04), 0 8px 24px -18px rgba(15,23,42,.12);
}
* { box-sizing: border-box; }
html, body { margin: 0; }
body {
  font-family: var(--sans);
  font-size: 14px;
  color: var(--text);
  background: #0b1220;
  line-height: 1.5;
}
.doc { max-width: 1280px; margin: 0 auto; padding: 28px 20px 80px; }
.doc h1, .doc h2, .doc h3 { font-family: var(--display); font-weight: 600; letter-spacing: -0.01em; }
.doc h1 { font-size: 32px; color: #fff; margin: 0 0 8px; }
.doc h2 { font-size: 22px; color: #fff; margin: 36px 0 12px; border-bottom: 1px solid #1e293b; padding-bottom: 8px; }
.doc h3 { font-size: 16px; color: #e2e8f0; margin: 20px 0 8px; }
.doc p, .doc li { color: #cbd5e1; }
.doc a { color: #93c5fd; }
.lead { font-size: 15px; color: #94a3b8; max-width: 72ch; margin: 0 0 24px; }
.badge {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 700;
  background: #1e293b; color: #fbbf24; letter-spacing: .04em; text-transform: uppercase; margin-bottom: 14px;
}
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
@media (max-width: 900px) { .grid-2 { grid-template-columns: 1fr; } }
.card {
  background: #111827; border: 1px solid #1f2937; border-radius: 14px; padding: 16px 18px;
}
.card strong { color: #f8fafc; }
.card code, .mono { font-family: var(--mono); font-size: 12px; }
.card ul { margin: 8px 0 0; padding-left: 18px; }
.card li { margin: 4px 0; }
.warn { border-color: #92400e; background: #1c1408; }
.warn strong { color: #fbbf24; }
.ok { border-color: #065f46; background: #071510; }
.swatches { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px; }
.swatch {
  width: 112px; border-radius: 10px; overflow: hidden; border: 1px solid #334155; background: #0f172a;
}
.swatch i { display: block; height: 36px; }
.swatch span { display: block; padding: 6px 8px; font-family: var(--mono); font-size: 10px; color: #94a3b8; }

/* ========== MOCK DO APP ========== */
.mock-wrap {
  margin-top: 18px;
  border: 1px solid #334155;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 30px 80px -40px rgba(0,0,0,.8);
}
.mock-label {
  background: #1e293b; color: #94a3b8; font-size: 11px; font-weight: 700;
  letter-spacing: .08em; text-transform: uppercase; padding: 10px 14px;
  display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap;
}
.app {
  display: grid;
  grid-template-columns: var(--sidebar-w) minmax(0, 1fr);
  min-height: 920px;
  background: var(--bg);
  background-image: var(--bg-grad);
  color: var(--text);
  font-family: var(--sans);
}
.sidebar {
  background: #fff;
  border-right: 1px solid var(--line2);
  display: flex; flex-direction: column; padding: 16px 12px 14px;
}
.brand-name { font-family: var(--display); font-size: 18px; font-weight: 600; }
.brand-sub { font-size: 11px; color: var(--muted); }
.account-pill {
  display: flex; gap: 10px; align-items: center; margin: 14px 0 12px;
  padding: 8px 10px; border-radius: 10px; background: #f8fafc; border: 1px solid var(--line);
}
.account-avatar {
  width: 32px; height: 32px; border-radius: 9px; background: var(--ink); color: #fff;
  display: grid; place-items: center; font-size: 11px; font-weight: 700;
}
.account-title { font-size: 12.5px; font-weight: 600; }
.account-sub { font-size: 11px; color: var(--muted); }
.nav-sec-title {
  font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
  color: var(--faint); margin: 12px 8px 6px;
}
.nav-item {
  display: flex; align-items: center; gap: 9px; width: 100%;
  padding: 9px 10px; border-radius: 9px; font-size: 13px; font-weight: 500; color: var(--soft);
  position: relative; text-align: left;
}
.nav-item:hover { background: #f4f5f7; }
.nav-item.active { background: #f4f5f7; font-weight: 600; color: var(--text); }
.nav-item.active::before {
  content: ""; position: absolute; left: -12px; top: 8px; bottom: 8px; width: 2px; background: #000;
}
.nav-logo { width: 16px; height: 16px; object-fit: contain; }
.nav-badge { margin-left: auto; font-family: var(--mono); font-size: 10.5px; color: var(--faint); }
.sidebar-foot { margin-top: auto; padding-top: 12px; border-top: 1px solid var(--line); }
.api-status { font-size: 11.5px; color: var(--muted); padding: 8px; background: #f8fafc; border-radius: 10px; margin-bottom: 10px; }
.api-dot { display: inline-block; width: 7px; height: 7px; border-radius: 99px; background: #22c55e; margin-right: 6px; }
.main { min-width: 0; display: flex; flex-direction: column; }
.topbar {
  display: flex; justify-content: space-between; align-items: center; gap: 12px;
  padding: 10px 22px; border-bottom: 1px solid var(--line); background: rgba(255,255,255,.7); backdrop-filter: blur(8px);
}
.crumbs { font-size: 12.5px; color: var(--muted); }
.crumbs strong { color: var(--text); }
.search-wrap {
  display: flex; align-items: center; gap: 8px; background: #fff; border: 1px solid var(--line2);
  border-radius: 9px; padding: 7px 10px; min-width: 200px;
}
.search-wrap span { color: var(--faint); font-size: 12px; }
.top-meta { font-family: var(--mono); font-size: 11.5px; color: var(--muted); }
.content { padding: 20px 22px 40px; }
.page-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; flex-wrap: wrap; margin-bottom: 14px; }
.eyebrow {
  display: inline-flex; align-items: center; gap: 8px; font-size: 10.5px; letter-spacing: .16em;
  text-transform: uppercase; color: var(--shopee); font-weight: 700;
}
.eyebrow i { width: 6px; height: 6px; border-radius: 99px; background: #22c55e; }
.page-head h1 { font-family: var(--display); font-size: 26px; margin: 6px 0 0; line-height: 1.15; }
.page-sub { margin: 4px 0 0; color: var(--muted); font-size: 12.5px; max-width: 60ch; }
.actions { display: flex; gap: 8px; flex-wrap: wrap; }
.btn {
  display: inline-flex; align-items: center; gap: 7px; padding: 8px 12px; border-radius: 9px;
  font-size: 12.5px; font-weight: 600; border: 1px solid var(--line2); background: #fff; color: var(--text); cursor: default;
}
.btn img { width: 14px; height: 14px; object-fit: contain; }
.btn-meta { background: #eff6ff; border-color: #bfdbfe; color: #1d4ed8; }
.btn-shopee { background: var(--shopee); border: 0; color: #fff; }
.period-bar {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  background: #fff; border: 1px solid var(--line2); border-radius: 12px; padding: 8px 10px 8px 8px; margin-bottom: 14px;
}
.period-main {
  display: inline-flex; align-items: center; gap: 10px; padding: 8px 14px; background: var(--ink);
  color: #fff; border-radius: 9px; font-size: 12.5px; font-weight: 600; font-family: var(--mono);
}
.period-hint { font-size: 11.5px; color: var(--muted); }
.presets { margin-left: auto; display: flex; background: #f8fafc; border: 1px solid var(--line); border-radius: 9px; padding: 3px; }
.preset { padding: 6px 12px; border-radius: 7px; font-size: 12px; font-weight: 600; color: var(--muted); }
.preset.on { background: #fff; color: var(--ink); box-shadow: 0 1px 2px rgba(15,23,42,.08); }
.channel-tabs { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 0 16px; border-bottom: 1px solid var(--line); margin-bottom: 16px; }
.ch {
  display: inline-flex; align-items: center; gap: 7px; padding: 7px 14px; border-radius: 999px;
  font-size: 12px; font-weight: 600; border: 1px solid #e2e8f0; background: #fff; color: #475569;
}
.ch img { width: 14px; height: 14px; object-fit: contain; }
.ch.on { background: var(--ink); color: #fff; border-color: transparent; }
.ch.meta { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
.ch.pin { background: #fef2f4; color: #c8385f; border-color: #fecdd3; }
.ch.org { background: #f0fdf4; color: #047857; border-color: #bbf7d0; }
.zone-tag {
  display: inline-flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 700;
  letter-spacing: .06em; text-transform: uppercase; color: var(--faint); margin: 8px 0 12px;
}
.kpi-grid {
  display: grid; grid-template-columns: 1.05fr 0.95fr 0.95fr 0.95fr; gap: 14px;
}
@media (max-width: 1100px) { .kpi-grid { grid-template-columns: 1fr 1fr; } .app { grid-template-columns: 210px minmax(0,1fr); } }
@media (max-width: 780px) { .kpi-grid { grid-template-columns: 1fr; } .app { grid-template-columns: 1fr; } .sidebar { display: none; } }
.kpi-hero {
  color: #fff; background: linear-gradient(135deg, #065f46 0%, #059669 55%, #34d399 100%);
  border-radius: 18px; padding: 22px; box-shadow: 0 14px 34px -14px rgba(5,150,105,.55); position: relative; overflow: hidden;
}
.kpi-hero .lab { font-size: 10.5px; letter-spacing: .16em; text-transform: uppercase; font-weight: 700; opacity: .9; display: flex; align-items: center; gap: 8px; }
.kpi-hero .lab img { width: 18px; height: 18px; }
.kpi-hero .val { font-family: var(--mono); font-size: 34px; font-weight: 600; margin: 10px 0 4px; line-height: 1; }
.kpi-hero .note { font-size: 12px; opacity: .9; }
.kpi-hero .foot { display: flex; gap: 20px; margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,.2); flex-wrap: wrap; }
.kpi-hero .mini span { display: block; font-size: 9.5px; letter-spacing: .08em; text-transform: uppercase; opacity: .75; font-weight: 700; }
.kpi-hero .mini b { font-family: var(--mono); font-size: 14px; }
.kpi-ch {
  border-radius: 18px; padding: 18px; color: #fff; min-height: 148px; display: flex; flex-direction: column; gap: 6px;
  box-shadow: var(--shadow);
}
.kpi-ch.is-shopee { background: linear-gradient(145deg, #c73a1f, #EE4D2D 55%, #ff7a5c); }
.kpi-ch.is-meta { background: linear-gradient(145deg, #0b5bd3, #1877F2 55%, #4b9bff); }
.kpi-ch.is-pin { background: linear-gradient(145deg, #b3001b, #E60023 55%, #ff4d6a); }
.kpi-ch .top { display: flex; justify-content: space-between; align-items: center; }
.kpi-ch .top img { width: 22px; height: 22px; object-fit: contain; }
.kpi-ch .pill { font-size: 10px; font-weight: 700; background: rgba(255,255,255,.18); padding: 3px 8px; border-radius: 999px; }
.kpi-ch .lab { font-size: 11px; opacity: .9; font-weight: 600; }
.kpi-ch .val { font-family: var(--mono); font-size: 26px; font-weight: 600; margin-top: auto; }
.kpi-ch .foot { font-size: 12px; opacity: .9; }
.kpi-help {
  display: flex; gap: 12px; align-items: flex-start; margin: 14px 0 0; padding: 12px 14px;
  background: #fdfaf3; border: 1px dashed #f0e0b6; border-radius: 12px; font-size: 12px; color: #8b6b1c;
}
.kpi-help .i {
  width: 18px; height: 18px; border-radius: 99px; background: #f59e0b; color: #fff;
  display: grid; place-items: center; font-size: 11px; font-weight: 800; flex-shrink: 0;
}
.ops-grid { display: grid; grid-template-columns: 1.15fr .85fr; gap: 14px; margin-top: 18px; }
@media (max-width: 1100px) { .ops-grid { grid-template-columns: 1fr; } }
.sec {
  background: #fff; border: 1px solid var(--line2); border-radius: 14px; overflow: hidden; box-shadow: var(--shadow);
}
.sec.meta-sug { border-left: 4px solid var(--meta); }
.sec-head {
  display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;
  padding: 14px 18px; border-bottom: 1px solid var(--line);
}
.sec.meta-sug .sec-head { background: linear-gradient(90deg, #eff6ff, transparent 50%); }
.sec-head-text { display: flex; align-items: center; gap: 10px; }
.sec-head-text img { width: 22px; height: 22px; }
.sec-title { font-family: var(--display); font-size: 17px; margin: 0; }
.sec-sub { font-size: 11px; color: var(--muted); margin-top: 1px; }
.sug-count { font-size: 11.5px; color: #1d4ed8; font-weight: 600; background: #eff6ff; padding: 5px 10px; border-radius: 99px; }
.sug-row {
  display: grid; grid-template-columns: 150px 100px 1fr 140px; gap: 12px; align-items: center;
  padding: 12px 18px; border-bottom: 1px solid #f4f6fa; font-size: 12.5px;
}
.sug-row:last-child { border-bottom: 0; }
.sug-subid { font-family: var(--mono); color: #1d4ed8; font-weight: 700; display: flex; align-items: center; gap: 7px; }
.sug-subid img { width: 14px; height: 14px; }
.tag { display: inline-flex; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; }
.tag.pausar { background: #fef2f2; color: #b91c1c; }
.tag.escalar { background: #ecfdf5; color: #047857; }
.tag.testar { background: #fefce8; color: #a16207; }
.act { justify-self: end; padding: 7px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; color: #fff; border: 0; }
.act.pausar { background: #ef4444; }
.act.escalar { background: #10b981; }
.chart-body { padding: 16px 18px 18px; }
.bars { display: flex; align-items: flex-end; gap: 6px; height: 120px; }
.bar { flex: 1; background: #10b981; border-radius: 4px 4px 0 0; min-width: 0; }
.bar.neg { background: #ef4444; }
.legend { display: flex; gap: 12px; font-size: 11.5px; color: var(--muted); }
.legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 5px; vertical-align: -1px; }
.legend .g { background: #10b981; }
.legend .r { background: #ef4444; }
.table-wrap { overflow: auto; }
table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
th {
  text-align: left; font-size: 10.5px; letter-spacing: .06em; text-transform: uppercase;
  color: var(--faint); font-weight: 700; padding: 10px 12px; border-bottom: 1px solid var(--line); background: #fafbfd; white-space: nowrap;
}
td { padding: 10px 12px; border-bottom: 1px solid #f4f6fa; white-space: nowrap; }
td.num, th.num { text-align: right; font-family: var(--mono); font-variant-numeric: tabular-nums; }
tfoot td { background: #0f172a; color: #fff; font-family: var(--mono); font-weight: 600; border: 0; }
.chip {
  display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 8px;
  font-size: 11.5px; font-weight: 700; border: 1px solid #e2e8f0;
}
.chip img { width: 13px; height: 13px; }
.chip.meta { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
.chip.org { background: #f0fdf4; color: #047857; border-color: #bbf7d0; }
.chip.pin { background: #fef2f4; color: #c8385f; border-color: #fecdd3; }
.status {
  display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 999px;
  font-size: 11px; font-weight: 700; background: #ecfdf5; color: #047857;
}
.status i { width: 6px; height: 6px; border-radius: 99px; background: #10b981; }
.status.pause { background: #fef2f2; color: #b91c1c; }
.status.pause i { background: #ef4444; }
.anno {
  margin-top: 10px; padding: 10px 12px; border-left: 3px solid #38bdf8; background: #0c1a2e;
  color: #bae6fd; font-size: 12.5px; border-radius: 0 8px 8px 0;
}
.structure { overflow-x: auto; }
.structure pre {
  background: #0b1220; color: #e2e8f0; border: 1px solid #1e293b; border-radius: 12px;
  padding: 16px; font-family: var(--mono); font-size: 11.5px; line-height: 1.55; margin: 0;
}
.toc a { display: inline-block; margin: 0 10px 8px 0; padding: 6px 10px; border-radius: 8px; background: #1e293b; text-decoration: none; font-size: 12px; }
</style>
</head>
<body>
<div class="doc">
  <div class="badge">Arquivo único · briefing para IA de design</div>
  <h1>Painel de Afiliados — Design Index</h1>
  <p class="lead">
    Este arquivo é o mapa completo do produto atual: estrutura, tokens, dados, regras e um mock visual fiel.
    Use-o como única referência para melhorar <b style="color:#fff">design, layout e hierarquia de informação</b>
    sem inventar telas, métricas ou fluxos que o sistema não tenha.
  </p>

  <div class="toc">
    <a href="#brief">1. Brief</a>
    <a href="#ia">2. Arquitetura</a>
    <a href="#tokens">3. Tokens</a>
    <a href="#dados">4. Dados & fórmulas</a>
    <a href="#mock">5. Mock Dashboard</a>
    <a href="#telas">6. Outras telas</a>
    <a href="#regras">7. Regras rígidas</a>
  </div>

  <h2 id="brief">1. Brief para a IA</h2>
  <div class="grid-2">
    <div class="card ok">
      <strong>Objetivo</strong>
      <ul>
        <li>Melhorar clareza visual e hierarquia do Dashboard (primeiro viewport).</li>
        <li>Refinar tipografia, espaçamento, densidade tabular e estados vazios.</li>
        <li>Manter o produto utilizável em desktop (≥1100) e mobile (≤780).</li>
        <li>Preservar significado dos números (BR: <code>R$ 1.234,56</code>, datas <code>DD/MM/YYYY</code>).</li>
      </ul>
    </div>
    <div class="card warn">
      <strong>Não faça</strong>
      <ul>
        <li>Não invente seções novas (ex.: projeção de metas, ranking social, feed).</li>
        <li>Não remova os 4 KPI cards — vazios mostram <code>—</code>.</li>
        <li>Não troque a ordem/cores dos KPIs (verde → Shopee → Meta → Pin).</li>
        <li>Não use tema roxo genérico, dark mode forçado, pills coloridas na sidebar.</li>
        <li>Não coloque cards no hero do dashboard; o hero são os 4 KPIs coloridos.</li>
      </ul>
    </div>
  </div>

  <h2 id="ia">2. Arquitetura de informação</h2>
  <div class="structure">
<pre>APP
├─ Auth gate (login / criar conta + credenciais Shopee/Meta)
└─ Shell
   ├─ Sidebar 246px (rail preto 2px no item ativo · hover #f4f5f7 · badge mono cinza)
   │  ├─ Operação: Dashboard · Campanhas Meta · Campanhas Pinterest · Campanhas orgânicas · Produtos
   │  └─ Sistema: Canais e status · Configurações
   └─ Main
      ├─ Topbar (crumbs · busca SubID · período)
      └─ Views
         ├─ Dashboard ★ (principal)
         │  ├─ Cabeçalho: eyebrow Ao vivo · título · subtítulo KPI · ações CSV/Meta/Shopee
         │  ├─ Period bar: botão preto de datas + presets 7d / Este mês / MTD
         │  ├─ Channel tabs: Geral · Meta Ads · Pinterest · Shopee orgânico · Por SubID
         │  ├─ Zona Executivo: 4 KPI heroes + faixa amarela “Como ler”
         │  ├─ Zona Operação: Sugestões Meta (máx. 4) + Lucro por dia (chart)
         │  └─ Zona Detalhamento: Resumo diário + tabela SubIDs
         ├─ SubIDs (lista completa)
         ├─ Canais e status (classificar canal + status)
         ├─ Configurações (Shopee · Meta · Pinterest CSV · impostos)
         └─ Data views (Produtos / campanhas / etc. via tabela genérica)</pre>
  </div>

  <h2 id="tokens">3. Design tokens</h2>
  <div class="card">
    <strong>Tipografia</strong>
    <ul>
      <li><b>Fraunces</b> — títulos (Dashboard, seções, KPIs labels display).</li>
      <li><b>Inter</b> — UI (nav, botões, labels, texto).</li>
      <li><b>JetBrains Mono</b> — números, SubIDs, datas, footers de tabela.</li>
    </ul>
    <strong style="display:block;margin-top:12px">Cores de marca</strong>
    <div class="swatches">
      <div class="swatch"><i style="background:#f2f4f8"></i><span>bg #f2f4f8</span></div>
      <div class="swatch"><i style="background:#0f172a"></i><span>ink #0f172a</span></div>
      <div class="swatch"><i style="background:#059669"></i><span>lucro #059669</span></div>
      <div class="swatch"><i style="background:#EE4D2D"></i><span>Shopee #EE4D2D</span></div>
      <div class="swatch"><i style="background:#1877F2"></i><span>Meta #1877F2</span></div>
      <div class="swatch"><i style="background:#E60023"></i><span>Pin #E60023</span></div>
    </div>
  </div>

  <h2 id="dados">4. Dados, métricas e fórmulas</h2>
  <div class="grid-2">
    <div class="card">
      <strong>Fontes</strong>
      <ul>
        <li><b>Shopee Affiliate API</b> — faturamento, comissão, pedidos, SubIDs, produtos.</li>
        <li><b>Meta Marketing API</b> — invest diário por SubID (ads).</li>
        <li><b>Pinterest CSV</b> — invest importado manualmente.</li>
      </ul>
      <strong style="display:block;margin-top:10px">KPI row (ordem fixa)</strong>
      <ul>
        <li>1. Lucro líquido (verde) + ROI · Abatimento · SubIDs</li>
        <li>2. Faturamento bruto Shopee (+ comissão no rodapé)</li>
        <li>3. Invest Meta</li>
        <li>4. Invest Pinterest</li>
      </ul>
    </div>
    <div class="card">
      <strong>Fórmula de lucro</strong>
      <p class="mono" style="color:#a7f3d0">lucro = comissão × (1 − gov%) − (invMeta × (1 + metaTax%) + invPin)</p>
      <strong style="display:block;margin-top:10px">Sugestões Meta (máx. 4)</strong>
      <ul>
        <li><b>PAUSAR</b> — ativa, ROI 15d &lt; 40%, invest &gt; 0</li>
        <li><b>ESCALAR</b> — ativa, ROI ≥ 40% e consistente 4 dias</li>
        <li><b>TESTAR / reduzir −70%</b> — status teste com ROI ≤ −70%</li>
      </ul>
      <strong style="display:block;margin-top:10px">Colunas Resumo diário</strong>
      <p class="mono" style="color:#94a3b8">Dia · Fat · Com · Inv Meta · Inv Pin · Inv Total · Lucro · ROI · Abat.</p>
      <strong style="display:block;margin-top:10px">Colunas SubIDs</strong>
      <p class="mono" style="color:#94a3b8">SubID · Canal · Fat · Com · Invest · Lucro · ROI · Ped. · Status</p>
    </div>
  </div>

  <h2 id="mock">5. Mock visual — Dashboard (estado com dados)</h2>
  <p class="lead">Mock estático fiel ao layout atual. Ícones embutidos em base64. Valores de exemplo apenas para composição.</p>

  <div class="mock-wrap" id="mock-app">
    <div class="mock-label">
      <span>Viewport desktop · sidebar 246px · tema claro</span>
      <span>Fraunces / Inter / JetBrains Mono</span>
    </div>
    <div class="app">
      <aside class="sidebar">
        <div>
          <div class="brand-name">Afiliados</div>
          <div class="brand-sub">Painel v2.4</div>
        </div>
        <div class="account-pill">
          <div class="account-avatar">AF</div>
          <div>
            <div class="account-title">afiliado@teste.com</div>
            <div class="account-sub">Shopee · Meta</div>
          </div>
        </div>
        <div class="nav-sec-title">Operação</div>
        <div class="nav-item active"><img class="nav-logo" src="${A.dashboard}" alt="" /> Dashboard <span class="nav-badge">100</span></div>
        <div class="nav-item"><img class="nav-logo" src="${A.meta}" alt="" /> Campanhas Meta <span class="nav-badge">72</span></div>
        <div class="nav-item"><img class="nav-logo" src="${A.pinterest}" alt="" /> Campanhas Pinterest <span class="nav-badge">0</span></div>
        <div class="nav-item"><img class="nav-logo" src="${A.shopee}" alt="" /> Campanhas orgânicas <span class="nav-badge">28</span></div>
        <div class="nav-item"><img class="nav-logo" src="${A.produtos}" alt="" /> Produtos</div>
        <div class="nav-sec-title">Sistema</div>
        <div class="nav-item"><img class="nav-logo" src="${A.tag}" alt="" /> Canais e status</div>
        <div class="nav-item"><img class="nav-logo" src="${A.config}" alt="" /> Configurações</div>
        <div class="sidebar-foot">
          <div class="api-status"><span class="api-dot"></span><b>APIs online</b><br/>Shopee ok · Meta ok · Pin CSV</div>
        </div>
      </aside>

      <div class="main">
        <header class="topbar">
          <div class="crumbs">Painel / <strong>Dashboard</strong></div>
          <div style="display:flex;gap:12px;align-items:center">
            <div class="search-wrap"><span>⌕</span><span>Buscar SubID…</span></div>
            <div class="top-meta">05/08/2026 – 11/08/2026</div>
          </div>
        </header>

        <div class="content">
          <div class="page-head">
            <div>
              <div class="eyebrow"><i></i> Ao vivo · 100 SubIDs no período</div>
              <h1>Dashboard</h1>
              <p class="page-sub">Comissão R$ 10.028,32 · invest R$ 3.691,68 · ROI 154,66%</p>
            </div>
            <div class="actions">
              <span class="btn">Exportar CSV</span>
              <span class="btn btn-meta"><img src="${A.meta}" alt="" /> Sincronizar Meta</span>
              <span class="btn btn-shopee"><img src="${A.shopee}" alt="" /> Sincronizar Shopee</span>
            </div>
          </div>

          <div class="period-bar">
            <div class="period-main">05 ago 2026 – 11 ago 2026 ▾</div>
            <span class="period-hint">7 dias</span>
            <div class="presets">
              <span class="preset on">7 dias</span>
              <span class="preset">Este mês</span>
              <span class="preset">MTD</span>
            </div>
          </div>

          <div class="channel-tabs">
            <span class="ch on">Geral</span>
            <span class="ch meta"><img src="${A.meta}" alt="" /> Meta Ads</span>
            <span class="ch pin"><img src="${A.pinterest}" alt="" /> Pinterest</span>
            <span class="ch org"><img src="${A.shopee}" alt="" /> Shopee orgânico</span>
            <span class="ch">Por SubID</span>
          </div>

          <div class="zone-tag">Zona 1 · Executivo</div>
          <div class="kpi-grid">
            <article class="kpi-hero">
              <div class="lab"><img src="${A.lucro}" alt="" /> Lucro líquido no período</div>
              <div class="val">R$ 6.337,64</div>
              <div class="note">= comissão − mídia − impostos</div>
              <div class="foot">
                <div class="mini"><span>ROI</span><b>154,66%</b></div>
                <div class="mini"><span>Abatimento</span><b>6,22%</b></div>
                <div class="mini"><span>SubIDs ativos</span><b>100</b></div>
              </div>
            </article>
            <article class="kpi-ch is-shopee">
              <div class="top"><img src="${A.shopee}" alt="" /><span class="pill">API Shopee</span></div>
              <div class="lab">Faturamento bruto</div>
              <div class="val">R$ 167.639,84</div>
              <div class="foot">Comissão: <b>R$ 10.028,32</b></div>
            </article>
            <article class="kpi-ch is-meta">
              <div class="top"><img src="${A.meta}" alt="" /><span class="pill">API Meta Ads</span></div>
              <div class="lab">Invest em anúncios</div>
              <div class="val">R$ 3.653,27</div>
              <div class="foot">taxado no ROI</div>
            </article>
            <article class="kpi-ch is-pin">
              <div class="top"><img src="${A.pinterest}" alt="" /><span class="pill">CSV Pinterest</span></div>
              <div class="lab">Invest em anúncios</div>
              <div class="val">R$ 0,00</div>
              <div class="foot">CSV do período</div>
            </article>
          </div>
          <div class="kpi-help"><span class="i">i</span><span><b>Como ler:</b> Shopee traz o que você <b>ganhou</b>. Meta e Pinterest mostram o que você <b>gastou</b>. Lucro (verde) = comissão − mídia − impostos.</span></div>

          <div class="zone-tag">Zona 2 · Operação</div>
          <div class="ops-grid">
            <section class="sec meta-sug">
              <header class="sec-head">
                <div class="sec-head-text">
                  <img src="${A.meta}" alt="" />
                  <div>
                    <h2 class="sec-title">Sugestões Meta</h2>
                    <div class="sec-sub">ROI 15d · &lt;40% pausa · +20% escala · −70% teste · máx. 4</div>
                  </div>
                </div>
                <span class="sug-count">4 ações recomendadas</span>
              </header>
              <div class="sug-row">
                <div class="sug-subid"><img src="${A.meta}" alt="" /> teste33sp</div>
                <span class="tag pausar">PAUSAR</span>
                <div>ROI 15d 12,4% · invest R$ 842,00 · 3 vendas</div>
                <button class="act pausar" type="button">Pausar campanha</button>
              </div>
              <div class="sug-row">
                <div class="sug-subid"><img src="${A.meta}" alt="" /> leopine14p</div>
                <span class="tag pausar">PAUSAR</span>
                <div>ROI 15d −8,1% · invest R$ 510,20 · 1 venda</div>
                <button class="act pausar" type="button">Pausar campanha</button>
              </div>
              <div class="sug-row">
                <div class="sug-subid"><img src="${A.meta}" alt="" /> kitbanho09</div>
                <span class="tag escalar">ESCALAR</span>
                <div>ROI 15d 86% · consistente · +20% budget</div>
                <button class="act escalar" type="button">Escalar +20%</button>
              </div>
              <div class="sug-row">
                <div class="sug-subid"><img src="${A.meta}" alt="" /> softcasa02</div>
                <span class="tag testar">TESTAR</span>
                <div>Teste ROI −74% · reduzir budget −70%</div>
                <button class="act pausar" type="button">Reduzir −70%</button>
              </div>
            </section>

            <section class="sec">
              <header class="sec-head">
                <div>
                  <h2 class="sec-title">Lucro por dia</h2>
                  <div class="sec-sub">período selecionado</div>
                </div>
                <div class="legend"><span><i class="g"></i>Lucro</span><span><i class="r"></i>Prejuízo</span></div>
              </header>
              <div class="chart-body">
                <div class="bars">
                  <div class="bar" style="height:55%"></div>
                  <div class="bar" style="height:72%"></div>
                  <div class="bar" style="height:40%"></div>
                  <div class="bar neg" style="height:28%"></div>
                  <div class="bar" style="height:88%"></div>
                  <div class="bar" style="height:64%"></div>
                  <div class="bar" style="height:95%"></div>
                </div>
              </div>
            </section>
          </div>

          <div class="zone-tag">Zona 3 · Detalhamento</div>
          <section class="sec" style="margin-top:4px">
            <header class="sec-head">
              <div>
                <h2 class="sec-title">Resumo diário</h2>
                <div class="sec-sub">Fat · Com · Inv · Lucro · ROI · Abat.</div>
              </div>
              <div class="sec-sub mono">42 nodes · 11/08/2026 20:12</div>
            </header>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Dia</th><th class="num">Faturamento</th><th class="num">Comissão</th>
                    <th class="num">Inv. Meta</th><th class="num">Inv. Pin</th><th class="num">Inv. Total</th>
                    <th class="num">Lucro</th><th class="num">ROI</th><th class="num">Abat.</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>11/08/2026</td><td class="num">R$ 24.120,00</td><td class="num">R$ 1.510,20</td>
                    <td class="num">R$ 520,00</td><td class="num">R$ 0,00</td><td class="num">R$ 520,00</td>
                    <td class="num">R$ 920,10</td><td class="num">176,94%</td><td class="num">5,8%</td>
                  </tr>
                  <tr>
                    <td>10/08/2026</td><td class="num">R$ 21.004,40</td><td class="num">R$ 1.402,10</td>
                    <td class="num">R$ 610,40</td><td class="num">R$ 0,00</td><td class="num">R$ 610,40</td>
                    <td class="num">R$ 710,00</td><td class="num">116,32%</td><td class="num">6,1%</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total</td><td class="num">R$ 167.639,84</td><td class="num">R$ 10.028,32</td>
                    <td class="num">R$ 3.653,27</td><td class="num">R$ 0,00</td><td class="num">R$ 3.653,27</td>
                    <td class="num">R$ 6.337,64</td><td class="num">154,66%</td><td class="num">6,22%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <section class="sec" style="margin-top:14px">
            <header class="sec-head">
              <div>
                <h2 class="sec-title">SubIDs <span class="sug-count" style="margin-left:8px">100</span></h2>
                <div class="sec-sub">clique para abrir histórico</div>
              </div>
            </header>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>SubID</th><th>Canal</th><th class="num">Faturamento</th><th class="num">Comissão</th>
                    <th class="num">Investimento</th><th class="num">Lucro</th><th class="num">ROI</th><th class="num">Ped.</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td class="mono">kitbanho09</td>
                    <td><span class="chip meta"><img src="${A.meta}" alt="" /> Meta</span></td>
                    <td class="num">R$ 18.220,00</td><td class="num">R$ 1.120,00</td><td class="num">R$ 410,00</td>
                    <td class="num">R$ 640,00</td><td class="num">156%</td><td class="num">42</td>
                    <td><span class="status"><i></i> Ativa</span></td>
                  </tr>
                  <tr>
                    <td class="mono">org_home_03</td>
                    <td><span class="chip org"><img src="${A.shopee}" alt="" /> Orgânico</span></td>
                    <td class="num">R$ 9.400,00</td><td class="num">R$ 620,00</td><td class="num">R$ 0,00</td>
                    <td class="num">R$ 547,00</td><td class="num">—</td><td class="num">19</td>
                    <td><span class="status"><i></i> Ativa</span></td>
                  </tr>
                  <tr>
                    <td class="mono">teste33sp</td>
                    <td><span class="chip meta"><img src="${A.meta}" alt="" /> Meta</span></td>
                    <td class="num">R$ 2.100,00</td><td class="num">R$ 140,00</td><td class="num">R$ 842,00</td>
                    <td class="num">−R$ 720,00</td><td class="num">−85%</td><td class="num">3</td>
                    <td><span class="status pause"><i></i> Pausada</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  </div>
  <div class="anno">Anotação: o primeiro viewport deve ler como uma composição — eyebrow + título + ações + período + tabs + KPIs. Evite empilhar cards brancos antes dos KPIs.</div>

  <h2 id="telas">6. Outras telas (estrutura, sem inventar UI)</h2>
  <div class="grid-2">
    <div class="card">
      <strong>Canais e status</strong>
      <ul>
        <li>Tabela: SubID · Canal (Meta/Pin/Orgânico) · Status (Ativa/Em Teste/Pausada).</li>
        <li>Auto-save. Contadores Meta/Pin/Org no header.</li>
        <li>Alimenta filtros do Dashboard e sugestões Meta.</li>
      </ul>
    </div>
    <div class="card">
      <strong>Configurações</strong>
      <ul>
        <li>Cards: API Shopee · Meta Ads · Pinterest CSV.</li>
        <li>Impostos: gov% sobre comissão + taxa sobre invest Meta.</li>
        <li>Mostrar fórmula de lucro visível.</li>
      </ul>
    </div>
    <div class="card">
      <strong>Auth</strong>
      <ul>
        <li>Login / criar conta.</li>
        <li>Registro pede Shopee (obrigatório) e Meta (opcional).</li>
        <li>Demo: teste@gmail.com / 123456789</li>
      </ul>
    </div>
    <div class="card">
      <strong>Assets embutidos neste arquivo</strong>
      <ul>
        <li>dashboard.png · lucro.png · shopee.png · meta.png · pinterest.png</li>
        <li>produtos.png · tag.png · configuracao.png</li>
        <li>Ícones sem fundo branco artificial / sem mix-blend.</li>
      </ul>
    </div>
  </div>

  <h2 id="regras">7. Regras rígidas ao redesenhar</h2>
  <div class="card warn">
    <ul>
      <li>Sidebar fixa ~246px; item ativo com trilho preto 2px; badges mono cinza (sem pill colorida).</li>
      <li>Período = 1 botão preto de datas + presets segmentados à direita.</li>
      <li>Sugestões Meta: borda esquerda azul Meta; no máximo 4 linhas; tags PAUSAR/ESCALAR/TESTAR coloridas.</li>
      <li>Faixa amarela “Como ler” imediatamente abaixo dos KPIs.</li>
      <li>Vazio = <code>—</code>, nunca esconder KPI.</li>
      <li>Breakpoints-alvo: ≤1100px (2×2 KPIs) e ≤780px (coluna única, sidebar off-canvas).</li>
      <li>Entregue HTML/CSS (e notas) coerentes com este índice; não dependa de frameworks novos.</li>
      <li>Idioma da interface: português do Brasil.</li>
    </ul>
  </div>

  <p class="lead" style="margin-top:28px">Fim do Design Index · gerado a partir do produto real em <code>public/</code>.</p>
</div>
</body>
</html>
`;

fs.writeFileSync(outPath, html, "utf8");
const kb = (Buffer.byteLength(html) / 1024).toFixed(1);
console.log(`OK → ${outPath} (${kb} KB)`);
