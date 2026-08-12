(() => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];

  const TOKEN_KEY = "metricly_access_token";
  const USER_KEY = "metricly_user";
  const THEME_KEY = "afiliados_theme";

  function applyTheme(mode) {
    const html = document.documentElement;
    const icon = $("#theme-icon");
    const dark = mode === "dark";
    html.classList.toggle("dark", dark);
    html.classList.toggle("light", !dark);
    if (icon) icon.className = dark ? "fa-solid fa-sun text-xs" : "fa-solid fa-moon text-xs";
    try { localStorage.setItem(THEME_KEY, dark ? "dark" : "light"); } catch (_) { /* ignore */ }
    if (state.chartInstance) {
      state.chartInstance.options.scales.y.grid.color = chartGridColor();
      state.chartInstance.options.scales.x.ticks.color = chartTickColor();
      state.chartInstance.options.scales.y.ticks.color = chartTickColor();
      state.chartInstance.update();
    }
  }

  function initTheme() {
    let mode = "light";
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === "dark" || saved === "light") mode = saved;
      else if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) mode = "dark";
    } catch (_) { /* ignore */ }
    applyTheme(mode);
  }

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
    const shell = $("#app-shell");
    shell.classList.remove("hidden");
    shell.classList.add("flex");
    if (user?.email) $("#user-email-label").textContent = user.email;
    const isAdmin = user?.role === "admin" || user?.profile?.role === "admin";
    const adminLink = $("#admin-entry");
    if (adminLink) {
      adminLink.classList.toggle("hidden", !isAdmin);
      $("#btn-logout")?.classList.toggle("col-span-2", isAdmin ? false : true);
    }
  }
  function setSidebarOpen(open) {
    document.body.classList.toggle("sidebar-open", !!open);
    const backdrop = $("#sidebar-backdrop");
    if (backdrop) {
      if (open) backdrop.removeAttribute("hidden");
      else backdrop.setAttribute("hidden", "");
    }
    $("#btn-sidebar-open")?.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function showAuth() {
    setSidebarOpen(false);
    $("#auth-gate").classList.remove("hidden");
    const shell = $("#app-shell");
    shell.classList.add("hidden");
    shell.classList.remove("flex");
  }

  const DATA_VIEWS = new Set(["produtos", "campanhas", "pedidos"]);

  const CHANNEL_VIEWS = {
    dashboard: "geral",
    "campanhas-meta": "meta",
    "campanhas-pinterest": "pinterest",
    "campanhas-organicas": "organico",
  };

  const CHANNEL_LABELS = {
    geral: "Geral",
    meta: "Meta",
    pinterest: "Pinterest",
    organico: "Orgânico",
    indefinido: "Indefinido",
  };

  const VIEW_LABELS = {
    dashboard: "Dashboard",
    "campanhas-meta": "Campanhas Meta",
    "campanhas-pinterest": "Campanhas Pinterest",
    "campanhas-organicas": "Campanhas orgânicas",
    "analise-ia": "Análise IA",
    canais: "Canais e status",
    config: "Configurações",
    produtos: "Produtos",
    campanhas: "Campanhas",
    pedidos: "Pedidos",
  };

  const CHANNEL_ICONS = {
    meta: `<img src="/assets/meta.png" alt="" />`,
    pinterest: `<img class="is-square" src="/assets/pinterest.png" alt="" />`,
    organico: `<img class="is-square" src="/assets/shopee.png" alt="" />`,
    indefinido: "",
  };

  const state = {
    view: "dashboard",
    channel: "geral",
    navKey: "dashboard",
    tab: "Geral",
    dash: null,
    configured: false,
    metaConfigured: false,
    settings: { taxRate: 11.7, metaTaxRate: 12, teamName: "SaaS SHOPPE", teamPlan: "Shopee · Meta" },
    periodPreset: "7d",
    subidPage: 1,
    opsPage: 1,
    opsPageSize: 25,
    expandedSubIds: {},
    pageSize: 10,
    dataRows: [],
    dataHeaders: [],
    dataKind: null,
    dataPage: 1,
    dataPageSize: 10,
    dataColFilters: {},
    dataSort: { key: null, dir: "asc" },
    subidSort: { key: null, dir: "asc" },
    dailySort: { key: null, dir: "asc" },
    dailyRows: [],
    chartMode: "profit",
    chartInstance: null,
    chartDaily: [],
  };

  function fmt(v) {
    if (v == null || v === "" || Number.isNaN(Number(v))) return "—";
    return "R$ " + Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtMoney(v) {
    return "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtNum(v) {
    return Number(v || 0).toLocaleString("pt-BR");
  }
  function fmtPct(v) {
    if (v == null || Number.isNaN(Number(v))) return "—";
    return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
  }
  /** Valor com centavos rebaixados — usado no herói de lucro. */
  function fmtDisplay(v) {
    if (v == null || v === "" || Number.isNaN(Number(v))) return "—";
    const full = fmtMoney(v);
    const i = full.lastIndexOf(",");
    if (i < 0) return escapeHtml(full);
    return `${escapeHtml(full.slice(0, i))}<span class="cents">${escapeHtml(full.slice(i))}</span>`;
  }
  function fmtShort(v) {
    const n = Number(v || 0);
    const abs = Math.abs(n);
    const sign = n < 0 ? "-" : "";
    if (abs >= 1000) return `${sign}R$${Math.round(abs / 1000).toLocaleString("pt-BR")}k`;
    return `${sign}R$${Math.round(abs).toLocaleString("pt-BR")}`;
  }

  /** Invest usado no ROI (Meta com imposto + Pin), alinhado ao painel de referência. */
  function investForRoi(r) {
    if (!r) return 0;
    const invMeta = Number(r.inv_meta || 0);
    const invPin = Number(r.inv_pin || 0);
    const invTotal = Number(r.inv_total || 0);
    if (r.inv_meta_taxed != null && Number.isFinite(Number(r.inv_meta_taxed))) {
      return Number(r.inv_meta_taxed) + invPin;
    }
    if (invMeta > 0 || invPin > 0) {
      const metaTax = Number(state.settings.metaTaxRate != null ? state.settings.metaTaxRate : 12) / 100;
      return invMeta * (1 + metaTax) + invPin;
    }
    return invTotal;
  }

  function displayRoi(r) {
    if (!r) return null;
    if (r.roi != null && Number.isFinite(Number(r.roi))) return Number(r.roi);
    const inv = investForRoi(r);
    if (inv <= 0) return null;
    const gov = Number(state.settings.taxRate || 0) / 100;
    const lucro = r.lucro != null
      ? Number(r.lucro)
      : Number(r.comissao || 0) * (1 - gov) - inv;
    return (lucro / inv) * 100;
  }

  function roiClass(roi) {
    if (roi == null || !Number.isFinite(Number(roi))) return "";
    return Number(roi) >= 0 ? "green" : "neg";
  }

  function roiTierClass(roi) {
    const r = Number(roi);
    if (!Number.isFinite(r)) return "";
    if (r < 0) return "cell-roi-bad";
    if (r >= 40) return "cell-roi-good";
    return "cell-roi-warn";
  }

  function lucroCellClass(v) {
    return Number(v) >= 0 ? "cell-lucro-pos" : "cell-lucro-neg";
  }
  /** Aceita "R$ 1.234.567,89" / "1234567.89" / "1234567,89" */
  function parseBrNumber(raw) {
    let s = String(raw ?? "").trim();
    if (!s) return 0;
    s = s.replace(/[R$\s]/gi, "");
    if (s.includes(",") && s.includes(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else if (s.includes(",")) {
      s = s.replace(",", ".");
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }
  function formatBrPctInput(v) {
    return Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function yesterdayISO() { return daysAgoISO(1); }
  function daysAgoISO(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }
  function monthStartISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  }
  function monthPreviousRangeISO() {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const start = `${y}-${String(m).padStart(2, "0")}-01`;
    const last = new Date(y, m, 0);
    const end = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
    return { start, end };
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
  async function readJsonResponse(res) {
    const text = await res.text();
    const trimmed = (text || "").trim();
    if (!trimmed) {
      throw new Error(`Resposta vazia do servidor (HTTP ${res.status}). Confirme que o app está em http://localhost:3790`);
    }
    if (trimmed[0] === "<" || trimmed.startsWith("<!")) {
      throw new Error(
        `O servidor devolveu HTML em vez de JSON (HTTP ${res.status}). Abra http://localhost:3790 e use npm start — hosting estático/Vercel sem Node não serve /api.`,
      );
    }
    try {
      return JSON.parse(trimmed);
    } catch {
      throw new Error(`Resposta inválida do servidor (HTTP ${res.status}): ${trimmed.slice(0, 120)}`);
    }
  }

  async function api(path, opts = {}) {
    const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(path, { ...opts, headers });
    let json = {};
    try {
      json = await readJsonResponse(res);
    } catch (err) {
      if (res.status === 401) {
        clearSession();
        showAuth();
      }
      throw err;
    }
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
    let view = navKey === "integracoes" ? "config" : navKey;
    if (view === "subids") view = "dashboard";

    if (CHANNEL_VIEWS[navKey] != null) {
      state.channel = CHANNEL_VIEWS[navKey];
      view = "dashboard";
      state.navKey = navKey;
    } else if (view === "dashboard") {
      state.channel = "geral";
      state.navKey = "dashboard";
    } else {
      state.navKey = navKey;
    }

    state.view = view;

    $$(".nav-item").forEach((b) => {
      const key = b.dataset.view;
      if (view === "dashboard") {
        b.classList.toggle("active", key === (state.navKey || "dashboard"));
      } else if (view === "config") {
        b.classList.toggle("active", key === "config" || key === "integracoes");
      } else {
        b.classList.toggle("active", key === navKey);
      }
    });

    const isData = DATA_VIEWS.has(view);
    $("#view-dashboard").classList.toggle("hidden", view !== "dashboard");
    $("#view-analise-ia")?.classList.toggle("hidden", view !== "analise-ia");
    $("#view-canais")?.classList.toggle("hidden", view !== "canais");
    $("#view-config").classList.toggle("hidden", view !== "config");
    $("#view-data").classList.toggle("hidden", !isData);
    const label = VIEW_LABELS[state.navKey] || VIEW_LABELS[navKey] || VIEW_LABELS[view] || view;
    $("#crumb-label").textContent = label;
    setSidebarOpen(false);

    if (view === "dashboard") applyChannelView();
    if (view === "analise-ia") renderSuggestions(state.dash);
    if (view === "canais") renderOpsTable();
    if (view === "config") renderIndefinidos();
    if (isData) loadDataView(view);
  }

  function syncDashHeading() {
    const ch = state.channel || "geral";
    const titleEl = $("#dash-title");
    const subEl = $("#page-sub");
    const map = {
      geral: {
        title: "Dashboard",
        nav: "dashboard",
        sub: "Dados gerais, faturamento, lucro diário e resumo.",
      },
      meta: {
        title: "Campanhas Meta",
        nav: "campanhas-meta",
        sub: "Análise da Meta · SubIDs com gasto identificado na Meta.",
      },
      pinterest: {
        title: "Campanhas Pinterest",
        nav: "campanhas-pinterest",
        sub: "Análise do Pinterest · SubIDs com gasto identificado no Pin.",
      },
      organico: {
        title: "Campanhas orgânicas",
        nav: "campanhas-organicas",
        sub: "Análise orgânica · SubIDs classificados como orgânico.",
      },
    };
    const info = map[ch] || map.geral;
    if (titleEl) titleEl.textContent = info.title;
    if (subEl) subEl.textContent = info.sub;
    const crumbView = $("#dash-crumb-view");
    if (crumbView) crumbView.textContent = info.title;
    const crumbChannel = $("#dash-crumb-channel");
    if (crumbChannel) crumbChannel.textContent = (CHANNEL_LABELS[ch] || "Geral").toUpperCase();
    if (state.view === "dashboard") {
      state.navKey = info.nav;
      $$(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === info.nav));
      $("#crumb-label").textContent = VIEW_LABELS[info.nav] || info.title;
    }
  }

  /**
   * Composição executiva: herói de Lucro (ROI, abatimento e SubIDs no pé)
   * seguido da linha secundária — receita Shopee e investimento por canal.
   */
  function renderKpis(k, subCount) {
    const hasData = Boolean(state.dash);
    const invMeta = hasData ? Number(k.inv_meta || 0) : null;
    const invPin = hasData ? Number(k.inv_pin || 0) : null;
    const invTotal = hasData ? Number(k.inv_total || 0) : null;
    const lucro = !hasData ? null : (k.lucro != null ? Number(k.lucro) : Number(k.comissao || 0) - Number(invTotal || 0));
    const roi = hasData ? k.roi : null;
    const hasRoi = hasData && invTotal > 0 && Number.isFinite(Number(roi));
    const subs = hasData && subCount != null ? fmtNum(subCount) : "—";
    const fat = hasData ? Number(k.faturamento || 0) : null;
    const com = hasData ? Number(k.comissao || 0) : null;
    const abat = hasData ? k.abatimento : null;
    const el = $("#kpi-grid");
    if (!el) return;

    const money = (v) => (v == null || Number.isNaN(Number(v)) ? "—" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

    el.innerHTML = `
      <div class="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-700 text-white rounded-2xl p-5 shadow-lg shadow-emerald-500/10">
        <div class="absolute -right-6 -bottom-6 w-28 h-28 bg-white/10 rounded-full blur-2xl"></div>
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs font-bold uppercase tracking-wider text-emerald-100 flex items-center gap-1.5">
            <img src="/assets/lucro.png" alt="" width="18" height="18" class="rounded-sm drop-shadow" /> Lucro Líquido
          </span>
        </div>
        <div class="mb-4">
          <div class="text-3xl sm:text-4xl font-black tracking-tight text-white flex items-baseline gap-1">
            <span class="text-lg font-bold text-emerald-200">R$</span>
            <span>${money(lucro)}</span>
          </div>
          <p class="text-[11px] text-emerald-100/90 mt-1 font-medium">Lucro real após mídia e impostos</p>
        </div>
        <div class="grid grid-cols-3 gap-2 pt-3 border-t border-white/20 text-center">
          <div class="bg-black/10 p-1.5 rounded-xl">
            <p class="text-[10px] text-emerald-100">ROI</p>
            <p class="text-xs font-extrabold text-white">${fmtPct(hasRoi ? roi : null)}</p>
          </div>
          <div class="bg-black/10 p-1.5 rounded-xl">
            <p class="text-[10px] text-emerald-100">Abatimento</p>
            <p class="text-xs font-extrabold text-amber-200">${fmtPct(abat)}</p>
          </div>
          <div class="bg-black/10 p-1.5 rounded-xl">
            <p class="text-[10px] text-emerald-100">SubIDs</p>
            <p class="text-xs font-extrabold text-white">${subs}</p>
          </div>
        </div>
      </div>

      <div class="relative overflow-hidden bg-gradient-to-br from-orange-500 via-orange-600 to-red-600 text-white rounded-2xl p-5 shadow-lg shadow-orange-500/10">
        <div class="absolute -right-6 -bottom-6 w-28 h-28 bg-white/10 rounded-full blur-2xl"></div>
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs font-bold uppercase tracking-wider text-orange-100 flex items-center gap-1.5">
            <img src="/assets/shopee.png" alt="" width="16" height="16" /> Faturamento Bruto
          </span>
          <span class="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-md font-bold">Shopee API</span>
        </div>
        <div class="mb-4">
          <div class="text-3xl sm:text-4xl font-black tracking-tight text-white flex items-baseline gap-1">
            <span class="text-lg font-bold text-orange-200">R$</span>
            <span>${money(fat)}</span>
          </div>
          <p class="text-[11px] text-orange-100/90 mt-1 font-medium">Volume total vendido gerado por SubIDs</p>
        </div>
        <div class="bg-black/10 p-2.5 rounded-xl flex items-center justify-between mt-auto">
          <span class="text-xs text-orange-100">Comissão Shopee Total:</span>
          <span class="text-xs font-black text-white">${fmt(com)}</span>
        </div>
      </div>

      <div class="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 text-white rounded-2xl p-5 shadow-lg shadow-blue-500/10">
        <div class="absolute -right-6 -bottom-6 w-28 h-28 bg-white/10 rounded-full blur-2xl"></div>
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs font-bold uppercase tracking-wider text-blue-100 flex items-center gap-1.5">
            <img src="/assets/meta.png" alt="" width="16" height="16" /> Invest. Meta Ads
          </span>
          <span class="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-md font-bold">Meta Ads</span>
        </div>
        <div class="mb-4">
          <div class="text-3xl sm:text-4xl font-black tracking-tight text-white flex items-baseline gap-1">
            <span class="text-lg font-bold text-blue-200">R$</span>
            <span>${money(invMeta)}</span>
          </div>
          <p class="text-[11px] text-blue-100/90 mt-1 font-medium">${hasData ? (invMeta > 0 ? "Sincronizado via API" : "Sem sync Meta neste período") : "—"}</p>
        </div>
        <div class="bg-black/10 p-2.5 rounded-xl flex items-center justify-between mt-auto">
          <span class="text-xs text-blue-100">Taxado no ROI:</span>
          <span class="text-xs font-black text-white">${hasData && invMeta > 0 ? "Sim" : "—"}</span>
        </div>
      </div>

      <div class="relative overflow-hidden bg-gradient-to-br from-rose-500 via-rose-600 to-red-600 text-white rounded-2xl p-5 shadow-lg shadow-rose-500/10">
        <div class="absolute -right-6 -bottom-6 w-28 h-28 bg-white/10 rounded-full blur-2xl"></div>
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs font-bold uppercase tracking-wider text-rose-100 flex items-center gap-1.5">
            <img src="/assets/pinterest.png" alt="" width="16" height="16" /> Invest. Pinterest
          </span>
          <span class="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-md font-bold">CSV</span>
        </div>
        <div class="mb-4">
          <div class="text-3xl sm:text-4xl font-black tracking-tight text-white flex items-baseline gap-1">
            <span class="text-lg font-bold text-rose-200">R$</span>
            <span>${money(invPin)}</span>
          </div>
          <p class="text-[11px] text-rose-100/90 mt-1 font-medium">${hasData ? (invPin > 0 ? `total c/ imposto · ${fmt(invTotal)}` : "Nenhum gasto neste período") : "—"}</p>
        </div>
        <div class="bg-black/10 p-2.5 rounded-xl flex items-center justify-between mt-auto">
          <span class="text-xs text-rose-100">Status:</span>
          <span class="text-xs font-black text-white">${hasData && invPin > 0 ? "Ativo" : "Inativo"}</span>
        </div>
      </div>`;
  }

  function channelMetricCard(label, value, tone, iconClass) {
    const toneClass = tone ? `channel-metric--${tone}` : "";
    return `<article class="channel-metric ${toneClass}">
      <div class="channel-metric-icon"><i class="${iconClass}" aria-hidden="true"></i></div>
      <div class="channel-metric-body">
        <p class="channel-metric-lab">${escapeHtml(label)}</p>
        <p class="channel-metric-val">${value}</p>
      </div>
    </article>`;
  }

  function renderChannelKpis(ch, k) {
    const el = $("#channel-kpi-grid");
    if (!el) return;
    const hasData = Boolean(state.dash);
    const money = (v) => (!hasData || v == null || Number.isNaN(Number(v)) ? "—" : fmt(v));
    const num = (v) => (!hasData || v == null ? "—" : fmtNum(v));
    const pct = (v) => (!hasData ? "—" : fmtPct(v));
    const lucroNeg = Number(k?.lucro) < 0;
    const roiNeg = Number(k?.roi) < 0;
    const invMeta = k?.inv_meta_taxed != null ? k.inv_meta_taxed : k?.inv_meta;
    const hasRoi = hasData && Number(k?.inv_total) > 0 && Number.isFinite(Number(k?.roi));
    const lucroTone = lucroNeg ? "rose" : "emerald";
    const roiTone = roiNeg ? "rose" : "emerald";

    let cards = [];
    if (ch === "meta") {
      cards = [
        ["Faturamento", money(k?.faturamento), "orange", "fa-solid fa-receipt"],
        ["Comissão", money(k?.comissao), "emerald", "fa-solid fa-coins"],
        ["Investimento Meta", money(invMeta), "meta", "fa-solid fa-bullhorn"],
        ["Lucro", money(k?.lucro), lucroTone, "fa-solid fa-sack-dollar"],
        ["ROI", pct(hasRoi ? k?.roi : null), roiTone, "fa-solid fa-chart-line"],
        ["Pedidos", num(k?.pedidos), "indigo", "fa-solid fa-bag-shopping"],
        ["Cliques Shopee", num(k?.cliques_shopee), "sky", "fa-solid fa-computer-mouse"],
        ["Abatimento", pct(k?.abatimento_cliques), "amber", "fa-solid fa-percent"],
      ];
    } else if (ch === "pinterest") {
      cards = [
        ["Faturamento", money(k?.faturamento), "orange", "fa-solid fa-receipt"],
        ["Comissão", money(k?.comissao), "emerald", "fa-solid fa-coins"],
        ["Investimento Pinterest", money(k?.inv_pin), "pin", "fa-brands fa-pinterest-p"],
        ["Lucro", money(k?.lucro), lucroTone, "fa-solid fa-sack-dollar"],
        ["ROI", pct(hasRoi ? k?.roi : null), roiTone, "fa-solid fa-chart-line"],
        ["Pedidos", num(k?.pedidos), "indigo", "fa-solid fa-bag-shopping"],
        ["Cliques Shopee", num(k?.cliques_shopee), "sky", "fa-solid fa-computer-mouse"],
        ["Abatimento", pct(k?.abatimento_cliques), "amber", "fa-solid fa-percent"],
      ];
    } else if (ch === "organico") {
      cards = [
        ["Faturamento", money(k?.faturamento), "orange", "fa-solid fa-receipt"],
        ["Comissão", money(k?.comissao), "emerald", "fa-solid fa-coins"],
        ["Lucro", money(k?.lucro), lucroTone, "fa-solid fa-sack-dollar"],
        ["Pedidos", num(k?.pedidos), "indigo", "fa-solid fa-bag-shopping"],
        ["Cliques Shopee", num(k?.cliques_shopee), "sky", "fa-solid fa-computer-mouse"],
      ];
    }

    el.innerHTML = `<div class="channel-kpi-metrics channel-kpi-metrics--${cards.length}">${cards.map(([lab, val, tone, icon]) => channelMetricCard(lab, val, tone, icon)).join("")}</div>`;
  }

  function chartGridColor() {
    return "rgba(30, 41, 59, 0.65)";
  }

  function chartTickColor() {
    return "#94a3b8";
  }

  function valuesForChartMode(rows, mode) {
    return (rows || []).map((d) => {
      if (mode === "revenue") return Number(d.faturamento || 0);
      return Number(d.lucro != null ? d.lucro : Number(d.comissao || 0) - Number(d.inv_total || 0));
    });
  }

  function paintChartToggle(mode) {
    const profit = $("#btn-chart-profit");
    const revenue = $("#btn-chart-revenue");
    const on = "period-preset chip-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-brand-600 text-white shadow-sm";
    const off = "period-preset chip-btn px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900";
    if (profit) profit.className = mode === "profit" ? on : off;
    if (revenue) revenue.className = mode === "revenue" ? on : off;
  }

  function destroyProfitChart() {
    if (state.chartInstance) {
      try { state.chartInstance.destroy(); } catch (_) { /* ignore */ }
      state.chartInstance = null;
    }
  }

  function renderChart(daily) {
    const host = $("#daily-chart");
    if (!host) return;
    const rows = Array.isArray(daily) ? daily : [];
    state.chartDaily = rows;
    paintChartToggle(state.chartMode || "profit");

    if (!rows.length) {
      destroyProfitChart();
      host.innerHTML = `<div class="chart-empty">Sem dados no período. Sincronize a Shopee para preencher a curva.</div>`;
      const peak = $("#dash-chart-peak");
      if (peak) peak.textContent = "—";
      const sub = $("#dash-chart-sub");
      if (sub && !sub.dataset.locked) sub.textContent = "sem dados no período";
      return;
    }

    if (!host.querySelector("#profit-chart-canvas")) {
      host.innerHTML = `<canvas id="profit-chart-canvas"></canvas>`;
    }
    const canvas = $("#profit-chart-canvas");
    if (!canvas || typeof Chart === "undefined") {
      host.innerHTML = `<div class="chart-empty">Chart.js não carregou. Recarregue a página.</div>`;
      return;
    }

    const mode = state.chartMode === "revenue" ? "revenue" : "profit";
    const vals = valuesForChartMode(rows, mode);
    const labels = rows.map((d) => chartDay(d.data).toUpperCase());
    const avg = vals.reduce((a, v) => a + v, 0) / vals.length;
    let peakIdx = 0;
    vals.forEach((v, i) => { if (v > vals[peakIdx]) peakIdx = i; });
    const peakEl = $("#dash-chart-peak");
    if (peakEl) {
      peakEl.textContent = mode === "revenue"
        ? `Pico fat.: ${fmt(vals[peakIdx])} (${labels[peakIdx]})`
        : `Pico: ${fmt(vals[peakIdx])} (${labels[peakIdx]})`;
    }
    const sub = $("#dash-chart-sub");
    if (sub) {
      sub.textContent = mode === "revenue"
        ? `valores em R$ · média ${fmt(avg)}/dia de faturamento`
        : `valores em R$ · média ${fmt(avg)}/dia`;
    }

    const ctx = canvas.getContext("2d");
    const h = canvas.parentElement?.clientHeight || 260;
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    if (mode === "revenue") {
      gradient.addColorStop(0, "rgba(249, 115, 22, 0.85)");
      gradient.addColorStop(1, "rgba(249, 115, 22, 0.18)");
    } else {
      gradient.addColorStop(0, "rgba(16, 185, 129, 0.9)");
      gradient.addColorStop(1, "rgba(16, 185, 129, 0.18)");
    }

    const bg = mode === "revenue"
      ? gradient
      : vals.map((v) => (v >= 0 ? "rgba(16, 185, 129, 0.8)" : "rgba(245, 158, 11, 0.78)"));
    const border = mode === "revenue"
      ? "#f97316"
      : vals.map((v) => (v >= 0 ? "#10b981" : "#f59e0b"));

    const dataset = {
      label: mode === "revenue" ? "Faturamento Bruto (R$)" : "Lucro Líquido (R$)",
      data: vals,
      backgroundColor: bg,
      borderColor: border,
      borderWidth: 1.5,
      borderRadius: 8,
      borderSkipped: false,
      maxBarThickness: 42,
    };

    const tooltipBody = mode === "revenue" ? "#fb923c" : "#34d399";

    if (state.chartInstance) {
      state.chartInstance.data.labels = labels;
      state.chartInstance.data.datasets[0] = dataset;
      state.chartInstance.options.plugins.tooltip.bodyColor = tooltipBody;
      state.chartInstance.options.scales.y.grid.color = chartGridColor();
      state.chartInstance.options.scales.x.ticks.color = chartTickColor();
      state.chartInstance.options.scales.y.ticks.color = chartTickColor();
      state.chartInstance.update();
      return;
    }

    state.chartInstance = new Chart(ctx, {
      type: "bar",
      data: { labels, datasets: [dataset] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 450 },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#0f172a",
            titleColor: "#f8fafc",
            bodyColor: tooltipBody,
            borderColor: "#334155",
            borderWidth: 1,
            padding: 10,
            displayColors: false,
            callbacks: {
              label(context) {
                const prefix = mode === "revenue" ? "Faturamento" : "Lucro";
                return `${prefix}: ${fmt(context.parsed.y)}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: chartTickColor(),
              font: { size: 11, family: "Inter", weight: "600" },
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 10,
            },
          },
          y: {
            beginAtZero: true,
            grid: { color: chartGridColor() },
            ticks: {
              color: chartTickColor(),
              font: { size: 11, family: "Inter" },
              callback(val) {
                return "R$ " + Number(val).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
              },
            },
          },
        },
      },
    });
  }

  function setChartMode(mode) {
    state.chartMode = mode === "revenue" ? "revenue" : "profit";
    destroyProfitChart();
    renderChart(state.chartDaily.length ? state.chartDaily : (state.dash?.daily || []));
  }

  function renderSuggestions(dash) {
    const el = $("#suggestions-body");
    const countEl = $("#suggestions-count");
    if (!el) return;
    const subs = (dash?.subIds || []).filter((s) => (s.canal || "indefinido") === "meta");
    const tips = [];
    for (const s of subs) {
      const days = [...(s.daily || [])].sort((a, b) => String(a.data).localeCompare(String(b.data)));
      const last15 = days.slice(-15);
      const inv15 = last15.reduce((a, d) => a + Number(d.inv_meta || 0), 0);
      const lucro15 = last15.reduce((a, d) => a + Number(d.lucro || 0), 0);
      const roi15 = inv15 > 0 ? (lucro15 / inv15) * 100 : Number(s.roi);
      const inv = Number(s.inv_meta || s.inv_total || 0);
      const lucro = Number(s.lucro || 0);
      const st = normalizeStatus(s.status);
      const roi = Number.isFinite(roi15) ? roi15 : Number(s.roi);
      const vendas = Number(s.pedidos || 0);

      if (st === "ativa" && Number.isFinite(roi) && roi < 40 && inv > 0) {
        tips.push({
          subid: s.subid,
          tag: "PAUSAR",
          tagKind: "pausar",
          reason: `ROI 15d ${fmtPct(roi)} · invest ${fmtMoney(inv)} · ${fmtNum(vendas)} vendas · sem escala`,
          action: "Pausar campanha",
          actionKind: "pausar",
        });
      } else if (st === "ativa" && Number.isFinite(roi) && roi >= 40 && inv > 0) {
        const recent = last15.filter((d) => Number(d.inv_meta || 0) > 0).slice(-4);
        if (recent.length >= 4 && recent.every((d) => Number(d.roi || 0) >= 0)) {
          tips.push({
            subid: s.subid,
            tag: "ESCALAR",
            tagKind: "escalar",
            reason: `ROI 15d ${fmtPct(roi)} · consistente · aumentar budget +20%`,
            action: "Escalar +20%",
            actionKind: "escalar",
          });
        }
      } else if (st === "teste" && Number.isFinite(roi) && roi <= -70) {
        tips.push({
          subid: s.subid,
          tag: "TESTAR",
          tagKind: "testar",
          reason: `Teste com ROI ${fmtPct(roi)} · reduzir budget −70%`,
          action: "Reduzir −70%",
          actionKind: "reduzir",
        });
      } else if (st === "teste" && lucro > 0 && Number.isFinite(roi) && roi > 0) {
        tips.push({
          subid: s.subid,
          tag: "ESCALAR",
          tagKind: "escalar",
          reason: "Teste com ROI positivo · promover para Ativa",
          action: "Escalar +20%",
          actionKind: "escalar",
        });
      }
    }
    const shown = tips.slice(0, 4);
    if (countEl) {
      countEl.textContent = shown.length
        ? `${shown.length} ${shown.length > 1 ? "ações" : "ação"}`
        : "—";
    }
    const navIa = $("#nav-count-ia");
    if (navIa) navIa.textContent = shown.length ? fmtNum(shown.length) : "";
    if (!shown.length) {
      el.innerHTML = `<div class="sec-empty">Nenhum sinal de corte ou escala no período — Meta está estável.</div>`;
      return;
    }
    el.innerHTML = shown.map((t) => `
      <div class="sug-row">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 mb-1">
            <span class="sug-subid">${escapeHtml(t.subid)}</span>
            <span class="sug-tag is-${t.tagKind}">${escapeHtml(t.tag)}</span>
          </div>
          <p class="sug-reason">${escapeHtml(t.reason)}</p>
        </div>
        <button type="button" class="sug-action-btn is-${t.actionKind}">
          <i class="fa-solid fa-${t.actionKind === "pausar" ? "pause" : "bolt"}"></i>
          ${escapeHtml(t.action.replace("Pausar campanha", "Pausar"))}
        </button>
      </div>`).join("");
  }

  function parseSortable(v) {
    if (v == null || v === "") return { kind: "empty", n: 0, s: "" };
    if (typeof v === "number" && Number.isFinite(v)) return { kind: "num", n: v, s: String(v) };
    if (typeof v === "boolean") return { kind: "num", n: v ? 1 : 0, s: String(v) };
    const s = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return { kind: "num", n: Date.parse(s.slice(0, 10)) || 0, s };
    const compact = s
      .replace(/R\$\s?/gi, "")
      .replace(/%/g, "")
      .replace(/\s/g, "")
      .replace(/\.(?=\d{3}(?:\D|$))/g, "")
      .replace(",", ".");
    if (/^-?\d+(\.\d+)?$/.test(compact)) return { kind: "num", n: Number(compact), s };
    return { kind: "str", n: 0, s: s.toLowerCase() };
  }

  function compareSortValues(a, b, dir) {
    const mul = dir === "desc" ? -1 : 1;
    const A = parseSortable(a);
    const B = parseSortable(b);
    if (A.kind === "empty" && B.kind !== "empty") return 1;
    if (B.kind === "empty" && A.kind !== "empty") return -1;
    if (A.kind === "num" && B.kind === "num") {
      if (A.n === B.n) return 0;
      return A.n > B.n ? mul : -mul;
    }
    return A.s.localeCompare(B.s, "pt-BR", { sensitivity: "base", numeric: true }) * mul;
  }

  function sortRows(rows, key, dir, getter) {
    if (!key || !rows?.length) return rows || [];
    const get = getter || ((r) => r[key]);
    return [...rows].sort((a, b) => compareSortValues(get(a), get(b), dir || "asc"));
  }

  function toggleSortState(sortState, key) {
    if (sortState.key === key) sortState.dir = sortState.dir === "asc" ? "desc" : "asc";
    else {
      sortState.key = key;
      sortState.dir = "asc";
    }
  }

  function paintSortHeaders(root, sortState) {
    const el = typeof root === "string" ? $(root) : root;
    if (!el) return;
    el.querySelectorAll("th[data-sort]").forEach((th) => {
      const active = sortState.key === th.dataset.sort;
      th.classList.add("th-sort");
      th.classList.toggle("asc", active && sortState.dir === "asc");
      th.classList.toggle("desc", active && sortState.dir === "desc");
      th.title = active
        ? (sortState.dir === "asc" ? "Ordenado crescente · clique para decrescente" : "Ordenado decrescente · clique para crescente")
        : "Clique para ordenar";
      th.setAttribute("aria-sort", active ? (sortState.dir === "asc" ? "ascending" : "descending") : "none");
    });
  }

  function wireSortHeaders(rootSel, getSortState, onChange) {
    const root = $(rootSel);
    if (!root || root.dataset.sortWired === "1") return;
    root.dataset.sortWired = "1";
    root.addEventListener("click", (e) => {
      const th = e.target.closest("th[data-sort]");
      if (!th || !root.contains(th)) return;
      e.preventDefault();
      toggleSortState(getSortState(), th.dataset.sort);
      onChange();
    });
  }

  function renderDailyTable(daily, k) {
    state.dailyRows = Array.isArray(daily) ? daily : [];
    const sorted = sortRows(state.dailyRows, state.dailySort.key, state.dailySort.dir, (d) => {
      if (state.dailySort.key === "abatimento") {
        const fat = Number(d.faturamento || 0);
        const com = Number(d.comissao || 0);
        return fat > 0 ? (com / fat) * 100 : 0;
      }
      if (state.dailySort.key === "lucro") {
        return d.lucro != null ? d.lucro : Number(d.comissao || 0) - Number(d.inv_total || 0);
      }
      return d[state.dailySort.key];
    });
    paintSortHeaders("#daily-table thead", state.dailySort);
    $("#daily-tbody").innerHTML = sorted.map((d) => {
      const fat = Number(d.faturamento || 0);
      const com = Number(d.comissao || 0);
      const abat = fat > 0 ? (com / fat) * 100 : 0;
      const lucro = d.lucro != null ? d.lucro : com - Number(d.inv_total || 0);
      return `<tr>
        <td class="font-medium subid">${shortDay(d.data)}</td>
        <td class="num cell-emerald">${fmt(fat)}</td>
        <td class="num cell-emerald">${fmt(com)}</td>
        <td class="num cell-gasto">${fmt(d.inv_meta)}</td>
        <td class="num cell-gasto">${fmt(d.inv_pin)}</td>
        <td class="num cell-gasto">${fmt(d.inv_total)}</td>
        <td class="num ${lucroCellClass(lucro)}">${fmt(lucro)}</td>
        <td class="num ${roiTierClass(d.roi)}">${fmtPct(d.roi)}</td>
        <td class="num muted">${fmtPct(abat)}</td>
      </tr>`;
    }).join("") || `<tr><td colspan="9">Sem dias no período.</td></tr>`;

    if (state.dailyRows.length) {
      $("#daily-tfoot").innerHTML = `<tr>
        <td class="subid uppercase tracking-wider">TOTAL</td>
        <td class="num cell-emerald">${fmt(k.faturamento)}</td>
        <td class="num cell-emerald">${fmt(k.comissao)}</td>
        <td class="num cell-gasto">${fmt(k.inv_meta)}</td>
        <td class="num cell-gasto">${fmt(k.inv_pin)}</td>
        <td class="num cell-gasto">${fmt(k.inv_total)}</td>
        <td class="num ${lucroCellClass(k.lucro)}">${fmt(k.lucro)}</td>
        <td class="num ${roiTierClass(k.roi)}">${fmtPct(k.roi)}</td>
        <td class="num muted">${fmtPct(k.abatimento)}</td>
      </tr>`;
    } else $("#daily-tfoot").innerHTML = "";
  }

  function canalLabel(c) {
    if (c === "meta") return "Meta";
    if (c === "pinterest") return "Pinterest";
    if (c === "organico") return "Orgânico";
    if (c === "indefinido") return "Indefinido";
    return c || "—";
  }

  function normalizeStatus(s) {
    if (s === "pausada") return "desativada";
    if (s === "teste" || s === "desativada") return s;
    return "ativa";
  }

  function statusLabel(s) {
    const st = normalizeStatus(s);
    if (st === "teste") return "Teste";
    if (st === "desativada") return "Desativada";
    return "Ativa";
  }

  function statusPillHtml(status) {
    const st = normalizeStatus(status);
    return `<span class="status-pill st-${st}"><i></i>${statusLabel(st)}</span>`;
  }

  function statusSelectHtml(subid, status) {
    const st = normalizeStatus(status);
    return `<select class="op-select" data-op="status" data-subid="${escapeHtml(String(subid))}">
      <option value="ativa" ${st === "ativa" ? "selected" : ""}>Ativa</option>
      <option value="teste" ${st === "teste" ? "selected" : ""}>Teste</option>
      <option value="desativada" ${st === "desativada" ? "selected" : ""}>Desativada</option>
    </select>`;
  }

  function canalSelectHtml(subid, canal) {
    const c = canal || "indefinido";
    return `<select class="op-select" data-op="canal" data-subid="${escapeHtml(String(subid))}">
      <option value="indefinido" ${c === "indefinido" ? "selected" : ""}>Indefinido</option>
      <option value="meta" ${c === "meta" ? "selected" : ""}>Meta</option>
      <option value="pinterest" ${c === "pinterest" ? "selected" : ""}>Pinterest</option>
      <option value="organico" ${c === "organico" ? "selected" : ""}>Orgânico</option>
    </select>`;
  }

  function canalChipHtml(canal) {
    const c = canal || "indefinido";
    return `<span class="canal-chip ch-${c}">${CHANNEL_ICONS[c] || ""}${canalLabel(c)}</span>`;
  }

  function adsClicksFor(r, channel) {
    if (channel === "meta") return Number(r.cliques_meta || 0);
    if (channel === "pinterest") return Number(r.cliques_pin || 0);
    return Number(r.cliques_ads != null ? r.cliques_ads : (Number(r.cliques_meta || 0) + Number(r.cliques_pin || 0)));
  }

  function clickAbatPct(r, channel) {
    if (r.abatimento_cliques != null && Number.isFinite(Number(r.abatimento_cliques))) {
      return Number(r.abatimento_cliques);
    }
    const shopee = r.cliques_shopee != null ? Number(r.cliques_shopee) : null;
    const ads = adsClicksFor(r, channel);
    if (shopee == null || !(ads > 0)) return null;
    return Math.round((shopee / ads) * 10000) / 100;
  }

  function filteredSubIds(list, q, channel) {
    const query = (q || "").trim().toLowerCase();
    const ch = channel != null ? channel : state.channel;
    return (list || []).filter((r) => {
      if (query && !String(r.subid).toLowerCase().includes(query)) return false;
      if (!ch || ch === "geral") return true;
      return (r.canal || "indefinido") === ch;
    });
  }

  function kpisFromSubIds(subs, baseKpis) {
    const list = subs || [];
    const fat = list.reduce((a, r) => a + Number(r.faturamento || 0), 0);
    const com = list.reduce((a, r) => a + Number(r.comissao || 0), 0);
    const invMeta = list.reduce((a, r) => a + Number(r.inv_meta || 0), 0);
    const invPin = list.reduce((a, r) => a + Number(r.inv_pin || 0), 0);
    const pedidos = list.reduce((a, r) => a + Number(r.pedidos || 0), 0);
    const concluidos = list.reduce((a, r) => a + Number(r.concluidos || 0), 0);
    const pendentes = list.reduce((a, r) => a + Number(r.pendentes || 0), 0);
    const cancelados = list.reduce((a, r) => a + Number(r.cancelados || 0), 0);
    const cliquesMeta = list.reduce((a, r) => a + Number(r.cliques_meta || 0), 0);
    const cliquesPin = list.reduce((a, r) => a + Number(r.cliques_pin || 0), 0);
    const cliquesAds = list.reduce((a, r) => a + adsClicksFor(r, state.channel), 0);
    const impressoes = list.reduce((a, r) => a + Number(r.impressoes || 0), 0);
    const alcance = list.reduce((a, r) => a + Number(r.alcance || 0), 0);
    const cliquesShopeeRaw = list.reduce((a, r) => {
      if (r.cliques_shopee == null) return a;
      return (a == null ? 0 : a) + Number(r.cliques_shopee);
    }, null);
    const spendMeta = list.reduce((a, r) => a + Number(r.inv_meta || 0), 0);
    const cpc_meta = cliquesMeta > 0 ? Math.round((spendMeta / cliquesMeta) * 100) / 100 : null;
    const ctr_meta = impressoes > 0 ? Math.round((cliquesMeta / impressoes) * 10000) / 100 : null;
    const tax = {
      taxRate: state.settings.taxRate,
      metaTaxRate: state.settings.metaTaxRate,
    };
    const gov = Number(tax.taxRate || 0) / 100;
    const metaTax = Number(tax.metaTaxRate != null ? tax.metaTaxRate : 12) / 100;
    const invMetaTaxed = invMeta * (1 + metaTax);
    const invForRoi = invMetaTaxed + invPin;
    const comissaoLiq = com * (1 - gov);
    const lucro = Math.round((comissaoLiq - invForRoi) * 100) / 100;
    const roi = invForRoi > 0 ? Math.round((lucro / invForRoi) * 10000) / 100 : null;
    let abatimentoCliques = null;
    if (cliquesShopeeRaw != null && cliquesAds > 0) {
      abatimentoCliques = Math.round((cliquesShopeeRaw / cliquesAds) * 10000) / 100;
    }
    return {
      ...(baseKpis || {}),
      faturamento: Math.round(fat * 100) / 100,
      comissao: Math.round(com * 100) / 100,
      inv_meta: Math.round(invMeta * 100) / 100,
      inv_pin: Math.round(invPin * 100) / 100,
      inv_meta_taxed: Math.round(invMetaTaxed * 100) / 100,
      inv_total: Math.round(invForRoi * 100) / 100,
      lucro,
      roi,
      pedidos,
      concluidos,
      pendentes,
      cancelados,
      cliques_meta: cliquesMeta,
      cliques_pin: cliquesPin,
      cliques_ads: cliquesAds,
      cliques_shopee: cliquesShopeeRaw,
      impressoes,
      alcance,
      cpc_meta,
      ctr_meta,
      abatimento_cliques: abatimentoCliques,
      abatimento: fat > 0 ? Math.round((com / fat) * 10000) / 100 : null,
    };
  }

  async function saveSubidOp(subid, partial) {
    await api("/api/subid-ops", {
      method: "POST",
      body: JSON.stringify({ subid, ...partial }),
    });
    const list = state.dash?.subIds || [];
    const key = String(subid).toLowerCase();
    for (const r of list) {
      if (String(r.subid || "").toLowerCase() === key) {
        if (partial.canal != null) r.canal = partial.canal;
        if (partial.status != null) r.status = partial.status;
        if (partial.produto != null) r.produto = partial.produto;
      }
    }
    applyChannelView();
    renderOpsTable();
    renderIndefinidos();
    if (state.view === "analise-ia") renderSuggestions(state.dash);
  }

  function wireOpsSelects(root) {
    const el = typeof root === "string" ? $(root) : root;
    if (!el || el.dataset.opsWired) return;
    el.dataset.opsWired = "1";
    el.addEventListener("change", async (e) => {
      const sel = e.target.closest("select[data-op]");
      if (!sel) return;
      e.stopPropagation();
      const subid = sel.dataset.subid;
      const field = sel.dataset.op;
      try {
        await saveSubidOp(subid, { [field]: sel.value });
      } catch (err) {
        alert(err.message || String(err));
      }
    });
    el.addEventListener("focusin", (e) => {
      const input = e.target.closest("input[data-op]");
      if (input) e.stopPropagation();
    });
    el.addEventListener("blur", async (e) => {
      const input = e.target.closest("input[data-op]");
      if (!input) return;
      e.stopPropagation();
      const subid = input.dataset.subid;
      const field = input.dataset.op;
      try {
        await saveSubidOp(subid, { [field]: input.value.trim() });
      } catch (err) {
        alert(err.message || String(err));
      }
    }, true);
    el.addEventListener("keydown", (e) => {
      const input = e.target.closest("input[data-op]");
      if (input && e.key === "Enter") {
        e.preventDefault();
        input.blur();
      }
    });
    el.addEventListener("click", (e) => {
      if (e.target.closest("select[data-op], input[data-op]")) e.stopPropagation();
    });
  }

  /** Série diária do canal, somando o histórico dos SubIDs filtrados. */
  function dailyFromSubIds(subs) {
    const metaTax = Number(state.settings.metaTaxRate != null ? state.settings.metaTaxRate : 12) / 100;
    const gov = Number(state.settings.taxRate || 0) / 100;
    const byDay = new Map();
    for (const s of subs || []) {
      for (const d of s.daily || []) {
        const key = String(d.data || "");
        if (!key) continue;
        let row = byDay.get(key);
        if (!row) {
          row = { data: key, faturamento: 0, comissao: 0, pedidos: 0, inv_meta: 0, inv_pin: 0, inv_meta_taxed: 0 };
          byDay.set(key, row);
        }
        row.faturamento += Number(d.faturamento || 0);
        row.comissao += Number(d.comissao || 0);
        row.pedidos += Number(d.pedidos || 0);
        row.inv_meta += Number(d.inv_meta || 0);
        row.inv_pin += Number(d.inv_pin || 0);
        row.inv_meta_taxed += d.inv_meta_taxed != null
          ? Number(d.inv_meta_taxed)
          : Number(d.inv_meta || 0) * (1 + metaTax);
      }
    }
    return [...byDay.values()]
      .sort((a, b) => a.data.localeCompare(b.data))
      .map((r) => {
        const invTotal = r.inv_meta_taxed + r.inv_pin;
        const lucro = Math.round((r.comissao * (1 - gov) - invTotal) * 100) / 100;
        return {
          ...r,
          faturamento: Math.round(r.faturamento * 100) / 100,
          comissao: Math.round(r.comissao * 100) / 100,
          inv_meta: Math.round(r.inv_meta * 100) / 100,
          inv_pin: Math.round(r.inv_pin * 100) / 100,
          inv_total: Math.round(invTotal * 100) / 100,
          lucro,
          roi: invTotal > 0 ? Math.round((lucro / invTotal) * 10000) / 100 : null,
          abatimento: r.faturamento > 0 ? Math.round((r.comissao / r.faturamento) * 10000) / 100 : null,
        };
      });
  }

  function paintChannelChrome(ch, isChannel) {
    const root = $("#view-dashboard");
    if (root) {
      root.classList.toggle("is-channel", isChannel);
      ["geral", "meta", "pinterest", "organico"].forEach((c) => root.classList.remove(`ch-${c}`));
      root.classList.add(`ch-${ch}`);
    }
    $$(".dash-only").forEach((el) => el.classList.toggle("hidden", isChannel));
    $$(".channel-only").forEach((el) => el.classList.toggle("hidden", !isChannel));
    const label = CHANNEL_LABELS[ch] || "Geral";
    const eyebrow = $("#dash-subids-eyebrow");
    if (eyebrow) eyebrow.textContent = `canal ${label} · altere o status · clique para o histórico`;
    const subidsIcon = $("#dash-subids-icon");
    if (subidsIcon) {
      const iconSrc = ch === "meta"
        ? "/assets/meta.png"
        : ch === "pinterest"
          ? "/assets/pinterest.png"
          : "/assets/shopee.png";
      subidsIcon.src = iconSrc;
      subidsIcon.alt = label;
    }
    const chip = $("#dash-crumb-channel");
    if (chip) chip.textContent = label.toUpperCase();
    const chartSub = $("#dash-chart-sub");
    if (chartSub) chartSub.textContent = "todos os canais";
    const dailySub = $("#dash-daily-sub");
    if (dailySub) dailySub.textContent = "Fat · Com · Inv · Lucro · ROI · Abat.";
  }

  /** Contadores de SubIDs por canal no rail e na página de classificação. */
  function paintChannelCounts() {
    const list = state.dash?.subIds || [];
    const count = (c) => list.filter((r) => (r.canal || "indefinido") === c).length;
    const totals = {
      meta: count("meta"),
      pinterest: count("pinterest"),
      organico: count("organico"),
      indefinido: count("indefinido"),
      all: list.length,
    };
    const set = (sel, v) => {
      const el = $(sel);
      if (el) el.textContent = list.length ? fmtNum(v) : "";
    };
    set("#nav-subid-count", totals.all);
    set("#nav-count-meta", totals.meta);
    set("#nav-count-pin", totals.pinterest);
    set("#nav-count-org", totals.organico);
    const setHard = (sel, v) => {
      const el = $(sel);
      if (el) el.textContent = fmtNum(v);
    };
    setHard("#canais-count-meta", totals.meta);
    setHard("#canais-count-pin", totals.pinterest);
    setHard("#canais-count-org", totals.organico);
    setHard("#canais-count-indef", totals.indefinido);
    setHard("#indef-count-pill", totals.indefinido);
  }

  function allSubidColumnDefs(ch) {
    const base = [
      { key: "subid", label: "SubID", shortLabel: "SubID", num: false, locked: true },
      { key: "faturamento", label: "Faturamento", shortLabel: "Faturamento", num: true },
      { key: "comissao", label: "Comissão", shortLabel: "Comissão", num: true },
      { key: "inv_total", label: "Investimento", shortLabel: "Investimento", num: true },
      { key: "lucro", label: "Lucro", shortLabel: "Lucro", num: true },
      { key: "roi", label: "ROI", shortLabel: "ROI", num: true },
      { key: "pedidos", label: "Pedidos", shortLabel: "Ped.", num: true },
      { key: "concluidos", label: "Concluídos", shortLabel: "Concluídos", num: true },
      { key: "pendentes", label: "Pendentes", shortLabel: "Pendentes", num: true },
      { key: "cancelados", label: "Cancelados", shortLabel: "Cancelados", num: true },
      { key: "cliques_shopee", label: "Cliques Shopee", shortLabel: "Cliq Shopee", num: true },
    ];
    if (ch === "meta") {
      return [
        ...base,
        { key: "cliques_meta", label: "Cliques Meta", shortLabel: "Cliques Meta", num: true },
        { key: "impressoes", label: "Impressões", shortLabel: "Impressões", num: true },
        { key: "alcance", label: "Alcance", shortLabel: "Alcance", num: true },
        { key: "ctr_meta", label: "CTR Meta", shortLabel: "CTR Meta", num: true },
        { key: "cpc_meta", label: "CPC Meta", shortLabel: "CPC Meta", num: true },
        { key: "abatimento_cliques", label: "% Abat. cliques", shortLabel: "Abat. cliques", num: true },
        { key: "abatimento", label: "Abat. comissão", shortLabel: "Abat.", num: true },
        { key: "tendencia", label: "Tendência", shortLabel: "Tend.", num: true },
        { key: "status", label: "Status", shortLabel: "Status", num: false },
      ];
    }
    if (ch === "pinterest") {
      return [
        ...base,
        { key: "cliques_pin", label: "Cliques Pin", shortLabel: "Cliques Pin", num: true },
        { key: "abatimento_cliques", label: "% Abat. cliques", shortLabel: "Abat. cliques", num: true },
        { key: "abatimento", label: "Abat. comissão", shortLabel: "Abat.", num: true },
        { key: "tendencia", label: "Tendência", shortLabel: "Tend.", num: true },
        { key: "status", label: "Status", shortLabel: "Status", num: false },
      ];
    }
    return [
      ...base,
      { key: "abatimento", label: "Abat. comissão", shortLabel: "Abat.", num: true },
      { key: "tendencia", label: "Tendência", shortLabel: "Tend.", num: true },
      { key: "status", label: "Status", shortLabel: "Status", num: false },
    ];
  }

  const SUBID_COL_ESSENTIAL = {
    meta: ["subid", "comissao", "inv_total", "lucro", "roi", "pedidos", "cliques_meta", "cliques_shopee", "abatimento", "tendencia", "status"],
    pinterest: ["subid", "comissao", "inv_total", "lucro", "roi", "pedidos", "cliques_pin", "cliques_shopee", "abatimento", "tendencia", "status"],
    organico: ["subid", "comissao", "lucro", "roi", "pedidos", "cliques_shopee", "abatimento", "tendencia", "status"],
    geral: ["subid", "comissao", "inv_total", "lucro", "roi", "pedidos", "cliques_shopee", "abatimento", "tendencia", "status"],
  };

  function subidColStorageKey(ch) {
    return `saas:subid_cols:${ch || "meta"}`;
  }

  function defaultSubidColPrefs(ch) {
    const all = allSubidColumnDefs(ch);
    const essential = new Set(SUBID_COL_ESSENTIAL[ch] || SUBID_COL_ESSENTIAL.meta);
    const prefs = {};
    for (const col of all) prefs[col.key] = essential.has(col.key);
    return prefs;
  }

  function readSubidColPrefs(ch) {
    const defaults = defaultSubidColPrefs(ch);
    try {
      const raw = window.localStorage.getItem(subidColStorageKey(ch));
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== "object") return defaults;
      const merged = { ...defaults, ...parsed };
      merged.subid = true;
      return merged;
    } catch {
      return defaults;
    }
  }

  function saveSubidColPrefs(ch, prefs) {
    try {
      window.localStorage.setItem(subidColStorageKey(ch), JSON.stringify({ ...prefs, subid: true }));
    } catch { /* ignore quota */ }
  }

  function visibleSubidColumns(ch) {
    const prefs = state.subidColPrefs?.[ch] || readSubidColPrefs(ch);
    return allSubidColumnDefs(ch).filter((c) => c.locked || prefs[c.key]);
  }

  function subidTrendScore(r) {
    const byDate = new Map();
    for (const d of r.daily || []) {
      const key = String(d.data || "");
      if (!key) continue;
      byDate.set(key, (byDate.get(key) || 0) + Number(d.comissao || 0));
    }

    let dates = [];
    const start = state.dash?.range?.startDate;
    const end = state.dash?.range?.endDate;
    if (start && end) {
      const cur = new Date(`${start}T12:00:00`);
      const last = new Date(`${end}T12:00:00`);
      while (cur <= last) {
        dates.push(cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
      }
    } else {
      dates = [...byDate.keys()].sort();
    }

    if (dates.length < 2) return null;

    const mid = Math.floor(dates.length / 2);
    const oldVal = dates.slice(0, mid).reduce((a, dt) => a + (byDate.get(dt) || 0), 0);
    const newVal = dates.slice(mid).reduce((a, dt) => a + (byDate.get(dt) || 0), 0);

    if (oldVal <= 0 && newVal <= 0) return 0;
    if (newVal > oldVal * 1.05) return 1;
    if (newVal < oldVal * 0.95) return -1;
    return 0;
  }

  function trendCellHtml(r) {
    const score = subidTrendScore(r);
    if (score === null) return `<td class="num trend-cell muted">—</td>`;
    if (score > 0) return `<td class="num trend-cell trend-up" title="Comissão subindo no período">▲</td>`;
    if (score < 0) return `<td class="num trend-cell trend-down" title="Comissão caindo no período">▼</td>`;
    return `<td class="num trend-cell trend-flat" title="Comissão estável no período">→</td>`;
  }

  function channelSubidColumns(ch) {
    return visibleSubidColumns(ch);
  }

  function paintSubidColPicker(ch) {
    const pop = $("#subid-cols-pop");
    const countEl = $("#subid-cols-count");
    if (!pop) return;
    const prefs = state.subidColPrefs?.[ch] || readSubidColPrefs(ch);
    const all = allSubidColumnDefs(ch);
    const visible = all.filter((c) => c.locked || prefs[c.key]).length;
    if (countEl) countEl.textContent = `${visible}/${all.length}`;
    pop.innerHTML = `
      <div class="col-picker-head">
        <strong>Colunas visíveis</strong>
        <button type="button" class="col-picker-close" id="btn-subid-cols-close" aria-label="Fechar">×</button>
      </div>
      <div class="col-picker-presets">
        <button type="button" class="chip-btn sm" data-col-preset="essential">Essencial</button>
        <button type="button" class="chip-btn sm" data-col-preset="all">Mostrar tudo</button>
      </div>
      <div class="col-picker-list">
        ${all.map((c) => `
          <label class="col-picker-item${c.locked ? " is-locked" : ""}">
            <input type="checkbox" data-col-key="${c.key}" ${c.locked || prefs[c.key] ? "checked" : ""} ${c.locked ? "disabled" : ""} />
            <span>${escapeHtml(c.label)}</span>
          </label>
        `).join("")}
      </div>`;
  }

  function wireSubidColPicker() {
    const btn = $("#btn-subid-cols");
    const pop = $("#subid-cols-pop");
    if (!btn || !pop || pop.dataset.wired) return;
    pop.dataset.wired = "1";

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const ch = state.channel || "meta";
      if (!state.subidColPrefs) state.subidColPrefs = {};
      if (!state.subidColPrefs[ch]) state.subidColPrefs[ch] = readSubidColPrefs(ch);
      paintSubidColPicker(ch);
      const open = pop.classList.toggle("hidden") === false;
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });

    pop.addEventListener("click", (e) => e.stopPropagation());

    pop.addEventListener("change", (e) => {
      const input = e.target.closest("input[data-col-key]");
      if (!input) return;
      const ch = state.channel || "meta";
      if (!state.subidColPrefs) state.subidColPrefs = {};
      if (!state.subidColPrefs[ch]) state.subidColPrefs[ch] = readSubidColPrefs(ch);
      state.subidColPrefs[ch][input.dataset.colKey] = input.checked;
      saveSubidColPrefs(ch, state.subidColPrefs[ch]);
      paintSubidColPicker(ch);
      renderSubIdsDash();
    });

    pop.addEventListener("click", (e) => {
      const presetBtn = e.target.closest("[data-col-preset]");
      if (presetBtn) {
        const ch = state.channel || "meta";
        const preset = presetBtn.dataset.colPreset;
        const next = preset === "all"
          ? Object.fromEntries(allSubidColumnDefs(ch).map((c) => [c.key, true]))
          : defaultSubidColPrefs(ch);
        if (!state.subidColPrefs) state.subidColPrefs = {};
        state.subidColPrefs[ch] = next;
        saveSubidColPrefs(ch, next);
        paintSubidColPicker(ch);
        renderSubIdsDash();
        return;
      }
      if (e.target.closest("#btn-subid-cols-close")) {
        pop.classList.add("hidden");
        btn.setAttribute("aria-expanded", "false");
      }
    });

    document.addEventListener("click", () => {
      if (pop.classList.contains("hidden")) return;
      pop.classList.add("hidden");
      btn.setAttribute("aria-expanded", "false");
    });
  }

  function paintSubidThead(ch) {
    const thead = $("#subid-thead");
    if (!thead) return channelSubidColumns(ch);
    const cols = channelSubidColumns(ch);
    thead.innerHTML = `<tr>${cols.map((c) =>
      `<th class="th-sort${c.num ? " num" : ""}" data-sort="${c.key}">${escapeHtml(c.shortLabel || c.label)}</th>`
    ).join("")}</tr>`;
    return cols;
  }

  function cellForSubidCol(r, col, ch) {
    const inv = investForRoi(r);
    const roi = displayRoi(r);
    const lucro = r.lucro != null ? Number(r.lucro) : Number(r.comissao || 0) - inv;
    const abatC = clickAbatPct(r, ch);
    const abat = r.faturamento > 0
      ? Math.round((Number(r.comissao || 0) / Number(r.faturamento)) * 10000) / 100
      : (r.abatimento != null ? Number(r.abatimento) : null);
    switch (col.key) {
      case "subid":
        return `<td class="subid" data-subid="${escapeHtml(String(r.subid || ""))}" title="Clique para ver o historico diario">
          <span class="subid-caret"></span>${escapeHtml(String(r.subid || ""))}
        </td>`;
      case "faturamento": return `<td class="num cell-emerald">${fmt(r.faturamento)}</td>`;
      case "comissao": return `<td class="num cell-emerald">${fmt(r.comissao)}</td>`;
      case "inv_total": return `<td class="num cell-gasto">${fmt(inv)}</td>`;
      case "lucro": return `<td class="num ${lucroCellClass(lucro)}">${fmt(lucro)}</td>`;
      case "roi": return `<td class="num ${roiTierClass(roi)}">${fmtPct(roi)}</td>`;
      case "pedidos": return `<td class="num cell-emerald">${fmtNum(r.pedidos)}</td>`;
      case "concluidos": return `<td class="num cell-emerald">${fmtNum(r.concluidos)}</td>`;
      case "pendentes": return `<td class="num cell-emerald">${fmtNum(r.pendentes)}</td>`;
      case "cancelados": return `<td class="num cell-emerald">${fmtNum(r.cancelados)}</td>`;
      case "cliques_shopee": return `<td class="num cell-gasto">${r.cliques_shopee != null ? fmtNum(r.cliques_shopee) : "—"}</td>`;
      case "cliques_meta": return `<td class="num cell-gasto">${fmtNum(r.cliques_meta)}</td>`;
      case "cliques_pin": return `<td class="num cell-gasto">${fmtNum(r.cliques_pin)}</td>`;
      case "cliques_ads": return `<td class="num cell-gasto">${fmtNum(adsClicksFor(r, ch))}</td>`;
      case "impressoes": return `<td class="num">${fmtNum(r.impressoes)}</td>`;
      case "alcance": return `<td class="num">${fmtNum(r.alcance)}</td>`;
      case "ctr_meta": return `<td class="num">${fmtPct(r.ctr_meta)}</td>`;
      case "cpc_meta": return `<td class="num">${fmt(r.cpc_meta)}</td>`;
      case "abatimento_cliques": return `<td class="num">${fmtPct(abatC)}</td>`;
      case "abatimento": return `<td class="num">${fmtPct(abat)}</td>`;
      case "tendencia": return trendCellHtml(r);
      case "status": return `<td>${statusSelectHtml(r.subid, r.status)}</td>`;
      default: return `<td class="num">—</td>`;
    }
  }

  function applyChannelView() {
    const ch = state.channel || "geral";
    const isChannel = ch === "meta" || ch === "pinterest" || ch === "organico";
    paintChannelChrome(ch, isChannel);
    syncDashHeading();
    paintChannelCounts();

    const dash = state.dash;
    if (!dash) {
      renderKpis({});
      renderChannelKpis(ch, {});
      renderSuggestions(null);
      renderChart([]);
      return;
    }

    const channelSubs = filteredSubIds(dash.subIds || [], "", ch);
    let k = isChannel ? kpisFromSubIds(channelSubs, dash.kpis) : {
      ...(dash.kpis || {}),
      ...kpisFromSubIds(dash.subIds || [], dash.kpis),
      faturamento: dash.kpis?.faturamento,
      comissao: dash.kpis?.comissao,
      inv_meta: dash.kpis?.inv_meta,
      inv_pin: dash.kpis?.inv_pin,
      inv_total: dash.kpis?.inv_total,
      lucro: dash.kpis?.lucro,
      roi: dash.kpis?.roi,
      pedidos: dash.kpis?.pedidos,
      concluidos: dash.kpis?.concluidos,
      pendentes: dash.kpis?.pendentes,
      cancelados: dash.kpis?.cancelados,
      abatimento: dash.kpis?.abatimento,
    };
    // Totais de mídia do enrich (todas as linhas Meta/Pin do período)
    if (dash.kpis) {
      if (dash.kpis.cliques_meta != null) k.cliques_meta = dash.kpis.cliques_meta;
      if (dash.kpis.cliques_pin != null) k.cliques_pin = dash.kpis.cliques_pin;
      if (dash.kpis.cliques_ads != null) k.cliques_ads = dash.kpis.cliques_ads;
      if (!isChannel && dash.kpis.cliques_shopee != null) k.cliques_shopee = dash.kpis.cliques_shopee;
      if (dash.kpis.impressoes != null) k.impressoes = dash.kpis.impressoes;
      if (dash.kpis.alcance != null) k.alcance = dash.kpis.alcance;
      if (dash.kpis.ctr_meta != null) k.ctr_meta = dash.kpis.ctr_meta;
      if (dash.kpis.cpc_meta != null) k.cpc_meta = dash.kpis.cpc_meta;
      if (!isChannel && dash.kpis.abatimento_cliques != null) k.abatimento_cliques = dash.kpis.abatimento_cliques;
    }
    if (ch === "meta" && dash.kpis) {
      k.cliques_meta = dash.kpis.cliques_meta ?? k.cliques_meta;
      k.impressoes = dash.kpis.impressoes ?? k.impressoes;
      k.alcance = dash.kpis.alcance ?? k.alcance;
      k.ctr_meta = dash.kpis.ctr_meta ?? k.ctr_meta;
      k.cpc_meta = dash.kpis.cpc_meta ?? k.cpc_meta;
      if (k.cliques_shopee != null && Number(k.cliques_meta) > 0) {
        k.abatimento_cliques = Math.round((Number(k.cliques_shopee) / Number(k.cliques_meta)) * 10000) / 100;
      }
    }
    if (ch === "pinterest" && k.cliques_shopee != null && Number(k.cliques_pin) > 0) {
      k.abatimento_cliques = Math.round((Number(k.cliques_shopee) / Number(k.cliques_pin)) * 10000) / 100;
    }
    const daily = isChannel ? dailyFromSubIds(channelSubs) : (dash.daily || []);
    if (!isChannel) {
      renderKpis(k, (dash.subIds || []).length);
      renderChart(daily);
      renderDailyTable(daily, k);
    } else {
      renderChannelKpis(ch, k);
      if (!state.subidColPrefs) state.subidColPrefs = {};
      if (!state.subidColPrefs[ch]) state.subidColPrefs[ch] = readSubidColPrefs(ch);
      paintSubidColPicker(ch);
      renderSubIdsDash();
    }
    renderSuggestions(dash);

    const liveText = $("#dash-live-text");
    if (liveText) {
      const n = channelSubs.length;
      const label = isChannel ? `${canalLabel(ch)} · ` : "";
      liveText.textContent = n
        ? `${label}${fmtNum(n)} SubIDs no período`
        : `${label}Ao vivo`;
    }
  }

  function renderOpsTable() {
    const tb = $("#ops-tbody");
    if (!tb) return;
    const q = ($("#ops-search")?.value || "").trim().toLowerCase();
    let list = sortRows(state.dash?.subIds || [], "subid", "asc", (r) => r.subid);
    if (q) list = list.filter((r) => String(r.subid || "").toLowerCase().includes(q));

    const pageSize = Number(state.opsPageSize) || 25;
    const total = list.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    if (state.opsPage > pages) state.opsPage = pages;
    if (state.opsPage < 1) state.opsPage = 1;
    const slice = list.slice((state.opsPage - 1) * pageSize, state.opsPage * pageSize);

    const countPill = $("#ops-count-pill");
    if (countPill) countPill.textContent = fmtNum(total);

    tb.innerHTML = slice.map((r) => {
      const id = String(r.subid || "");
      const canal = r.canal || "indefinido";
      const status = normalizeStatus(r.status);
      return `<tr>
        <td class="subid">${escapeHtml(id)}</td>
        <td>${canalSelectHtml(id, canal)}</td>
        <td>${statusSelectHtml(id, status)}</td>
      </tr>`;
    }).join("") || `<tr><td colspan="3">${state.dash ? "Nenhum SubID encontrado." : "Carregue o painel para listar SubIDs."}</td></tr>`;
    wireOpsSelects("#ops-tbody");

    const pager = $("#ops-pager");
    if (pager) {
      renderPager(pager, state.opsPage, total, pageSize, (p) => {
        state.opsPage = p;
        renderOpsTable();
      });
    }
  }

  function renderIndefinidos() {
    const tb = $("#indef-tbody");
    if (!tb) return;
    const list = (state.dash?.subIds || []).filter((r) => (r.canal || "indefinido") === "indefinido");
    const pill = $("#indef-count-pill");
    if (pill) pill.textContent = fmtNum(list.length);
    tb.innerHTML = list.map((r) => {
      const id = String(r.subid || "");
      return `<tr>
        <td class="subid">${escapeHtml(id)}</td>
        <td>${canalSelectHtml(id, "indefinido")}</td>
        <td>${statusSelectHtml(id, r.status)}</td>
        <td class="num">${fmt(r.faturamento)}</td>
        <td class="num">${fmt(r.comissao)}</td>
      </tr>`;
    }).join("") || `<tr><td colspan="5">Nenhum SubID indefinido — todos já estão em um canal.</td></tr>`;
    wireOpsSelects("#indef-tbody");
  }

  function renderPager(el, page, total, pageSize, onPage) {
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const from = total ? (page - 1) * pageSize + 1 : 0;
    const to = Math.min(total, page * pageSize);
    const btns = [];
    btns.push(`<button type="button" data-p="${page - 1}" ${page <= 1 ? "disabled" : ""}>Anterior</button>`);
    const window = [];
    for (let i = 1; i <= pages && window.length < 5; i++) {
      if (i === 1 || i === pages || Math.abs(i - page) <= 1) window.push(i);
    }
    let last = 0;
    window.forEach((i) => {
      if (last && i - last > 1) btns.push(`<span class="pager-gap">…</span>`);
      btns.push(`<button type="button" class="${i === page ? "active" : ""}" data-p="${i}">${i}</button>`);
      last = i;
    });
    btns.push(`<button type="button" data-p="${page + 1}" ${page >= pages ? "disabled" : ""}>Próximo</button>`);
    el.innerHTML = `
      <div class="pager-info">Exibindo <strong>${from}–${to}</strong> de <strong>${fmtNum(total)}</strong></div>
      <div class="pager-btns">${btns.join("")}</div>`;
    el.querySelectorAll("button[data-p]").forEach((b) => {
      b.addEventListener("click", () => {
        const p = Number(b.dataset.p);
        if (p >= 1 && p <= pages) onPage(p);
      });
    });
  }

  function shortDayLabel(iso) {
    if (!iso) return "—";
    const [y, m, d] = String(iso).split("-");
    const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    const mi = Number(m) - 1;
    return `${d} ${months[mi] || m}`;
  }

  function subIdDailyHistoryHtml(r, colSpan) {
    const days = Array.isArray(r.daily) ? r.daily : [];
    const key = String(r.subid || "");
    if (!days.length) {
      return `<tr class="subid-detail" data-parent="${escapeHtml(key)}">
        <td colspan="${colSpan}">
          <div class="subid-history">
            <div class="subid-history-empty">Sem histórico diário para este SubID no período.</div>
          </div>
        </td>
      </tr>`;
    }
    const totCom = days.reduce((a, d) => a + Number(d.comissao || 0), 0);
    const totInv = days.reduce((a, d) => a + investForRoi(d), 0);
    const totLucro = days.reduce((a, d) => {
      if (d.lucro != null) return a + Number(d.lucro);
      return a + (Number(d.comissao || 0) - investForRoi(d));
    }, 0);
    const totRoi = totInv > 0 ? (totLucro / totInv) * 100 : null;
    const rows = days.map((d) => {
      const inv = investForRoi(d);
      const lucro = d.lucro != null ? Number(d.lucro) : Number(d.comissao || 0) - inv;
      const roi = displayRoi(d);
      return `<tr>
        <td>${escapeHtml(shortDayLabel(d.data))}</td>
        <td class="num cell-emerald">${fmt(d.comissao)}</td>
        <td class="num cell-gasto">${fmt(inv)}</td>
        <td class="num ${lucroCellClass(lucro)}">${fmt(lucro)}</td>
        <td class="num ${roiTierClass(roi)}">${fmtPct(roi)}</td>
      </tr>`;
    }).join("");
    return `<tr class="subid-detail" data-parent="${escapeHtml(key)}">
      <td colspan="${colSpan}">
        <div class="subid-history">
          <div class="subid-history-head">
            <span>Historico diario</span>
            <span class="muted">Ultimos ${days.length} dia(s) — ${escapeHtml(key)}</span>
          </div>
          <table class="subid-history-table">
            <thead>
              <tr>
                <th>Dia</th>
                <th class="num">Comissao</th>
                <th class="num">Investim.</th>
                <th class="num">Lucro</th>
                <th class="num">ROI</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
              <tr class="subid-history-total">
                <td>Total ${days.length}d</td>
                <td class="num cell-emerald">${fmt(totCom)}</td>
                <td class="num cell-gasto">${fmt(totInv)}</td>
                <td class="num ${lucroCellClass(totLucro)}">${fmt(totLucro)}</td>
                <td class="num ${roiTierClass(totRoi)}">${fmtPct(totRoi)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </td>
    </tr>`;
  }

  function wireSubIdExpand(tbodySel, renderFn) {
    const tb = $(tbodySel);
    if (!tb || tb.dataset.expandWired) return;
    tb.dataset.expandWired = "1";
    tb.addEventListener("click", (e) => {
      const cell = e.target.closest("td.subid[data-subid]");
      if (!cell) return;
      e.preventDefault();
      const id = cell.dataset.subid;
      state.expandedSubIds[id] = !state.expandedSubIds[id];
      renderFn();
    });
  }

  function renderSubIdsDash() {
    const ch = state.channel || "geral";
    const cols = paintSubidThead(ch);
    let all = filteredSubIds(state.dash?.subIds || [], $("#subid-search")?.value, ch);
    const statusRank = { ativa: 0, teste: 1, desativada: 2, pausada: 2 };
    all = sortRows(all, state.subidSort.key || "status", state.subidSort.dir || "asc", (r) => {
      if (state.subidSort.key === "subid") return r.subid;
      if (state.subidSort.key === "status" || !state.subidSort.key) return statusRank[normalizeStatus(r.status)] ?? 9;
      if (state.subidSort.key === "roi") return displayRoi(r);
      if (state.subidSort.key === "inv_total") return investForRoi(r);
      if (state.subidSort.key === "lucro") return r.lucro != null ? Number(r.lucro) : Number(r.comissao || 0) - investForRoi(r);
      if (state.subidSort.key === "cliques_ads") return adsClicksFor(r, ch);
      if (state.subidSort.key === "abatimento_cliques") return clickAbatPct(r, ch);
      if (state.subidSort.key === "abatimento") {
        const fat = Number(r.faturamento || 0);
        return fat > 0 ? (Number(r.comissao || 0) / fat) * 100 : Number(r.abatimento || 0);
      }
      if (state.subidSort.key === "tendencia") return subidTrendScore(r);
      return r[state.subidSort.key];
    });
    paintSortHeaders("#subid-thead", state.subidSort);
    const total = all.length;
    const pages = Math.max(1, Math.ceil(total / state.pageSize));
    if (state.subidPage > pages) state.subidPage = pages;
    const slice = all.slice((state.subidPage - 1) * state.pageSize, state.subidPage * state.pageSize);
    const pill = $("#subid-count-pill");
    if (pill) pill.textContent = fmtNum(total);
    const tbody = $("#subid-tbody");
    if (!tbody) return;
    const span = cols.length;
    tbody.innerHTML = slice.map((r) => {
      const id = String(r.subid || "");
      const open = Boolean(state.expandedSubIds[id]);
      const main = `<tr class="subid-row ${open ? "is-open" : ""}" data-subid="${escapeHtml(id)}">
        ${cols.map((c) => cellForSubidCol(r, c, ch)).join("")}
      </tr>`;
      return open ? main + subIdDailyHistoryHtml(r, span) : main;
    }).join("") || `<tr><td colspan="${span}">Nenhum SubID neste canal no período.</td></tr>`;
    wireSubIdExpand("#subid-tbody", renderSubIdsDash);
    wireOpsSelects("#subid-tbody");
    renderPager($("#subid-pager"), state.subidPage, total, state.pageSize, (p) => {
      state.subidPage = p;
      renderSubIdsDash();
    });
  }

  function paintDataTable(headers, rows) {
    state.dataHeaders = headers;
    state.dataRows = rows || [];
    state.dataPage = 1;
    state.dataColFilters = {};
    state.dataSort = { key: null, dir: "asc" };
    $("#data-thead").innerHTML = `<tr>${headers.map((h, i) => {
      const key = h.key || `col_${i}`;
      return `<th class="th-sort ${h.num ? "num" : ""}" data-sort="${escapeHtml(key)}" scope="col">${h.label}</th>`;
    }).join("")}</tr>`;
    paintSortHeaders("#data-thead", state.dataSort);
    const sizeSel = $("#data-page-size");
    if (sizeSel) state.dataPageSize = Number(sizeSel.value) || 10;
    renderDataBody();
  }

  function rowCellText(headers, row, key, idx) {
    const h = headers[idx] || headers.find((x) => x.key === key);
    if (!h) return "";
    if (h.render) {
      const tmp = document.createElement("div");
      tmp.innerHTML = String(h.render(row) ?? "");
      return tmp.textContent || "";
    }
    return String(row[h.key] ?? "");
  }

  function filteredDataRows() {
    const headers = state.dataHeaders || [];
    const q = ($("#data-search")?.value || "").trim().toLowerCase();
    let rows = state.dataRows || [];
    if (q) {
      rows = rows.filter((r) => {
        const blob = headers.map((h, i) => rowCellText(headers, r, h.key || `col_${i}`, i)).join(" ").toLowerCase();
        return blob.includes(q);
      });
    }
    return sortRows(rows, state.dataSort.key, state.dataSort.dir, (r) => {
      const key = state.dataSort.key;
      const idx = headers.findIndex((h, i) => (h.key || `col_${i}`) === key);
      const h = idx >= 0 ? headers[idx] : headers.find((x) => x.key === key);
      if (!h) return r[key];
      if (h.sortValue) return h.sortValue(r);
      if (h.num) return Number(r[h.key] ?? 0);
      return r[h.key] ?? rowCellText(headers, r, key, idx >= 0 ? idx : 0);
    });
  }

  function renderDataBody() {
    const headers = state.dataHeaders || [];
    const filtered = filteredDataRows();
    paintSortHeaders("#data-thead", state.dataSort);
    const pageSize = state.dataPageSize || 10;
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (state.dataPage > pages) state.dataPage = pages;
    const slice = filtered.slice((state.dataPage - 1) * pageSize, state.dataPage * pageSize);
    $("#data-tbody").innerHTML = slice.map((r) => `
      <tr>${headers.map((h) => `<td class="${h.num ? "num" : ""}">${h.render ? h.render(r) : escapeHtml(r[h.key] ?? "—")}</td>`).join("")}</tr>
    `).join("") || `<tr><td colspan="${Math.max(headers.length, 1)}">Sem dados para os filtros atuais. Sincronize Shopee/Meta ou limpe os filtros.</td></tr>`;
    renderPager($("#data-pager"), state.dataPage, filtered.length, pageSize, (p) => {
      state.dataPage = p;
      renderDataBody();
    });
  }

  async function loadDataView(view) {
    $("#data-title").textContent = VIEW_LABELS[view] || view;
    $("#data-sub").textContent = "Dados reais da sua conta no período selecionado.";
    $("#data-panel-title").textContent = VIEW_LABELS[view];
    state.dataKind = view;
    const start = $("#start-date")?.value || daysAgoISO(6);
    const end = $("#end-date")?.value || todayISO();

    // Garante painel carregado para menus derivados (visão, performance, etc.)
    if (!state.dash && state.configured) {
      try {
        await loadDashboard({ force: false });
      } catch (_) { /* ignore */ }
    }

    const k = state.dash?.kpis || {};
    const daily = state.dash?.daily || [];
    const subIds = state.dash?.subIds || [];

    try {
      if (view === "pedidos") {
        let orders = [];
        try {
          const r = await api(`/api/orders?start=${start}&end=${end}`);
          orders = r.orders || [];
        } catch (_) {}
        if (!orders.length && state.dash?.ordersPreview) orders = state.dash.ordersPreview;
        paintDataTable(
          [
            { label: "Data", key: "data" },
            { label: "Pedido", key: "order_id" },
            { label: "SubID", key: "subid" },
            { label: "Status", key: "status" },
            { label: "Faturamento", num: true, render: (x) => fmt(x.faturamento) },
            { label: "Comissão", num: true, render: (x) => fmt(x.comissao) },
          ],
          orders,
        );
        $("#data-sub").textContent = `${orders.length} pedidos no período ${start} a ${end}`;
      } else if (view === "produtos") {
        let products = [];
        try {
          const r = await api("/api/products");
          products = r.products || [];
        } catch (_) {}
        if (!products.length && state.dash?.productsPreview) products = state.dash.productsPreview;
        // Último recurso: agrupa pedidos recentes como linhas de produto
        if (!products.length && (state.dash?.ordersPreview || []).length) {
          const map = {};
          for (const o of state.dash.ordersPreview) {
            const id = o.order_id || o.subid || "—";
            if (!map[id]) {
              map[id] = {
                item_name: `Pedido ${id}`,
                shop_name: o.subid || "—",
                pedidos: 0,
                qty: 0,
                faturamento: 0,
                comissao: 0,
              };
            }
            map[id].pedidos += 1;
            map[id].qty += 1;
            map[id].faturamento += Number(o.faturamento || 0);
            map[id].comissao += Number(o.comissao || 0);
          }
          products = Object.values(map).sort((a, b) => b.comissao - a.comissao);
        }
        paintDataTable(
          [
            { label: "Item", key: "item_name" },
            { label: "Loja", key: "shop_name" },
            { label: "Pedidos", num: true, render: (x) => fmtNum(x.pedidos) },
            { label: "Qtd", num: true, render: (x) => fmtNum(x.qty) },
            { label: "Faturamento", num: true, render: (x) => fmt(x.faturamento) },
            { label: "Comissão", num: true, render: (x) => fmt(x.comissao) },
          ],
          products,
        );
        $("#data-sub").textContent = products.length
          ? `${products.length} produtos com venda`
          : "Sem produtos — sincronize a Shopee no Painel.";
      } else if (view === "campanhas") {
        const r = await api(`/api/campaigns?start=${start}&end=${end}`);
        const campaigns = r.campaigns || [];
        paintDataTable(
          [
            { label: "Campanha", key: "campaign" },
            { label: "Gasto", num: true, render: (x) => fmt(x.gasto) },
            { label: "Ads", num: true, render: (x) => fmtNum(x.ads) },
            { label: "Cliques", num: true, render: (x) => fmtNum(x.cliques) },
            { label: "Impressões", num: true, render: (x) => fmtNum(x.impressoes) },
          ],
          campaigns,
        );
        $("#data-sub").textContent = campaigns.length
          ? `${campaigns.length} campanhas Meta no período`
          : "Sem campanhas — em Configurações, Sincronizar Meta.";
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
        $("#data-sub").textContent = `Invest total ${fmt(k.inv_total)} · ROI ${fmtPct(k.roi)}`;
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
        $("#data-sub").textContent = `${subIds.length} SubIDs ranqueados por comissão`;
      } else if (view === "comissoes") {
        paintDataTable(
          [
            { label: "Métrica", key: "label" },
            { label: "Valor", num: true, key: "value" },
          ],
          [
            { label: "Comissão total", value: fmt(k.comissao) },
            { label: "Faturamento", value: fmt(k.faturamento) },
            { label: "Concluídos", value: fmtNum(k.concluidos) },
            { label: "Pendentes", value: fmtNum(k.pendentes) },
            { label: "Cancelados", value: fmtNum(k.cancelados) },
            { label: "Não pagos", value: fmtNum(k.unpaid) },
            { label: "Abatimento médio", value: fmtPct(k.abatimento) },
            { label: "Lucro (com − invest)", value: fmt(k.lucro) },
          ],
        );
      } else if (view === "visao") {
        paintDataTable(
          [
            { label: "KPI", key: "label" },
            { label: "Valor", num: true, key: "value" },
          ],
          [
            { label: "Faturamento", value: fmt(k.faturamento) },
            { label: "Comissão", value: fmt(k.comissao) },
            { label: "Invest. Meta", value: fmt(k.inv_meta) },
            { label: "Invest. Pin", value: fmt(k.inv_pin) },
            { label: "Lucro", value: fmt(k.lucro) },
            { label: "ROI", value: fmtPct(k.roi) },
            { label: "Pedidos", value: fmtNum(k.pedidos) },
            { label: "SubIDs", value: fmtNum(k.subIdsCount || subIds.length) },
          ],
        );
        $("#data-sub").textContent = `Resumo ${start} a ${end}`;
      } else if (view === "comparativos") {
        paintDataTable(
          [
            { label: "Dia", key: "data", render: (x) => shortDay(x.data) },
            { label: "Faturamento", num: true, render: (x) => fmt(x.faturamento) },
            { label: "Comissão", num: true, render: (x) => fmt(x.comissao) },
            { label: "Pedidos", num: true, render: (x) => fmtNum(x.pedidos) },
            { label: "Invest.", num: true, render: (x) => fmt(x.inv_total) },
            { label: "Lucro", num: true, render: (x) => fmt(x.lucro) },
            { label: "ROI", num: true, render: (x) => fmtPct(x.roi) },
          ],
          daily,
        );
        $("#data-sub").textContent = "Comparativo dia a dia do período";
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
            { label: "Lucro após imposto", value: fmt(Number(k.lucro || 0) - imposto) },
          ],
        );
        $("#data-sub").textContent = `Alíquota ${fmtPct(tax)} · imposto ${fmt(imposto)}`;
      } else if (view === "equipe") {
        paintDataTable(
          [{ label: "Campo", key: "label" }, { label: "Valor", num: true, key: "value" }],
          [
            { label: "Nome da equipe", value: state.settings.teamName || "—" },
            { label: "Plano", value: state.settings.teamPlan || "—" },
            { label: "Email", value: getStoredUser().email || "—" },
            { label: "Alíquota de imposto", value: fmtPct(state.settings.taxRate) },
            { label: "Comissão do período", value: fmt(k.comissao) },
            { label: "Faturamento do período", value: fmt(k.faturamento) },
            { label: "Lucro do período", value: fmt(k.lucro) },
            { label: "Investimento total", value: fmt(k.inv_total) },
            { label: "SubIDs ativos", value: fmtNum(subIds.length) },
            { label: "Pedidos no período", value: fmtNum(k.pedidos || 0) },
            { label: "Shopee", value: state.configured ? "Configurada" : "Pendente" },
            { label: "Meta Ads", value: state.metaConfigured ? "Configurada" : "Pendente" },
          ],
        );
        $("#data-sub").textContent = `Equipe · comissão ${fmt(k.comissao)} · lucro ${fmt(k.lucro)}`;
      }
    } catch (err) {
      $("#data-tbody").innerHTML = `<tr><td>${escapeHtml(err.message)}</td></tr>`;
    }
  }

  function applyDash(dash, { cached } = {}) {
    state.dash = dash;
    state.subidPage = 1;
    const k = dash.kpis || {};
    applyChannelView();
    renderOpsTable();
    renderIndefinidos();
    const when = dash.syncedAt ? new Date(dash.syncedAt).toLocaleString("pt-BR") : "—";
    $("#sync-meta").textContent = `${cached ? "cache · " : ""}${dash.nodes || 0} nodes · ${when}`;
    $("#footer-sync").textContent = `Última sincronização ${when}`;
  }

  function setStateChip(sel, ok, okText, offText) {
    const el = $(sel);
    if (!el) return;
    el.textContent = ok ? okText : offText;
    el.classList.toggle("is-ok", Boolean(ok));
  }

  function brShortDate(iso) {
    if (!iso) return "—";
    const [, m, d] = String(iso).split("-");
    return d && m ? `${d}/${m}` : iso;
  }

  function brPeriodLabel(iso) {
    if (!iso) return "—";
    const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    const [y, m, d] = String(iso).split("-");
    if (!y || !m || !d) return iso;
    return `${d} ${months[Number(m) - 1]} ${y}`;
  }

  function brShortDateFull(iso) {
    if (!iso) return "—";
    const [y, m, d] = String(iso).split("-");
    return y && m && d ? `${d}/${m}/${y}` : iso;
  }

  const PRESET_SUBTITLES = {
    all: "Todo período",
    yesterday: "Ontem",
    "7d": "7 dias",
    "14d": "14 dias",
    "30d": "30 dias",
    month: "Este mês",
    prev_month: "Mês anterior",
    custom: "Personalizado",
  };

  function syncTopbarRange() {
    const start = $("#start-date")?.value;
    const end = $("#end-date")?.value;
    const el = $("#topbar-range");
    if (el) el.textContent = start && end ? `${brShortDate(start)} → ${brShortDate(end)}` : "—";

    const display = $("#period-range-display");
    if (display) {
      display.textContent = start && end
        ? (start === end ? brShortDateFull(start) : `${brShortDateFull(start)} – ${brShortDateFull(end)}`)
        : "—";
      display.title = start && end ? `${start} – ${end}` : "";
    }

    const subtitle = $("#period-preset-subtitle");
    if (subtitle) {
      const key = state.periodPreset || "custom";
      subtitle.textContent = (PRESET_SUBTITLES[key] || PRESET_SUBTITLES.custom).toUpperCase();
    }

    const hint = $("#period-data-hint");
    if (hint) hint.textContent = `Dados disponíveis até ${brShortDateFull(yesterdayISO())}`;

    const applyBtn = $("#btn-period-apply");
    if (applyBtn) applyBtn.disabled = !(start && end);
  }

  async function loadCredentials() {
    const c = await api("/api/credentials");
    state.configured = Boolean(c.configured);
    $("#sidebar-status").textContent = c.configured ? `Shopee APP ${c.appId}` : "Shopee sem credencial";
    $("#api-status")?.classList.toggle("is-off", !c.configured);
    const apiLabel = $("#api-state-label");
    if (apiLabel) apiLabel.textContent = c.configured ? "APIs online" : "APIs pendentes";
    setStateChip("#cfg-shopee-state", c.configured, "Conectada", "Pendente");
    if (c.appId) $("#app-id").value = c.appId;
    const banner = $("#sync-banner");
    if (c.configured) {
      banner.className = "banner hidden";
      banner.innerHTML = "";
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
      setStateChip("#cfg-meta-state", m.configured, "Conectada", "Pendente");
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
        taxRate: s.taxRate,
        metaTaxRate: s.metaTaxRate != null ? s.metaTaxRate : 12,
        teamName: s.teamName,
        teamPlan: s.teamPlan,
      };
      $("#set-tax").value = formatBrPctInput(s.taxRate);
      if ($("#set-meta-tax")) $("#set-meta-tax").value = formatBrPctInput(state.settings.metaTaxRate);
      $("#set-team-name").value = s.teamName;
      $("#set-team-plan").value = s.teamPlan;
      $("#team-name").textContent = s.teamName;
      $("#team-plan").textContent = s.teamPlan;
    } catch (e) {
      console.warn(e);
    }
  }

  async function syncMetaAds(statusEl, btnEl) {
    const status = statusEl || $("#meta-status");
    const isBanner = status?.classList?.contains("banner") || status?.id === "sync-banner";
    if (status) {
      if (isBanner) {
        status.className = "banner";
        status.textContent = "Sincronizando Meta (pode levar 1–2 min)…";
      } else {
        status.className = "form-status";
        status.textContent = "Sincronizando Meta (pode levar 1–2 min)…";
      }
    }
    if (btnEl) btnEl.disabled = true;
    try {
      const since = $("#start-date")?.value || null;
      const until = $("#end-date")?.value || null;
      const r = await api("/api/meta/sync", {
        method: "POST",
        body: JSON.stringify({ since, until, daysBack: 30 }),
      });
      if (status) {
        const tot = r.totais
          ? ` · gasto R$ ${Number(r.totais.gasto || 0).toLocaleString("pt-BR")} · ${Number(r.totais.cliques || 0).toLocaleString("pt-BR")} cliques`
          : "";
        const msg = `Meta sync: ${r.gravados} linhas (${r.range?.since} a ${r.range?.until})${tot}` +
          (r.erros?.length ? ` · avisos: ${r.erros.join("; ")}` : "");
        if (isBanner) {
          status.className = "banner ok keep";
          status.textContent = msg;
          setTimeout(() => {
            if (status.classList.contains("keep")) status.className = "banner hidden";
          }, 8000);
        } else {
          status.className = "form-status ok";
          status.textContent = msg;
        }
      }
      await loadMetaCreds();
      await loadDashboard({ force: false });
      return r;
    } catch (err) {
      if (status) {
        if (isBanner) {
          status.className = "banner";
          status.textContent = err.message;
        } else {
          status.className = "form-status err";
          status.textContent = err.message;
        }
      }
      throw err;
    } finally {
      if (btnEl) btnEl.disabled = false;
    }
  }

  async function loadDashboard({ force = false } = {}) {
    const start = $("#start-date").value;
    const end = $("#end-date").value;
    const btn = force ? $("#btn-sync") : ($("#btn-load") || $("#btn-sync"));
    const prev = btn ? btn.textContent : "";
    if (btn) {
      btn.disabled = true;
      btn.textContent = force ? "Sincronizando…" : "Carregando…";
    }
    try {
      const q = new URLSearchParams({ start, end });
      if (force) q.set("force", "1");
      const dash = await api(`/api/dashboard?${q}`);
      applyDash(dash, { cached: dash.cached });
      const banner = $("#sync-banner");
      if (force && dash.metaSync && !dash.metaSync.error) {
        const m = dash.metaSync;
        banner.className = "banner ok keep";
        banner.textContent = `Shopee + Meta OK · Meta ${m.gravados || 0} linhas · gasto R$ ${Number(m.totais?.gasto || 0).toLocaleString("pt-BR")}`;
        setTimeout(() => {
          if (banner.classList.contains("keep")) banner.className = "banner hidden";
        }, 8000);
      } else if (force && dash.metaSync?.error) {
        banner.className = "banner keep";
        banner.textContent = `Shopee OK · Meta: ${dash.metaSync.error}`;
        setTimeout(() => {
          if (banner.classList.contains("keep")) banner.className = "banner hidden";
        }, 10000);
      } else if (!banner.classList.contains("keep")) {
        banner.className = "banner hidden";
        banner.textContent = "";
      }
    } catch (err) {
      const banner = $("#sync-banner");
      banner.className = "banner err";
      banner.textContent = err.message || String(err);
      if (err.code === "CREDS_MISSING") setView("config");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = prev;
      }
    }
  }

  function clearPeriodPresets() {
    $$("#period-bar .period-preset[data-range]").forEach((b) => b.classList.remove("active"));
  }

  function setRange(kind) {
    state.periodPreset = kind || "7d";
    $$("#period-bar .period-preset[data-range]").forEach((b) => b.classList.toggle("active", b.dataset.range === kind));
    if (kind === "yesterday") {
      $("#start-date").value = yesterdayISO();
      $("#end-date").value = yesterdayISO();
    } else if (kind === "7d") {
      $("#start-date").value = daysAgoISO(6);
      $("#end-date").value = todayISO();
    } else if (kind === "14d") {
      $("#start-date").value = daysAgoISO(13);
      $("#end-date").value = todayISO();
    } else if (kind === "30d") {
      $("#start-date").value = daysAgoISO(29);
      $("#end-date").value = todayISO();
    } else if (kind === "all") {
      $("#start-date").value = daysAgoISO(89);
      $("#end-date").value = todayISO();
    } else if (kind === "prev_month") {
      const range = monthPreviousRangeISO();
      $("#start-date").value = range.start;
      $("#end-date").value = range.end;
    } else {
      $("#start-date").value = monthStartISO();
      $("#end-date").value = todayISO();
    }
    syncTopbarRange();
    loadDashboard({ force: false });
  }

  function togglePeriodCustom(open) {
    const panel = $("#period-custom-panel");
    const btn = $("#btn-period-custom");
    if (!panel || !btn) return;
    let isOpen;
    if (open === true) {
      panel.classList.remove("hidden");
      isOpen = true;
    } else if (open === false) {
      panel.classList.add("hidden");
      isOpen = false;
    } else {
      isOpen = panel.classList.toggle("hidden") === false;
    }
    btn.classList.toggle("is-open", isOpen);
    btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
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
    initTheme();
    $("#theme-toggle")?.addEventListener("click", () => {
      const next = document.documentElement.classList.contains("dark") ? "light" : "dark";
      applyTheme(next);
    });
    $("#btn-chart-profit")?.addEventListener("click", () => setChartMode("profit"));
    $("#btn-chart-revenue")?.addEventListener("click", () => setChartMode("revenue"));

    $("#start-date").value = daysAgoISO(6);
    $("#end-date").value = todayISO();
    state.periodPreset = "7d";
    syncTopbarRange();
    $$("#period-bar .period-preset[data-range]").forEach((b) => b.classList.toggle("active", b.dataset.range === "7d"));

    $("#btn-period-custom")?.addEventListener("click", () => togglePeriodCustom());
    $("#btn-period-apply")?.addEventListener("click", () => {
      const start = $("#start-date")?.value;
      const end = $("#end-date")?.value;
      if (!start || !end) return;
      clearPeriodPresets();
      state.periodPreset = "custom";
      syncTopbarRange();
      loadDashboard({ force: false });
    });
    $("#btn-period-clear")?.addEventListener("click", () => {
      togglePeriodCustom(false);
      setRange("7d");
    });
    $("#btn-period-refresh")?.addEventListener("click", () => loadDashboard({ force: true }));
    let authMode = "login";
    function setAuthMode(mode) {
      authMode = mode;
      const isReg = mode === "register";
      $("#auth-tab-login")?.classList.toggle("active", !isReg);
      $("#auth-tab-register")?.classList.toggle("active", isReg);
      $("#auth-submit").textContent = isReg ? "Validar APIs e criar conta" : "Entrar";
      $("#register-extra")?.classList.toggle("hidden", !isReg);
      $("#auth-card")?.classList.toggle("register-mode", isReg);
      const email = $("#auth-email");
      if (email) email.placeholder = "seu@email.com";
    }
    $("#auth-tab-login")?.addEventListener("click", () => setAuthMode("login"));
    $("#auth-tab-register")?.addEventListener("click", () => setAuthMode("register"));
    $("#auth-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const status = $("#auth-status");
      status.className = "form-status";
      status.textContent = authMode === "login" ? "Entrando…" : "Validando Shopee…";
      try {
        const path = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
        const payload = {
          email: $("#auth-email").value.trim(),
          password: $("#auth-password").value,
        };
        if (authMode === "register") {
          const appId = $("#reg-app-id")?.value.trim() || "";
          const secret = $("#reg-app-secret")?.value.trim() || "";
          const metaToken = $("#reg-meta-token")?.value.trim() || "";
          const metaAccounts = $("#reg-meta-accounts")?.value.trim() || "";
          const metaVersion = $("#reg-meta-version")?.value.trim() || "v19.0";
          if (!$("#auth-name")?.value.trim()) throw new Error("Informe seu nome");
          if (!appId || !secret) throw new Error("Informe APP_ID e SECRET da Shopee");
          if (!/^\d{6,}$/.test(appId)) throw new Error("SHOPEE_APP_ID deve ser numérico (ex: 18108270013)");
          if (secret.length < 16) throw new Error("SHOPEE_SECRET parece incompleto");
          if (metaToken || metaAccounts) {
            if (!metaToken || metaToken.length < 20) throw new Error("META_ACCESS_TOKEN incompleto");
            if (!metaAccounts || !/\d{5,}/.test(metaAccounts)) {
              throw new Error("Informe ao menos um META_AD_ACCOUNT_ID numérico");
            }
          }
          payload.displayName = $("#auth-name")?.value.trim() || "";
          payload.company = $("#auth-company")?.value.trim() || "";
          payload.appId = appId;
          payload.secret = secret;
          if (metaToken && metaAccounts) {
            payload.metaToken = metaToken;
            payload.metaAccounts = metaAccounts;
            payload.metaVersion = metaVersion;
          }
          status.textContent = metaToken
            ? "Testando Shopee e Meta e criando conta…"
            : "Testando Shopee e criando conta…";
        }
        const http = await fetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const r = await readJsonResponse(http);
        if (!r.success) throw new Error(r.error || "Falha");
        if (r.pendingApproval || !r.access_token) {
          status.className = "form-status ok";
          let msg = r.message || "Conta criada. Aguarde aprovação do administrador.";
          if (r.metaWarning) msg += ` (aviso Meta: ${r.metaWarning})`;
          status.textContent = msg;
          setAuthMode("login");
          return;
        }
        setSession(r.access_token, r.user);
        status.className = "form-status ok";
        status.textContent = "OK";
        showApp(r.user);
        await bootApp();
      } catch (err) {
        status.className = "form-status err";
        status.textContent = err.message || String(err);
      }
    });
    $("#btn-logout")?.addEventListener("click", () => {
      clearSession();
      showAuth();
    });

    $("#btn-sidebar-open")?.addEventListener("click", () => setSidebarOpen(true));
    $("#btn-sidebar-close")?.addEventListener("click", () => setSidebarOpen(false));
    $("#sidebar-backdrop")?.addEventListener("click", () => setSidebarOpen(false));
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setSidebarOpen(false);
    });
    window.addEventListener("resize", () => {
      if (window.innerWidth > 900) setSidebarOpen(false);
    });

    $$(".nav-item").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
    document.body.addEventListener("click", (e) => {
      const t = e.target.closest("[data-goto]");
      if (t) setView(t.dataset.goto);
    });

    $$("#period-bar .period-preset[data-range]").forEach((b) => b.addEventListener("click", () => setRange(b.dataset.range)));

    wireSubidColPicker();

    $("#btn-load")?.addEventListener("click", () => loadDashboard({ force: false }));
    $("#btn-sync").addEventListener("click", () => loadDashboard({ force: true }));
    $("#btn-export").addEventListener("click", exportCsv);
    $("#btn-meta-sync-top")?.addEventListener("click", async () => {
      const btn = $("#btn-meta-sync-top");
      const prev = btn.textContent;
      try {
        await syncMetaAds($("#sync-banner"), btn);
      } catch {
        /* status already set */
      } finally {
        btn.textContent = prev;
        btn.disabled = false;
      }
    });

    $("#start-date")?.addEventListener("change", syncTopbarRange);
    $("#end-date")?.addEventListener("change", syncTopbarRange);

    const globalSearch = $("#global-search");
    globalSearch?.addEventListener("input", () => {
      const q = globalSearch.value;
      const dashSearch = $("#subid-search");
      if (dashSearch) {
        dashSearch.value = q;
        state.subidPage = 1;
        renderSubIdsDash();
      }
    });
    globalSearch?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && globalSearch.value.trim()) {
        e.preventDefault();
        const ch = state.channel;
        if (ch === "meta" || ch === "pinterest" || ch === "organico") setView(`campanhas-${ch === "organico" ? "organicas" : ch === "meta" ? "meta" : "pinterest"}`);
        else setView("campanhas-meta");
      }
    });

    $("#subid-search")?.addEventListener("input", () => { state.subidPage = 1; renderSubIdsDash(); });
    $("#ops-search")?.addEventListener("input", () => { state.opsPage = 1; renderOpsTable(); });
    $("#ops-page-size")?.addEventListener("change", () => {
      state.opsPageSize = Number($("#ops-page-size").value) || 25;
      state.opsPage = 1;
      renderOpsTable();
    });
    wireSortHeaders("#subid-thead", () => state.subidSort, () => {
      state.subidPage = 1;
      renderSubIdsDash();
    });
    wireSortHeaders("#daily-table thead", () => state.dailySort, () => {
      renderDailyTable(state.dailyRows, state.dash?.kpis || {});
    });
    wireSortHeaders("#data-thead", () => state.dataSort, () => {
      state.dataPage = 1;
      renderDataBody();
    });
    $("#data-search")?.addEventListener("input", () => {
      state.dataPage = 1;
      renderDataBody();
    });
    $("#data-page-size")?.addEventListener("change", () => {
      state.dataPageSize = Number($("#data-page-size").value) || 10;
      state.dataPage = 1;
      renderDataBody();
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
      try {
        await syncMetaAds($("#meta-status"), $("#btn-meta-sync"));
      } catch {
        /* status already set */
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
        const taxRate = parseBrNumber($("#set-tax").value);
        const metaTaxRate = parseBrNumber($("#set-meta-tax")?.value || "12");
        const s = await api("/api/settings", {
          method: "POST",
          body: JSON.stringify({
            taxRate,
            metaTaxRate,
            teamName: $("#set-team-name").value.trim(),
            teamPlan: $("#set-team-plan").value.trim(),
          }),
        });
        state.settings = {
          taxRate: s.taxRate,
          metaTaxRate: s.metaTaxRate != null ? s.metaTaxRate : metaTaxRate,
          teamName: s.teamName,
          teamPlan: s.teamPlan,
        };
        $("#set-tax").value = formatBrPctInput(s.taxRate);
        if ($("#set-meta-tax")) $("#set-meta-tax").value = formatBrPctInput(state.settings.metaTaxRate);
        $("#team-name").textContent = s.teamName;
        $("#team-plan").textContent = s.teamPlan;
        await loadDashboard({ force: false });
        status.className = "form-status ok";
        status.textContent = "Ajustes salvos.";
      } catch (err) {
        status.className = "form-status err";
        status.textContent = err.message;
      }
    });

    const taxInput = $("#set-tax");
    taxInput?.addEventListener("blur", () => {
      taxInput.value = formatBrPctInput(parseBrNumber(taxInput.value));
    });
    const metaTaxInput = $("#set-meta-tax");
    metaTaxInput?.addEventListener("blur", () => {
      metaTaxInput.value = formatBrPctInput(parseBrNumber(metaTaxInput.value));
    });
  }

  async function bootApp() {
    await Promise.all([loadCredentials(), loadMetaCreds(), loadSettingsUi()]);
    if (state.configured) await loadDashboard({ force: false });
    else {
      renderKpis({});
      renderSuggestions(null);
      renderChart([]);
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
