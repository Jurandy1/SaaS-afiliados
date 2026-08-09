(() => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];

  const TOKEN_KEY = "metricly_access_token";
  const USER_KEY = "metricly_user";

  function getToken() { return localStorage.getItem(TOKEN_KEY) || ""; }
  function setSession(accessToken, user) {
    localStorage.setItem(TOKEN_KEY, accessToken || "");
    localStorage.setItem(USER_KEY, JSON.stringify(user || {}));
  }
  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
  function getStoredUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || "{}"); } catch { return {}; }
  }

  function showApp(user) {
    $("#auth-gate").classList.add("hidden");
    $("#app-shell").classList.remove("hidden");
    if (user?.email) $("#user-email-label").textContent = user.email;
  }
  function showAuth() {
    $("#auth-gate").classList.remove("hidden");
    $("#app-shell").classList.add("hidden");
  }

  const DATA_VIEWS = new Set([
    "visao", "performance", "comparativos", "produtos", "campanhas",
    "pedidos", "comissoes", "investimentos", "metas", "impostos", "equipe",
  ]);

  const VIEW_LABELS = {
    dashboard: "Painel de Lucro",
    subids: "SubIDs",
    config: "Configurações",
    integracoes: "Integrações",
    visao: "Visão geral",
    performance: "Performance",
    comparativos: "Comparativos",
    produtos: "Produtos",
    campanhas: "Campanhas",
    pedidos: "Pedidos",
    comissoes: "Comissões",
    investimentos: "Investimentos",
    metas: "Metas & bônus",
    impostos: "Impostos",
    equipe: "Equipe",
  };

  const SPARK = {
    up: "M0,18 L14,14 L28,15 L42,10 L56,11 L70,7 L84,5 L100,3",
    upFill: "M0,18 L14,14 L28,15 L42,10 L56,11 L70,7 L84,5 L100,3 L100,22 L0,22 Z",
    flat: "M0,11 L14,10 L28,12 L42,9 L56,11 L70,10 L84,12 L100,11",
    flatFill: "M0,11 L14,10 L28,12 L42,9 L56,11 L70,10 L84,12 L100,11 L100,22 L0,22 Z",
  };

  const state = {
    view: "dashboard",
    tab: "Geral",
    dash: null,
    configured: false,
    metaConfigured: false,
    settings: { metaBase: 863959, taxRate: 0, teamName: "SaaS SHOPPE", teamPlan: "Shopee · Meta" },
    subidPage: 1,
    subidPageFull: 1,
    pageSize: 10,
    dataRows: [],
    dataKind: null,
  };

  function fmt(v) {
    return "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtNum(v) {
    return Number(v || 0).toLocaleString("pt-BR");
  }
  function fmtPct(v) {
    if (v == null || Number.isNaN(Number(v))) return "—";
    return Number(v).toFixed(1).replace(".", ",") + "%";
  }
  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function daysAgoISO(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }
  function monthStartISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  }
  function shortDay(iso) {
    if (!iso) return "—";
    const [, m, d] = iso.split("-");
    const months = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
    return `${d} ${months[Number(m) - 1]}`;
  }
  function chartDay(iso) {
    if (!iso) return "—";
    const [, m, d] = iso.split("-");
    const months = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
    return `${d} ${months[Number(m) - 1]}`;
  }
  function daysLeftInMonth() {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return Math.max(1, end.getDate() - now.getDate());
  }

  async function api(path, opts = {}) {
    const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(path, { ...opts, headers });
    const json = await res.json().catch(() => ({}));
    if (res.status === 401 || json.code === "UNAUTHORIZED") {
      clearSession();
      showAuth();
      const err = new Error(json.error || "Faça login");
      err.code = "UNAUTHORIZED";
      throw err;
    }
    if (!res.ok || json.success === false) {
      const err = new Error(json.error || `HTTP ${res.status}`);
      err.code = json.code;
      throw err;
    }
    return json;
  }

  function setView(navKey) {
    const view = navKey === "integracoes" ? "config" : navKey;
    state.view = view;

    $$(".nav-item").forEach((b) => {
      if (view === "config") {
        b.classList.toggle("active", b.dataset.view === "config" || b.dataset.view === "integracoes");
      } else {
        b.classList.toggle("active", b.dataset.view === navKey);
      }
    });

    const isData = DATA_VIEWS.has(view);
    $("#view-dashboard").classList.toggle("hidden", view !== "dashboard");
    $("#view-subids").classList.toggle("hidden", view !== "subids");
    $("#view-config").classList.toggle("hidden", view !== "config");
    $("#view-data").classList.toggle("hidden", !isData);
    $("#crumb-label").textContent = VIEW_LABELS[navKey] || VIEW_LABELS[view] || view;

    if (view === "subids") renderSubIdsFull();
    if (isData) loadDataView(view);
  }

  function sparkSvg(path, fill, color) {
    return `<svg viewBox="0 0 100 22" preserveAspectRatio="none">
      <path d="${path}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${fill}" fill="${color}" fill-opacity="0.08"/>
    </svg>`;
  }

  function renderKpis(k) {
    const ped = fmtNum(k.pedidos);
    const invMeta = Number(k.inv_meta || 0);
    const invPin = Number(k.inv_pin || 0);
    const invTotal = Number(k.inv_total || 0);
    const lucro = k.lucro != null ? Number(k.lucro) : Number(k.comissao || 0) - invTotal;
    const cards = [
      { label: "Faturamento Total", value: fmt(k.faturamento), delta: "Shopee", on: true, color: "#15803d", spark: SPARK.up, fill: SPARK.upFill },
      { label: "Comissão Total", value: fmt(k.comissao), delta: "Shopee", on: true, color: "#15803d", spark: SPARK.up, fill: SPARK.upFill },
      { label: "Invest. Meta", value: fmt(invMeta), delta: invMeta ? "Meta API" : "sem sync", on: invMeta > 0, color: invMeta ? "#15803d" : "#525252", spark: SPARK.flat, fill: SPARK.flatFill },
      { label: "Invest. Pinterest", value: fmt(invPin), delta: invPin ? "CSV" : "sem CSV", on: invPin > 0, color: invPin ? "#15803d" : "#525252", spark: SPARK.flat, fill: SPARK.flatFill },
      { label: "Invest. Total", value: fmt(invTotal), delta: k.faturamento ? `${fmtPct((invTotal / k.faturamento) * 100)} do fat.` : "—", on: invTotal > 0, color: "#525252", spark: SPARK.flat, fill: SPARK.flatFill },
      { label: "Lucro Acumulado", value: fmt(lucro), delta: invTotal ? "com − invest" : "≈ comissão", on: true, color: lucro >= 0 ? "#15803d" : "#b91c1c", spark: SPARK.up, fill: SPARK.upFill },
      { label: "ROI Médio", value: fmtPct(k.roi), delta: invTotal ? "lucro/invest" : "sem invest.", on: invTotal > 0, color: "#15803d", spark: SPARK.up, fill: SPARK.upFill },
      { label: "Abatimento Médio", value: fmtPct(k.abatimento), delta: `${ped} ped.`, on: true, color: "#525252", spark: SPARK.flat, fill: SPARK.flatFill },
    ];
    $("#kpi-grid").innerHTML = cards.map((c) => `
      <div class="kpi">
        <div class="kpi-top">
          <div class="kpi-label">${c.label}</div>
          <span class="kpi-delta ${c.on ? "on" : "off"}">${c.delta}</span>
        </div>
        <div class="kpi-value">${c.value}</div>
        <div class="kpi-spark">${sparkSvg(c.spark, c.fill, c.color)}</div>
      </div>
    `).join("");
  }

  function renderProjection(k) {
    const fat = Number(k.faturamento || 0);
    const base = Number(state.settings.metaBase || 863959);
    const targets = [
      { label: "Meta 100% · 1%", mult: 1, bonusPct: 0.01 },
      { label: "Meta 125% · 2%", mult: 1.25, bonusPct: 0.02 },
      { label: "Meta 150% · 3%", mult: 1.5, bonusPct: 0.03 },
    ];
    const left = daysLeftInMonth();
    $("#proj-sub").innerHTML = `Faturamento até agora <strong class="mono">${fmt(fat)}</strong> · ${left} dias restantes`;
    const headers = [`<div class="h">% Bônus s/ faturamento</div>`].concat(targets.map((t) => `<div class="h r">${t.label}</div>`)).join("");
    const rowFat = [`<div class="c">Faturamento para atingir</div>`].concat(targets.map((t) => `<div class="c r mono">${fmt(base * t.mult)}</div>`)).join("");
    const rowBonus = [`<div class="c hi">Valor do bônus meta</div>`].concat(targets.map((t) => `<div class="c r green">${fmt(base * t.mult * t.bonusPct)}</div>`)).join("");
    const rowDaily = [`<div class="c">Faturamento diário necessário</div>`].concat(targets.map((t) => {
      const need = Math.max(0, base * t.mult - fat) / left;
      return `<div class="c r mono">${fmt(need)}</div>`;
    })).join("");
    const rowProg = [`<div class="c">Progresso da meta</div>`].concat(targets.map((t, i) => {
      const pct = Math.min(100, (fat / (base * t.mult)) * 100);
      const bg = i === 0 ? "#0a0a0a" : i === 1 ? "#404040" : "#737373";
      return `<div class="c r"><div class="prog-row"><div class="prog-bar"><i style="width:${pct.toFixed(1)}%;background:${bg}"></i></div><span class="prog-pct">${pct.toFixed(1).replace(".", ",")}%</span></div></div>`;
    })).join("");
    $("#proj-grid").innerHTML = headers + rowFat + rowBonus + rowDaily + rowProg;
  }

  function renderInsight(k, subIds) {
    const n = (subIds || []).length;
    const ativos = (subIds || []).filter((s) => Number(s.pedidos) > 0).length;
    const ped = Number(k.pedidos || 0);
    const inv = Number(k.inv_total || 0);
    $("#insight-title").textContent = ped
      ? `${fmtNum(ped)} pedidos · invest ${fmt(inv)}`
      : "Aguardando sync…";
    $("#insight-body").textContent = ped
      ? `Comissão ${fmt(k.comissao)} · lucro ${fmt(k.lucro)} · ROI ${fmtPct(k.roi)}.`
      : "Sincronize Shopee (e Meta) ou ajuste as datas.";
    $("#insight-stats").innerHTML = `
      <div><div class="l">SubIDs com venda</div><div class="v">${fmtNum(ativos)} <span>/ ${fmtNum(n)}</span></div></div>
      <div><div class="l">Classificados</div><div class="v">${fmtNum(n)}</div></div>
      <div><div class="l">Inv. Meta</div><div class="v">${fmt(k.inv_meta)}</div></div>
      <div><div class="l">Inv. Pin</div><div class="v">${fmt(k.inv_pin)}</div></div>
    `;
  }

  function renderChart(daily) {
    const rows = daily || [];
    if (!rows.length) {
      $("#daily-chart").innerHTML = `<div class="panel-sub" style="padding:8px 0">Sem dados no período.</div>`;
      return;
    }
    const max = Math.max(...rows.map((d) => Math.max(Number(d.comissao || 0), Number(d.inv_total || 0))), 1);
    const n = rows.length;
    const cols = rows.map((d) => {
      const com = Number(d.comissao || 0);
      const inv = Number(d.inv_total || 0);
      const hCom = Math.max(2, Math.round((com / max) * 100));
      const hInv = Math.max(inv > 0 ? 2 : 0, Math.round((inv / max) * 100));
      return `
        <div class="chart-col" title="${d.data}: com ${fmt(com)} · inv ${fmt(inv)}">
          <div class="chart-val">${fmt(com).replace("R$ ", "R$")}</div>
          <div class="chart-pair">
            <div class="chart-bar com" style="height:${hCom}%"></div>
            <div class="chart-bar inv" style="height:${hInv || 2}%"></div>
          </div>
        </div>`;
    }).join("");
    const labels = rows.map((d) => `<span>${chartDay(d.data)}</span>`).join("");
    $("#daily-chart").innerHTML = `
      <div class="chart-inner">
        <div class="chart-ylabels">
          <span>${fmt(max).replace("R$ ", "")}</span>
          <span>${fmt(max * 0.5).replace("R$ ", "")}</span>
          <span>0</span>
        </div>
        <div class="chart-plot">
          <div class="chart-grid"><i style="top:0"></i><i style="top:50%"></i><i style="top:100%"></i></div>
          <div class="chart-bars" style="grid-template-columns:repeat(${n},1fr)">${cols}</div>
          <div class="chart-labels" style="grid-template-columns:repeat(${n},1fr)">${labels}</div>
        </div>
      </div>`;
  }

  function renderDailyTable(daily, k) {
    const rows = daily || [];
    $("#daily-tbody").innerHTML = rows.map((d) => {
      const fat = Number(d.faturamento || 0);
      const com = Number(d.comissao || 0);
      const abat = fat > 0 ? (com / fat) * 100 : 0;
      const lucro = d.lucro != null ? d.lucro : com - Number(d.inv_total || 0);
      return `<tr>
        <td>${shortDay(d.data)}</td>
        <td class="num">${fmt(fat)}</td>
        <td class="num">${fmt(com)}</td>
        <td class="num">${fmt(d.inv_meta)}</td>
        <td class="num">${fmt(d.inv_pin)}</td>
        <td class="num">${fmt(d.inv_total)}</td>
        <td class="num ${lucro >= 0 ? "green" : ""}">${fmt(lucro)}</td>
        <td class="num">${fmtPct(d.roi)}</td>
        <td class="num">${fmtPct(abat)}</td>
      </tr>`;
    }).join("") || `<tr><td colspan="9">Sem dias no período.</td></tr>`;

    if (rows.length) {
      $("#daily-tfoot").innerHTML = `<tr>
        <td>TOTAL</td>
        <td class="num">${fmt(k.faturamento)}</td>
        <td class="num">${fmt(k.comissao)}</td>
        <td class="num">${fmt(k.inv_meta)}</td>
        <td class="num">${fmt(k.inv_pin)}</td>
        <td class="num">${fmt(k.inv_total)}</td>
        <td class="num green">${fmt(k.lucro)}</td>
        <td class="num">${fmtPct(k.roi)}</td>
        <td class="num">${fmtPct(k.abatimento)}</td>
      </tr>`;
    } else $("#daily-tfoot").innerHTML = "";
  }

  function filteredSubIds(list, q) {
    const query = (q || "").trim().toLowerCase();
    return (list || []).filter((r) => !query || String(r.subid).toLowerCase().includes(query));
  }

  function renderPager(el, page, total, pageSize, onPage) {
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const from = total ? (page - 1) * pageSize + 1 : 0;
    const to = Math.min(total, page * pageSize);
    const btns = [];
    btns.push(`<button type="button" data-p="${page - 1}" ${page <= 1 ? "disabled" : ""}>← Anterior</button>`);
    const window = [];
    for (let i = 1; i <= pages && window.length < 5; i++) {
      if (i === 1 || i === pages || Math.abs(i - page) <= 1) window.push(i);
    }
    let last = 0;
    window.forEach((i) => {
      if (last && i - last > 1) btns.push(`<span style="padding:5px 4px;color:#a3a3a3">…</span>`);
      btns.push(`<button type="button" class="${i === page ? "active" : ""}" data-p="${i}">${i}</button>`);
      last = i;
    });
    btns.push(`<button type="button" data-p="${page + 1}" ${page >= pages ? "disabled" : ""}>Próximo →</button>`);
    el.innerHTML = `
      <div>Exibindo <strong style="color:#0a0a0a">${from}–${to}</strong> de <strong style="color:#0a0a0a">${fmtNum(total)}</strong></div>
      <div class="pager-btns">${btns.join("")}</div>`;
    el.querySelectorAll("button[data-p]").forEach((b) => {
      b.addEventListener("click", () => {
        const p = Number(b.dataset.p);
        if (p >= 1 && p <= pages) onPage(p);
      });
    });
  }

  function renderSubIdsDash() {
    const all = filteredSubIds(state.dash?.subIds || [], $("#subid-search")?.value);
    const total = all.length;
    const pages = Math.max(1, Math.ceil(total / state.pageSize));
    if (state.subidPage > pages) state.subidPage = pages;
    const slice = all.slice((state.subidPage - 1) * state.pageSize, state.subidPage * state.pageSize);
    $("#subid-count-pill").textContent = fmtNum(total);
    $("#nav-subid-count").textContent = fmtNum(state.dash?.subIds?.length || 0);
    $("#subid-tbody").innerHTML = slice.map((r) => `
      <tr>
        <td class="subid">${escapeHtml(r.subid)}</td>
        <td class="num">${fmt(r.faturamento)}</td>
        <td class="num">${fmt(r.comissao)}</td>
        <td class="num">${fmt(r.inv_total)}</td>
        <td class="num ${(r.lucro || 0) >= 0 ? "green" : ""}">${fmt(r.lucro)}</td>
        <td class="num">${fmtPct(r.roi)}</td>
        <td class="num">${fmtNum(r.pedidos)}</td>
        <td class="num">${fmtNum(r.concluidos)}</td>
        <td class="num">${fmtNum(r.pendentes)}</td>
        <td><span class="status-pill"><i></i>Ativa</span></td>
      </tr>
    `).join("") || `<tr><td colspan="10">Nenhum SubID neste período.</td></tr>`;
    renderPager($("#subid-pager"), state.subidPage, total, state.pageSize, (p) => {
      state.subidPage = p;
      renderSubIdsDash();
    });
  }

  function renderSubIdsFull() {
    const all = filteredSubIds(state.dash?.subIds || [], $("#subid-search-full")?.value);
    const total = all.length;
    const pages = Math.max(1, Math.ceil(total / state.pageSize));
    if (state.subidPageFull > pages) state.subidPageFull = pages;
    const slice = all.slice((state.subidPageFull - 1) * state.pageSize, state.subidPageFull * state.pageSize);
    $("#subid-tbody-full").innerHTML = slice.map((r) => `
      <tr>
        <td class="subid">${escapeHtml(r.subid)}</td>
        <td class="num">${fmt(r.faturamento)}</td>
        <td class="num">${fmt(r.comissao)}</td>
        <td class="num">${fmtPct(r.abatimento)}</td>
        <td class="num">${fmtNum(r.pedidos)}</td>
        <td class="num">${fmtNum(r.concluidos)}</td>
        <td class="num">${fmtNum(r.pendentes)}</td>
        <td class="num">${fmtNum(r.cancelados)}</td>
      </tr>
    `).join("") || `<tr><td colspan="8">Nenhum SubID.</td></tr>`;
    renderPager($("#subid-pager-full"), state.subidPageFull, total, state.pageSize, (p) => {
      state.subidPageFull = p;
      renderSubIdsFull();
    });
  }

  function paintDataTable(headers, rows) {
    state.dataRows = rows;
    $("#data-thead").innerHTML = `<tr>${headers.map((h) => `<th class="${h.num ? "num" : ""}">${h.label}</th>`).join("")}</tr>`;
    renderDataBody(headers);
  }

  function renderDataBody(headers) {
    const q = ($("#data-search")?.value || "").trim().toLowerCase();
    const filtered = state.dataRows.filter((r) => {
      if (!q) return true;
      return Object.values(r).some((v) => String(v).toLowerCase().includes(q));
    });
    $("#data-tbody").innerHTML = filtered.map((r) => `
      <tr>${headers.map((h) => `<td class="${h.num ? "num" : ""}">${h.render ? h.render(r) : escapeHtml(r[h.key] ?? "—")}</td>`).join("")}</tr>
    `).join("") || `<tr><td colspan="${headers.length}">Sem dados. Sincronize Shopee/Meta.</td></tr>`;
  }

  async function loadDataView(view) {
    $("#data-title").textContent = VIEW_LABELS[view] || view;
    $("#data-sub").textContent = "Dados do período selecionado no Painel (ou sync completo).";
    $("#data-panel-title").textContent = VIEW_LABELS[view];
    state.dataKind = view;
    const start = $("#start-date")?.value || daysAgoISO(6);
    const end = $("#end-date")?.value || todayISO();
    const k = state.dash?.kpis || {};
    const daily = state.dash?.daily || [];
    const subIds = state.dash?.subIds || [];

    try {
      if (view === "pedidos") {
        const r = await api(`/api/orders?start=${start}&end=${end}`);
        paintDataTable(
          [
            { label: "Data", key: "data" },
            { label: "Pedido", key: "order_id" },
            { label: "SubID", key: "subid" },
            { label: "Status", key: "status" },
            { label: "Faturamento", num: true, render: (x) => fmt(x.faturamento) },
            { label: "Comissão", num: true, render: (x) => fmt(x.comissao) },
          ],
          r.orders || [],
        );
      } else if (view === "produtos") {
        const r = await api("/api/products");
        paintDataTable(
          [
            { label: "Item", key: "item_name" },
            { label: "Loja", key: "shop_name" },
            { label: "Pedidos", num: true, render: (x) => fmtNum(x.pedidos) },
            { label: "Qtd", num: true, render: (x) => fmtNum(x.qty) },
            { label: "Faturamento", num: true, render: (x) => fmt(x.faturamento) },
            { label: "Comissão", num: true, render: (x) => fmt(x.comissao) },
          ],
          r.products || [],
        );
      } else if (view === "campanhas") {
        const r = await api(`/api/campaigns?start=${start}&end=${end}`);
        paintDataTable(
          [
            { label: "Campanha", key: "campaign" },
            { label: "Gasto", num: true, render: (x) => fmt(x.gasto) },
            { label: "Ads", num: true, render: (x) => fmtNum(x.ads) },
            { label: "Cliques", num: true, render: (x) => fmtNum(x.cliques) },
            { label: "Impressões", num: true, render: (x) => fmtNum(x.impressoes) },
          ],
          r.campaigns || [],
        );
        if (!(r.campaigns || []).length) {
          $("#data-sub").textContent = "Sem campanhas — configure Meta e clique em Sincronizar Meta.";
        }
      } else if (view === "investimentos") {
        paintDataTable(
          [
            { label: "Dia", key: "data", render: (x) => shortDay(x.data) },
            { label: "Inv. Meta", num: true, render: (x) => fmt(x.inv_meta) },
            { label: "Inv. Pin", num: true, render: (x) => fmt(x.inv_pin) },
            { label: "Inv. Total", num: true, render: (x) => fmt(x.inv_total) },
            { label: "Comissão", num: true, render: (x) => fmt(x.comissao) },
            { label: "Lucro", num: true, render: (x) => fmt(x.lucro) },
            { label: "ROI", num: true, render: (x) => fmtPct(x.roi) },
          ],
          daily,
        );
      } else if (view === "performance") {
        paintDataTable(
          [
            { label: "SubID", key: "subid" },
            { label: "Comissão", num: true, render: (x) => fmt(x.comissao) },
            { label: "Invest.", num: true, render: (x) => fmt(x.inv_total) },
            { label: "Lucro", num: true, render: (x) => fmt(x.lucro) },
            { label: "ROI", num: true, render: (x) => fmtPct(x.roi) },
            { label: "Pedidos", num: true, render: (x) => fmtNum(x.pedidos) },
          ],
          subIds,
        );
      } else if (view === "comissoes") {
        paintDataTable(
          [
            { label: "Métrica", key: "label" },
            { label: "Valor", num: true, key: "value" },
          ],
          [
            { label: "Comissão total", value: fmt(k.comissao) },
            { label: "Concluídos", value: fmtNum(k.concluidos) },
            { label: "Pendentes", value: fmtNum(k.pendentes) },
            { label: "Cancelados", value: fmtNum(k.cancelados) },
            { label: "Não pagos", value: fmtNum(k.unpaid) },
            { label: "Abatimento médio", value: fmtPct(k.abatimento) },
          ],
        );
      } else if (view === "visao" || view === "comparativos") {
        paintDataTable(
          [
            { label: "Dia", key: "data", render: (x) => shortDay(x.data) },
            { label: "Faturamento", num: true, render: (x) => fmt(x.faturamento) },
            { label: "Comissão", num: true, render: (x) => fmt(x.comissao) },
            { label: "Pedidos", num: true, render: (x) => fmtNum(x.pedidos) },
            { label: "Invest.", num: true, render: (x) => fmt(x.inv_total) },
            { label: "Lucro", num: true, render: (x) => fmt(x.lucro) },
          ],
          daily,
        );
      } else if (view === "metas") {
        const base = state.settings.metaBase;
        paintDataTable(
          [{ label: "Campo", key: "label" }, { label: "Valor", num: true, key: "value" }],
          [
            { label: "Meta base", value: fmt(base) },
            { label: "Faturamento período", value: fmt(k.faturamento) },
            { label: "Progresso meta 100%", value: fmtPct(base ? (k.faturamento / base) * 100 : 0) },
            { label: "Bônus 1% se atingir", value: fmt(base * 0.01) },
          ],
        );
      } else if (view === "impostos") {
        const tax = Number(state.settings.taxRate || 0);
        const imposto = (Number(k.comissao || 0) * tax) / 100;
        paintDataTable(
          [{ label: "Campo", key: "label" }, { label: "Valor", num: true, key: "value" }],
          [
            { label: "Alíquota", value: fmtPct(tax) },
            { label: "Base (comissão)", value: fmt(k.comissao) },
            { label: "Imposto estimado", value: fmt(imposto) },
            { label: "Líquido após imposto", value: fmt(Number(k.comissao || 0) - imposto) },
          ],
        );
      } else if (view === "equipe") {
        paintDataTable(
          [{ label: "Campo", key: "label" }, { label: "Valor", key: "value" }],
          [
            { label: "Nome", value: state.settings.teamName },
            { label: "Plano", value: state.settings.teamPlan },
            { label: "Shopee", value: state.configured ? "OK" : "pendente" },
            { label: "Meta", value: state.metaConfigured ? "OK" : "pendente" },
          ],
        );
      }
    } catch (err) {
      $("#data-tbody").innerHTML = `<tr><td>${escapeHtml(err.message)}</td></tr>`;
    }
  }

  function applyDash(dash, { cached } = {}) {
    state.dash = dash;
    state.subidPage = 1;
    state.subidPageFull = 1;
    const k = dash.kpis || {};
    renderKpis(k);
    renderProjection(k);
    renderInsight(k, dash.subIds || []);
    renderChart(dash.daily || []);
    renderDailyTable(dash.daily || [], k);
    renderSubIdsDash();
    renderSubIdsFull();
    const when = dash.syncedAt ? new Date(dash.syncedAt).toLocaleString("pt-BR") : "—";
    $("#sync-meta").textContent = `${cached ? "cache · " : ""}${dash.nodes || 0} nodes · ${when}`;
    $("#footer-sync").textContent = `Última sincronização ${when}`;
    $("#page-sub").textContent = `Comissão ${fmt(k.comissao)} · invest ${fmt(k.inv_total)} · ROI ${fmtPct(k.roi)}`;
  }

  async function loadCredentials() {
    const c = await api("/api/credentials");
    state.configured = Boolean(c.configured);
    $("#sidebar-status").textContent = c.configured ? `APP ${c.appId}` : "API não configurada";
    if (c.appId) $("#app-id").value = c.appId;
    const banner = $("#sync-banner");
    if (c.configured) {
      banner.className = "banner ok";
      banner.innerHTML = "APIs prontas. Use <strong>Sincronizar Shopee</strong> e, em Config, <strong>Sincronizar Meta</strong>.";
    } else {
      banner.className = "banner";
      banner.innerHTML = 'Configure Shopee em <button type="button" class="linkish" data-goto="config">Configurações</button>.';
      banner.querySelector("[data-goto]")?.addEventListener("click", () => setView("config"));
    }
    return c;
  }

  async function loadMetaCreds() {
    try {
      const m = await api("/api/meta/credentials");
      state.metaConfigured = Boolean(m.configured);
      if (m.adAccountIds) $("#meta-accounts").value = m.adAccountIds;
      if (m.apiVersion) $("#meta-version").value = m.apiVersion;
      const when = m.lastSyncAt ? new Date(m.lastSyncAt).toLocaleString("pt-BR") : "nunca";
      $("#meta-status-sub").textContent = m.configured
        ? `${m.accountsCount} contas · token ${m.tokenMasked} · sync ${when}`
        : "Marketing API · invest / ROI por SubID";
      $("#meta-token").placeholder = m.tokenMasked
        ? `Salvo: ${m.tokenMasked} (deixe vazio para manter)`
        : "Access token Marketing API";
    } catch (e) {
      console.warn(e);
    }
  }

  async function loadSettingsUi() {
    try {
      const s = await api("/api/settings");
      state.settings = {
        metaBase: s.metaBase,
        taxRate: s.taxRate,
        teamName: s.teamName,
        teamPlan: s.teamPlan,
      };
      $("#set-meta-base").value = s.metaBase;
      $("#set-tax").value = s.taxRate;
      $("#set-team-name").value = s.teamName;
      $("#set-team-plan").value = s.teamPlan;
      $("#team-name").textContent = s.teamName;
      $("#team-plan").textContent = s.teamPlan;
      state.metaBase = s.metaBase;
    } catch (e) {
      console.warn(e);
    }
  }

  async function loadDashboard({ force = false } = {}) {
    const start = $("#start-date").value;
    const end = $("#end-date").value;
    const btn = force ? $("#btn-sync") : $("#btn-load");
    const prev = btn.textContent;
    btn.disabled = true;
    btn.textContent = force ? "Sincronizando…" : "Carregando…";
    try {
      const q = new URLSearchParams({ start, end });
      if (force) q.set("force", "1");
      const dash = await api(`/api/dashboard?${q}`);
      applyDash(dash, { cached: dash.cached });
      const banner = $("#sync-banner");
      banner.className = "banner ok";
      banner.textContent = `${start}→${end}: ${fmt(dash.kpis.comissao)} comissão · ${fmt(dash.kpis.inv_total)} invest · ROI ${fmtPct(dash.kpis.roi)}`;
    } catch (err) {
      const banner = $("#sync-banner");
      banner.className = "banner err";
      banner.textContent = err.message || String(err);
      if (err.code === "CREDS_MISSING") setView("config");
    } finally {
      btn.disabled = false;
      btn.textContent = prev;
    }
  }

  function setRange(kind) {
    $$(".chip-btn").forEach((b) => b.classList.toggle("active", b.dataset.range === kind));
    if (kind === "7d") {
      $("#start-date").value = daysAgoISO(6);
      $("#end-date").value = todayISO();
    } else {
      $("#start-date").value = monthStartISO();
      $("#end-date").value = todayISO();
    }
    loadDashboard({ force: false });
  }

  function exportCsv() {
    const rows = state.dash?.daily || [];
    if (!rows.length) return alert("Sem dados. Sincronize primeiro.");
    const lines = ["data;faturamento;comissao;inv_meta;inv_pin;inv_total;lucro;roi;pedidos"];
    rows.forEach((d) => {
      lines.push([d.data, d.faturamento, d.comissao, d.inv_meta, d.inv_pin, d.inv_total, d.lucro, d.roi, d.pedidos].join(";"));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `metricly-${$("#start-date").value}_${$("#end-date").value}.csv`;
    a.click();
  }

  function wire() {
    $("#start-date").value = daysAgoISO(6);
    $("#end-date").value = todayISO();

    let authMode = "login";
    $("#auth-tab-login")?.addEventListener("click", () => {
      authMode = "login";
      $("#auth-tab-login").classList.add("active");
      $("#auth-tab-register").classList.remove("active");
      $("#auth-submit").textContent = "Entrar";
    });
    $("#auth-tab-register")?.addEventListener("click", () => {
      authMode = "register";
      $("#auth-tab-register").classList.add("active");
      $("#auth-tab-login").classList.remove("active");
      $("#auth-submit").textContent = "Criar conta";
    });
    $("#auth-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const status = $("#auth-status");
      status.className = "form-status";
      status.textContent = authMode === "login" ? "Entrando…" : "Criando conta…";
      try {
        const path = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
        const r = await fetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: $("#auth-email").value.trim(),
            password: $("#auth-password").value,
          }),
        }).then((x) => x.json());
        if (!r.success) throw new Error(r.error || "Falha");
        setSession(r.access_token, r.user);
        status.className = "form-status ok";
        status.textContent = "OK";
        showApp(r.user);
        await bootApp();
      } catch (err) {
        status.className = "form-status err";
        status.textContent = err.message;
      }
    });
    $("#btn-logout")?.addEventListener("click", () => {
      clearSession();
      showAuth();
    });

    $$(".nav-item").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
    document.body.addEventListener("click", (e) => {
      const t = e.target.closest("[data-goto]");
      if (t) setView(t.dataset.goto);
    });

    $$(".chip-btn").forEach((b) => b.addEventListener("click", () => setRange(b.dataset.range)));
    $$("#channel-tabs .tab").forEach((t) => {
      t.addEventListener("click", () => {
        const tab = t.dataset.tab;
        state.tab = tab;
        $$("#channel-tabs .tab").forEach((x) => x.classList.toggle("active", x === t));
        if (tab === "Meta") setView("investimentos");
        else if (tab === "Pinterest") setView("investimentos");
        else if (tab === "SubID") {
          setView("dashboard");
          document.getElementById("dash-subids-panel")?.scrollIntoView({ behavior: "smooth" });
        }
      });
    });

    $("#btn-load").addEventListener("click", () => loadDashboard({ force: false }));
    $("#btn-sync").addEventListener("click", () => loadDashboard({ force: true }));
    $("#btn-export").addEventListener("click", exportCsv);
    $("#btn-edit-meta").addEventListener("click", () => setView("config"));

    $("#subid-search")?.addEventListener("input", () => { state.subidPage = 1; renderSubIdsDash(); });
    $("#subid-search-full")?.addEventListener("input", () => { state.subidPageFull = 1; renderSubIdsFull(); });
    $("#data-search")?.addEventListener("input", () => {
      if (state.dataKind) loadDataView(state.dataKind);
    });

    $("#cred-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const status = $("#cred-status");
      status.className = "form-status";
      status.textContent = "Salvando…";
      try {
        const saved = await api("/api/credentials", {
          method: "POST",
          body: JSON.stringify({ appId: $("#app-id").value.trim(), secret: $("#app-secret").value.trim() }),
        });
        status.className = "form-status ok";
        status.textContent = saved.reset
          ? "API trocada — dados resetados. Sincronize Shopee."
          : (saved.message || "Salvo.");
        $("#app-secret").value = "";
        await loadCredentials();
      } catch (err) {
        status.className = "form-status err";
        status.textContent = err.message;
      }
    });

    $("#btn-test").addEventListener("click", async () => {
      const status = $("#cred-status");
      status.textContent = "Testando…";
      try {
        const r = await api("/api/credentials/test", { method: "POST", body: "{}" });
        status.className = "form-status ok";
        status.textContent = `API OK — ${r.sample?.productName || "ok"}`;
      } catch (err) {
        status.className = "form-status err";
        status.textContent = err.message;
      }
    });

    $("#meta-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const status = $("#meta-status");
      status.className = "form-status";
      status.textContent = "Salvando Meta…";
      try {
        const body = {
          adAccountIds: $("#meta-accounts").value.trim(),
          apiVersion: $("#meta-version").value.trim() || "v19.0",
        };
        const tok = $("#meta-token").value.trim();
        if (tok) body.accessToken = tok;
        const saved = await api("/api/meta/credentials", { method: "POST", body: JSON.stringify(body) });
        status.className = "form-status ok";
        status.textContent = saved.message || "Meta salvo.";
        $("#meta-token").value = "";
        await loadMetaCreds();
      } catch (err) {
        status.className = "form-status err";
        status.textContent = err.message;
      }
    });

    $("#btn-meta-test").addEventListener("click", async () => {
      const status = $("#meta-status");
      status.className = "form-status";
      status.textContent = "Testando Meta…";
      try {
        const r = await api("/api/meta/test", { method: "POST", body: "{}" });
        status.className = "form-status ok";
        status.textContent = `OK ${r.user?.name || r.user?.id || ""} · ${r.accounts} contas` +
          (r.sampleSpend != null ? ` · spend ontem ${r.sampleSpend}` : "") +
          (r.warning ? ` · ${r.warning}` : "");
      } catch (err) {
        status.className = "form-status err";
        status.textContent = err.message;
      }
    });

    $("#btn-meta-sync").addEventListener("click", async () => {
      const status = $("#meta-status");
      status.className = "form-status";
      status.textContent = "Sincronizando Meta (pode levar 1–2 min)…";
      $("#btn-meta-sync").disabled = true;
      try {
        const r = await api("/api/meta/sync", { method: "POST", body: JSON.stringify({ daysBack: 7 }) });
        status.className = "form-status ok";
        status.textContent = `Meta sync: ${r.gravados} linhas (${r.range?.since}→${r.range?.until})` +
          (r.erros?.length ? ` · avisos: ${r.erros.join("; ")}` : "");
        await loadMetaCreds();
        await loadDashboard({ force: false });
      } catch (err) {
        status.className = "form-status err";
        status.textContent = err.message;
      } finally {
        $("#btn-meta-sync").disabled = false;
      }
    });

    $("#btn-pin-import").addEventListener("click", async () => {
      const status = $("#pin-status");
      const file = $("#pin-file").files?.[0];
      if (!file) {
        status.className = "form-status err";
        status.textContent = "Selecione um CSV.";
        return;
      }
      status.className = "form-status";
      status.textContent = "Importando…";
      try {
        const text = await file.text();
        const r = await api("/api/pinterest/import", {
          method: "POST",
          body: JSON.stringify({ csv: text }),
        });
        status.className = "form-status ok";
        status.textContent = `Pinterest: ${r.gravados} linhas importadas.`;
        await loadDashboard({ force: false });
      } catch (err) {
        status.className = "form-status err";
        status.textContent = err.message;
      }
    });

    $("#settings-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const status = $("#settings-status");
      try {
        const s = await api("/api/settings", {
          method: "POST",
          body: JSON.stringify({
            metaBase: Number($("#set-meta-base").value),
            taxRate: Number($("#set-tax").value),
            teamName: $("#set-team-name").value.trim(),
            teamPlan: $("#set-team-plan").value.trim(),
          }),
        });
        state.settings = s;
        $("#team-name").textContent = s.teamName;
        $("#team-plan").textContent = s.teamPlan;
        if (state.dash) renderProjection(state.dash.kpis || {});
        status.className = "form-status ok";
        status.textContent = "Ajustes salvos.";
      } catch (err) {
        status.className = "form-status err";
        status.textContent = err.message;
      }
    });
  }

  async function bootApp() {
    await Promise.all([loadCredentials(), loadMetaCreds(), loadSettingsUi()]);
    if (state.configured) await loadDashboard({ force: false });
    else {
      renderKpis({});
      renderProjection({});
      renderInsight({}, []);
    }
  }

  async function boot() {
    wire();
    const token = getToken();
    if (!token) {
      showAuth();
      return;
    }
    try {
      const me = await api("/api/auth/me");
      showApp(me.user || getStoredUser());
      await bootApp();
    } catch {
      clearSession();
      showAuth();
    }
  }

  boot();
})();
