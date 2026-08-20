(() => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];

  const TOKEN_KEY = "metricly_access_token";
  const USER_KEY = "metricly_user";
  const THEME_KEY = "afiliados_theme";

  /* ─── Push / Browser Notifications ─── */
  const SyncNotify = (() => {
    let _lastSyncedAt = null;

    function _showPermBanner() {
      if (!("Notification" in window)) return;
      if (Notification.permission !== "default") return;
      if (document.getElementById("push-perm-banner")) return;

      const banner = document.createElement("div");
      banner.id = "push-perm-banner";
      banner.innerHTML = `
        <div class="push-perm-banner">
          <span>🔔 Ative as notificações para receber alertas de vendas no celular</span>
          <button id="push-perm-allow">Ativar</button>
          <button id="push-perm-dismiss" title="Fechar">✕</button>
        </div>`;
      document.body.prepend(banner);
      document.getElementById("push-perm-allow").addEventListener("click", () => {
        banner.remove();
        _doRegister();
      });
      document.getElementById("push-perm-dismiss").addEventListener("click", () => {
        banner.remove();
        localStorage.setItem("push_perm_dismissed", "1");
      });
    }

    async function _doRegister() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const perm = await Notification.requestPermission();
        if (perm !== "granted") return;

        const res = await fetch("/api/push/public-key");
        const { key } = await res.json();
        if (!key) return;

        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(key),
          });
        }

        const token = localStorage.getItem(TOKEN_KEY);
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(sub.toJSON()),
        });
      } catch (e) {
        console.warn("[push] registro falhou:", e);
      }
    }

    async function registerPush() {
      if (Notification.permission === "granted") {
        await _doRegister();
      } else if (Notification.permission === "default" && !localStorage.getItem("push_perm_dismissed")) {
        _showPermBanner();
      }
    }

    function urlBase64ToUint8Array(base64String) {
      const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
      const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
      const raw = atob(base64);
      const arr = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
      return arr;
    }

    function _toastCommission({ com, lucro, pedidos }) {
      let container = document.getElementById("sync-toast-container");
      if (!container) {
        container = document.createElement("div");
        container.id = "sync-toast-container";
        document.body.appendChild(container);
      }
      const lucroStr = Number(lucro || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      const el = document.createElement("div");
      el.className = "sync-toast sync-toast--comissao";
      el.innerHTML = `
        <div class="sync-toast__card onda-bg">
          <svg class="onda-svg" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0,80 C80,20 160,110 280,50 C340,20 380,60 420,30" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="28"/>
            <path d="M-20,110 C100,150 200,40 320,100 C380,130 420,80 460,110" fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="36"/>
          </svg>
          <div class="vinheta"></div>
          <div class="sync-toast__inner">
            <div class="sync-toast__icone">
              <img src="/assets/push/shopee-bag-72.png" alt="" width="56" height="56">
            </div>
            <div class="sync-toast__body">
              <div class="sync-toast__titulo">Lucro Líquido</div>
              <div class="sync-toast__valor">R$ ${lucroStr}</div>
            </div>
          </div>
        </div>`;
      container.appendChild(el);
      setTimeout(() => { el.classList.add("sync-toast--hide"); setTimeout(() => el.remove(), 400); }, 8000);
    }

    function _toast(msg, type = "ok") {
      let container = document.getElementById("sync-toast-container");
      if (!container) {
        container = document.createElement("div");
        container.id = "sync-toast-container";
        container.style.cssText =
          "position:fixed;top:18px;right:18px;z-index:99999;display:flex;flex-direction:column;gap:10px;pointer-events:none;";
        document.body.appendChild(container);
      }
      const el = document.createElement("div");
      el.className = "sync-toast sync-toast--" + type;
      el.innerHTML = msg;
      container.appendChild(el);
      setTimeout(() => { el.classList.add("sync-toast--hide"); setTimeout(() => el.remove(), 400); }, 6000);
    }

    function notify(dash, { userTriggered = false } = {}) {
      const syncedAt = dash.syncedAt || null;
      if (!syncedAt) return;
      if (_lastSyncedAt === null) { _lastSyncedAt = syncedAt; return; }
      if (syncedAt === _lastSyncedAt) return;
      _lastSyncedAt = syncedAt;
      if (userTriggered) return;

      const com = Number(dash.kpis?.comissao || 0);
      const lucro = Number(dash.kpis?.lucro || 0);
      const pedidos = Number(dash.kpis?.pedidos || 0);
      if (lucro <= 0 && com <= 0) return;

      _toastCommission({ com, lucro, pedidos });
    }

    return { registerPush, notify };
  })();

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
    produtos: "Backup",
    supercomissoes: "Radar de Supercomissões",
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
    claudeConfigured: false,
    iaChat: [],
    iaBusy: false,
    iaUsage: {
      sessionIn: 0,
      sessionOut: 0,
      sessionCostUsd: 0,
      last: null,
      pricingLabel: "Sonnet",
    },
    settings: {
      taxRate: 11.7,
      metaTaxRate: 12,
      metaBase: 863959,
      metaDias: null,
      metaBonus100: 1,
      metaBonus125: 2,
      metaBonus150: 3,
      teamName: "SaaS SHOPPE",
      teamPlan: "Shopee · Meta",
    },
    periodPreset: "7d",
    cfgTab: "conexoes",
    subidPage: 1,
    subidVisible: 40,
    opsPage: 1,
    opsVisible: 40,
    opsPageSize: 25,
    expandedSubIds: {},
    pageSize: 40,
    dataRows: [],
    dataHeaders: [],
    dataKind: null,
    dataPage: 1,
    dataPageSize: 10,
    dataColFilters: {},
    dataSort: { key: null, dir: "asc" },
    subidSort: { key: null, dir: "asc" },
    opsSort: { key: "status", dir: "asc" },
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
  function formatBrMoneyInput(v) {
    return Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function formatMetaMensalProgress(fatBruto, metaMensal) {
    const meta = Number(metaMensal) || 0;
    const fat = Number(fatBruto) || 0;
    if (meta <= 0) return { headline: "—", barPct: 0, fat, meta, ratio: 0, detailPct: "—" };
    const ratio = fat / meta;
    const pct = ratio * 100;
    const barPct = Math.min(100, pct);
    const headline = ratio >= 10
      ? `${ratio.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}× da meta`
      : `${pct.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}% da meta`;
    return {
      headline,
      barPct,
      fat,
      meta,
      ratio,
      detailPct: `${pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`,
    };
  }
  function isCurrentMonthPeriod() {
    if (state.periodPreset === "month") return true;
    const start = state.dash?.range?.startDate || $("#start-date")?.value;
    const end = state.dash?.range?.endDate || $("#end-date")?.value;
    return start === monthStartISO() && end === yesterdayISO();
  }
  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function brtTodayISO(date = new Date()) {
    const ms = date.getTime() - 3 * 3600 * 1000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  function brtSubtractDays(days, refIso) {
    const [y, m, d] = String(refIso).slice(0, 10).split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d - Number(days || 0)));
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
  }
  /** Shopee/Meta diário: último dia útil = ontem BRT (conversionReport não traz o dia corrente). */
  function shopeeEndDate() {
    return brtSubtractDays(1, brtTodayISO());
  }
  function todayISO() {
    return brtTodayISO();
  }
  function yesterdayISO() {
    return shopeeEndDate();
  }
  function daysAgoISO(n) {
    return brtSubtractDays(n, brtTodayISO());
  }
  function daysAgoFromShopeeEnd(n) {
    return brtSubtractDays(n, shopeeEndDate());
  }
  function monthStartISO() {
    return `${brtTodayISO().slice(0, 7)}-01`;
  }
  function monthPreviousRangeISO() {
    const [y, m] = brtTodayISO().slice(0, 7).split("-").map(Number);
    const py = m === 1 ? y - 1 : y;
    const pm = m === 1 ? 12 : m - 1;
    const start = `${py}-${String(pm).padStart(2, "0")}-01`;
    const last = new Date(Date.UTC(py, pm, 0)).getUTCDate();
    const end = `${py}-${String(pm).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
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

  const inflight = new Map();

  async function api(path, opts = {}) {
    const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const dedupeKey = opts.dedupeKey;
    if (dedupeKey && inflight.has(dedupeKey)) {
      try { inflight.get(dedupeKey).abort(); } catch (_) { /* ignore */ }
    }
    const ctrl = opts.signal ? null : new AbortController();
    const signal = opts.signal || ctrl.signal;
    if (dedupeKey && ctrl) inflight.set(dedupeKey, ctrl);
    const { dedupeKey: _dk, ...fetchOpts } = opts;
    let res;
    try {
      res = await fetch(path, { ...fetchOpts, headers, signal });
    } catch (e) {
      if (e?.name === "AbortError") {
        const err = new Error("aborted");
        err.code = "ABORTED";
        throw err;
      }
      throw e;
    } finally {
      if (dedupeKey && inflight.get(dedupeKey) === ctrl) inflight.delete(dedupeKey);
    }
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
  // Shared by BackupUI and other modules loaded before/after app.js
  window.api = api;

  function setCfgTab(tab) {
    const allowed = ["conexoes", "impostos", "metas", "indefinidos"];
    const key = allowed.includes(tab) ? tab : "conexoes";
    state.cfgTab = key;
    $$("#cfg-subnav .cfg-subnav-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.cfgTab === key);
    });
    $$(".cfg-panel").forEach((p) => {
      p.classList.toggle("hidden", p.dataset.cfgPanel !== key);
    });
    if (key === "indefinidos") renderIndefinidos();
  }

  function openConfig(tab = "conexoes") {
    setView("config");
    setCfgTab(tab);
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
    $("#view-supercomissoes")?.classList.toggle("hidden", view !== "supercomissoes");
    $("#view-analise-ia")?.classList.toggle("hidden", view !== "analise-ia");
    $("#view-canais")?.classList.toggle("hidden", view !== "canais");
    $("#view-config").classList.toggle("hidden", view !== "config");
    $("#view-data").classList.toggle("hidden", !isData);
    const label = VIEW_LABELS[state.navKey] || VIEW_LABELS[navKey] || VIEW_LABELS[view] || view;
    $("#crumb-label").textContent = label;
    setSidebarOpen(false);

    if (view === "dashboard") applyChannelView();
    if (view === "supercomissoes") mountRadarPage();
    if (view === "analise-ia") {
      mountIaChat();
      updateIaTokenBoard();
      updateIaPeriodPill();
      loadClaudeCreds();
    }
    if (view === "canais") renderOpsTable();
    if (view === "config") {
      setCfgTab(navKey === "integracoes" ? "conexoes" : state.cfgTab || "conexoes");
      if (state.cfgTab === "indefinidos") renderIndefinidos();
    }
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
    const invMetaTaxed = hasData
      ? Number(k.inv_meta_taxed != null ? k.inv_meta_taxed : invMeta || 0)
      : null;
    const metaHasTax = hasData && invMeta > 0 && invMetaTaxed > invMeta + 0.005;
    const lucro = !hasData ? null : (k.lucro != null ? Number(k.lucro) : Number(k.comissao || 0) - Number(invTotal || 0));
    const roi = hasData ? k.roi : null;
    const hasRoi = hasData && invTotal > 0 && Number.isFinite(Number(roi));
    const subs = hasData && subCount != null ? fmtNum(subCount) : "—";
    const fat = hasData ? Number(k.faturamento || 0) : null;
    const com = hasData ? Number(k.comissao || 0) : null;
    const el = $("#kpi-grid");
    if (!el) return;

    const money = (v) => (v == null || Number.isNaN(Number(v)) ? "—" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

    el.innerHTML = `
      <div class="kpi-hero relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-700 text-white rounded-2xl p-4 sm:p-5 shadow-lg shadow-emerald-500/10 min-w-0">
        <div class="absolute -right-6 -bottom-6 w-28 h-28 bg-white/10 rounded-full blur-2xl pointer-events-none" aria-hidden="true"></div>
        <div class="relative flex items-center justify-between mb-3 gap-2 min-w-0">
          <span class="text-xs font-bold uppercase tracking-wider text-emerald-100 flex items-center gap-1.5 min-w-0">
            <img src="/assets/lucro.png" alt="" width="18" height="18" class="rounded-sm drop-shadow shrink-0" /> Lucro Líquido
          </span>
        </div>
        <div class="relative mb-4 min-w-0">
          <div class="kpi-hero-value text-white">
            <span class="text-lg font-bold text-emerald-200 shrink-0">R$</span>
            <span>${money(lucro)}</span>
          </div>
          <p class="text-[11px] text-emerald-100/90 mt-1 font-medium">Lucro real após mídia e impostos</p>
        </div>
        <div class="relative grid grid-cols-2 gap-1.5 sm:gap-2 pt-3 border-t border-white/20 text-center min-w-0">
          <div class="bg-black/10 p-1.5 rounded-xl min-w-0">
            <p class="text-[10px] text-emerald-100">ROI</p>
            <p class="text-xs font-extrabold text-white break-words">${fmtPct(hasRoi ? roi : null)}</p>
          </div>
          <div class="bg-black/10 p-1.5 rounded-xl min-w-0">
            <p class="text-[10px] text-emerald-100">SubIDs</p>
            <p class="text-xs font-extrabold text-white break-words">${subs}</p>
          </div>
        </div>
      </div>

      <div class="kpi-hero relative overflow-hidden bg-gradient-to-br from-orange-500 via-orange-600 to-red-600 text-white rounded-2xl p-4 sm:p-5 shadow-lg shadow-orange-500/10 min-w-0">
        <div class="absolute -right-6 -bottom-6 w-28 h-28 bg-white/10 rounded-full blur-2xl pointer-events-none" aria-hidden="true"></div>
        <div class="relative flex items-center justify-between mb-3 gap-2 min-w-0">
          <span class="text-xs font-bold uppercase tracking-wider text-orange-100 flex items-center gap-1.5 min-w-0">
            <img src="/assets/shopee.png" alt="" width="16" height="16" class="shrink-0" /> Comissão Shopee Total
          </span>
          <span class="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-md font-bold shrink-0">Shopee API</span>
        </div>
        <div class="relative mb-4 min-w-0">
          <div class="kpi-hero-value text-white">
            <span class="text-lg font-bold text-orange-200 shrink-0">R$</span>
            <span>${money(com)}</span>
          </div>
          <p class="text-[11px] text-orange-100/90 mt-1 font-medium">Comissão gerada pelos SubIDs no período</p>
        </div>
        <div class="relative kpi-hero-foot bg-black/10 p-2.5 rounded-xl mt-auto">
          <span class="text-xs text-orange-100 shrink-0">Faturamento bruto:</span>
          <span class="text-xs font-black text-white">${fmt(fat)}</span>
        </div>
      </div>

      <div class="kpi-hero relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 text-white rounded-2xl p-4 sm:p-5 shadow-lg shadow-blue-500/10 min-w-0">
        <div class="absolute -right-6 -bottom-6 w-28 h-28 bg-white/10 rounded-full blur-2xl pointer-events-none" aria-hidden="true"></div>
        <div class="relative flex items-center justify-between mb-3 gap-2 min-w-0">
          <span class="text-xs font-bold uppercase tracking-wider text-blue-100 flex items-center gap-1.5 min-w-0">
            <img src="/assets/meta.png" alt="" width="16" height="16" class="shrink-0" /> Invest. Meta Ads
          </span>
          <span class="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-md font-bold shrink-0">Meta Ads</span>
        </div>
        <div class="relative mb-4 min-w-0">
          <div class="kpi-hero-value text-white">
            <span class="text-lg font-bold text-blue-200 shrink-0">R$</span>
            <span>${money(invMeta)}</span>
          </div>
          <p class="text-[11px] text-blue-100/90 mt-1 font-medium">${hasData ? (invMeta > 0 ? (metaHasTax ? `c/ imposto Meta · ${fmt(invMetaTaxed)}` : "Sincronizado via API") : "Sem sync Meta neste período") : "—"}</p>
        </div>
        <div class="relative kpi-hero-foot bg-black/10 p-2.5 rounded-xl mt-auto">
          <span class="text-xs text-blue-100 shrink-0">Taxado no ROI:</span>
          <span class="text-xs font-black text-white">${hasData && invMeta > 0 ? (metaHasTax ? "Sim" : "Não") : "—"}</span>
        </div>
      </div>

      <div class="kpi-hero relative overflow-hidden bg-gradient-to-br from-rose-500 via-rose-600 to-red-600 text-white rounded-2xl p-4 sm:p-5 shadow-lg shadow-rose-500/10 min-w-0">
        <div class="absolute -right-6 -bottom-6 w-28 h-28 bg-white/10 rounded-full blur-2xl pointer-events-none" aria-hidden="true"></div>
        <div class="relative flex items-center justify-between mb-3 gap-2 min-w-0">
          <span class="text-xs font-bold uppercase tracking-wider text-rose-100 flex items-center gap-1.5 min-w-0">
            <img src="/assets/pinterest.png" alt="" width="16" height="16" class="shrink-0" /> Invest. Pinterest
          </span>
          <span class="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-md font-bold shrink-0">CSV</span>
        </div>
        <div class="relative mb-4 min-w-0">
          <div class="kpi-hero-value text-white">
            <span class="text-lg font-bold text-rose-200 shrink-0">R$</span>
            <span>${money(invPin)}</span>
          </div>
          <p class="text-[11px] text-rose-100/90 mt-1 font-medium">${hasData ? (invPin > 0 ? "Somente gasto Pinterest (CSV)" : "Nenhum gasto neste período") : "—"}</p>
        </div>
        <div class="relative kpi-hero-foot bg-black/10 p-2.5 rounded-xl mt-auto">
          <span class="text-xs text-rose-100 shrink-0">Status:</span>
          <span class="text-xs font-black text-white">${hasData && invPin > 0 ? "Ativo" : "Inativo"}</span>
        </div>
      </div>`;
  }

  function daysInMonthISO(iso) {
    const [y, m] = String(iso || todayISO()).split("-").map(Number);
    return new Date(y, m, 0).getDate();
  }

  function metaBonusTiers() {
    const b100 = Number(state.settings.metaBonus100 != null ? state.settings.metaBonus100 : 1) / 100;
    const b125 = Number(state.settings.metaBonus125 != null ? state.settings.metaBonus125 : 2) / 100;
    const b150 = Number(state.settings.metaBonus150 != null ? state.settings.metaBonus150 : 3) / 100;
    return [
      { mult: 1, bonus: b100, label: "Meta 100%", sub: "Base", key: "base" },
      { mult: 1.25, bonus: b125, label: "Meta 125%", sub: "Turbo", key: "turbo" },
      { mult: 1.5, bonus: b150, label: "Meta 150%", sub: "VIP Max", key: "vip" },
    ];
  }

  function avgFaturamentoLastDays(n = 7) {
    const fromApi = Number(state.dash?.kpis?.faturamentoAvg7);
    if (Number.isFinite(fromApi) && fromApi > 0) return fromApi;

    const ym = todayISO().slice(0, 7);
    const rows = [...(state.dash?.daily || [])]
      .filter((d) => d && d.data && String(d.data).startsWith(ym))
      .sort((a, b) => String(a.data).localeCompare(String(b.data)));
    if (!rows.length) {
      const mtd = Number(state.dash?.kpis?.faturamentoMtd || 0);
      const diasPassados = Number(String(todayISO()).slice(8, 10)) || 1;
      return diasPassados > 0 ? mtd / diasPassados : 0;
    }
    const slice = rows.slice(-Math.max(1, n));
    const sum = slice.reduce((acc, d) => acc + Number(d.faturamento || 0), 0);
    return sum / slice.length;
  }

  function fmtPct1(v) {
    if (v == null || Number.isNaN(Number(v))) return "—";
    return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
  }

  function cicloMetaLabel() {
    const now = new Date();
    const mes = now.toLocaleDateString("pt-BR", { month: "long" });
    const mesCap = mes.charAt(0).toUpperCase() + mes.slice(1);
    return `Ciclo ${mesCap}/${now.getFullYear()}`;
  }

  function renderMetaProgressCard(k) {
    const el = $("#meta-progress-card");
    if (!el) return;
    const hasData = Boolean(state.dash);
    const base = Number(state.settings.metaBase || 0);
    const fat = hasData ? Number(k?.faturamentoMtd ?? state.dash?.kpis?.faturamentoMtd ?? 0) : 0;
    const today = todayISO();
    const totalDias = Number(state.settings.metaDias) > 0
      ? Number(state.settings.metaDias)
      : daysInMonthISO(today);
    const diasPassados = Number(String(today).slice(8, 10)) || 1;
    const diasRestantes = Math.max(0, totalDias - diasPassados);
    let expanded = false;
    try { expanded = localStorage.getItem("afilia:metaProjOpen") === "1"; } catch (_) { /* ignore */ }

    if (!base) {
      el.innerHTML = `
        <section class="surface-card overflow-hidden meta-proj-panel" id="meta-proj-panel">
          <div class="meta-proj-empty">
            <div>
              <h3 class="meta-proj-title">Metas e bônus do mês</h3>
              <p class="meta-proj-empty-sub">Defina a meta 100% em Configurações para acompanhar o ritmo e o bônus por faixa.</p>
            </div>
            <button type="button" class="meta-proj-btn-params" data-goto-cfg="1">Definir meta</button>
          </div>
        </section>`;
      el.querySelector("[data-goto-cfg]")?.addEventListener("click", () => openConfig("metas"));
      return;
    }

    const avg7 = hasData
      ? Number(k?.faturamentoAvg7 ?? state.dash?.kpis?.faturamentoAvg7 ?? avgFaturamentoLastDays(7))
      : 0;
    const projected = fat + avg7 * diasRestantes;
    const tiers = metaBonusTiers().map((t) => {
      const alvo = base * t.mult;
      const bonusVal = alvo * t.bonus;
      const falta = Math.max(0, alvo - fat);
      const diario = diasRestantes > 0 ? falta / diasRestantes : (falta > 0.005 ? null : 0);
      const pct = alvo > 0 ? Math.min(1, fat / alvo) : 0;
      const atingida = hasData && fat >= alvo;
      const reachable = hasData && (atingida || (diario != null && avg7 >= diario - 0.005) || projected >= alvo);
      return { ...t, alvo, bonusVal, falta, diario, pct, atingida, reachable };
    });
    let recIdx = -1;
    for (let i = 0; i < tiers.length; i++) {
      if (tiers[i].reachable) recIdx = i;
    }
    if (recIdx < 0 && tiers.length) recIdx = 0;
    const m1 = tiers[0];
    const rec = tiers[recIdx] || m1;
    const ritmo100 = m1?.diario;
    const pctM1 = m1 ? m1.pct * 100 : 0;
    const bonusPctLabel = (b) =>
      (b * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";

    const tierCards = tiers.map((c, i) => {
      const isRec = i === recIdx;
      const pctW = Math.max(0, Math.min(100, c.pct * 100));
      return `
        <article class="meta-tier meta-tier--${c.key}${isRec ? " is-recommended" : ""}${c.atingida ? " is-done" : ""}">
          ${isRec ? `<span class="meta-tier-tag">No ritmo</span>` : ""}
          <div class="meta-tier-top">
            <div>
              <div class="meta-tier-name">${escapeHtml(c.label)}</div>
              <div class="meta-tier-alvo">Meta: <b>${fmt(c.alvo)}</b></div>
            </div>
            <span class="meta-tier-bonus-badge">+${bonusPctLabel(c.bonus)}</span>
          </div>
          <div class="meta-tier-bonus-box">
            <span>Bônus estimado</span>
            <strong>${fmt(c.bonusVal)}</strong>
          </div>
          <div class="meta-tier-prog">
            <div class="meta-tier-bar"><span style="width:${pctW.toFixed(1)}%"></span></div>
            <span class="meta-tier-pct">${c.atingida ? "ok" : fmtPct1(pctW)}</span>
          </div>
          <div class="meta-tier-falta">${c.atingida ? "Faixa atingida" : `Falta <b>${fmt(c.falta)}</b>`}${
            !c.atingida && c.diario != null ? ` · ${fmt(c.diario)}/dia` : ""
          }</div>
        </article>`;
    }).join("");

    const cmpHead = tiers.map((c) =>
      `<th>${escapeHtml(c.label)}</th>`
    ).join("");
    const rowAlvo = tiers.map((c) => `<td>${fmt(c.alvo)}</td>`).join("");
    const rowFalta = tiers.map((c) => `<td>${fmt(c.falta)}</td>`).join("");
    const rowBonus = tiers.map((c, i) =>
      `<td class="${i === recIdx ? "is-hl" : ""}">${fmt(c.bonusVal)}</td>`
    ).join("");
    const rowDiario = tiers.map((c) =>
      `<td>${c.diario == null ? "—" : `${fmt(c.diario)}/dia`}</td>`
    ).join("");

    const pacingTxt = hasData && avg7 > 0
      ? `Com a média dos últimos 7 dias (${fmt(avg7)}/dia), a faixa mais próxima no ritmo atual é <b>${escapeHtml(rec.label)}</b> — bônus estimado <b>${fmt(rec.bonusVal)}</b>.`
      : "Sincronize a Shopee para calcular o ritmo dos últimos 7 dias.";

    el.innerHTML = `
      <section class="surface-card overflow-hidden meta-proj-panel ${expanded ? "is-open" : ""}" id="meta-proj-panel">
        <div class="meta-proj-head">
          <div class="meta-proj-head-main">
            <div class="meta-proj-title-row">
              <h3 class="meta-proj-title">Metas e bônus do mês</h3>
              <span class="meta-proj-ciclo">${escapeHtml(cicloMetaLabel())}</span>
            </div>
            <p class="meta-proj-sub">
              ${diasRestantes} dia${diasRestantes === 1 ? "" : "s"} restantes
              ${ritmo100 != null ? ` · para 100%: <b>${fmt(ritmo100)}/dia</b>` : ""}
            </p>
          </div>
          <div class="meta-proj-head-stats">
            <div class="meta-proj-stat">
              <span class="meta-proj-stat-lab">Realizado</span>
              <span class="meta-proj-stat-val">${hasData ? fmt(fat) : "—"}</span>
            </div>
            <div class="meta-proj-stat">
              <span class="meta-proj-stat-lab">Atingimento</span>
              <span class="meta-proj-stat-val meta-proj-stat-val--pct">${hasData ? fmtPct1(pctM1) : "—"}</span>
            </div>
            <button type="button" class="meta-proj-collapse" id="btn-meta-proj-toggle" aria-expanded="${expanded ? "true" : "false"}">
              <span class="meta-proj-expand-lab">${expanded ? "Recolher" : "Detalhes"}</span>
              <i class="fa-solid fa-chevron-${expanded ? "up" : "down"}" aria-hidden="true"></i>
            </button>
          </div>
        </div>
        <div class="meta-proj-body ${expanded ? "" : "hidden"}" id="meta-proj-body">
          <div class="meta-tier-grid">${tierCards}</div>
          <div class="meta-cmp">
            <div class="meta-cmp-head">
              <h4>Comparativo por faixa</h4>
            </div>
            <div class="table-scroll">
              <table class="meta-cmp-table">
                <thead>
                  <tr>
                    <th class="l"></th>
                    ${cmpHead}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td class="l">Alvo</td>
                    ${rowAlvo}
                  </tr>
                  <tr>
                    <td class="l">Falta</td>
                    ${rowFalta}
                  </tr>
                  <tr>
                    <td class="l">Bônus</td>
                    ${rowBonus}
                  </tr>
                  <tr>
                    <td class="l">Por dia (${diasRestantes}d)</td>
                    ${rowDiario}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="meta-proj-foot">
            <p class="meta-proj-pacing">${pacingTxt}</p>
            <button type="button" class="meta-proj-btn-params" data-goto-cfg="1">Ajustar meta</button>
          </div>
        </div>
      </section>`;

    el.querySelector("[data-goto-cfg]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      openConfig("metas");
    });
    el.querySelector("#btn-meta-proj-toggle")?.addEventListener("click", () => {
      const panel = $("#meta-proj-panel");
      const body = $("#meta-proj-body");
      const btn = $("#btn-meta-proj-toggle");
      if (!panel || !body || !btn) return;
      const open = !panel.classList.contains("is-open");
      panel.classList.toggle("is-open", open);
      body.classList.toggle("hidden", !open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      const lab = btn.querySelector(".meta-proj-expand-lab");
      if (lab) lab.textContent = open ? "Recolher" : "Expandir";
      const icon = btn.querySelector("i");
      if (icon) icon.className = `fa-solid fa-chevron-${open ? "up" : "down"}`;
      try { localStorage.setItem("afilia:metaProjOpen", open ? "1" : "0"); } catch (_) { /* ignore */ }
    });
  }

  const KPI_ICONS = {
    faturamento: "/assets/icons/kpi/faturamento.png",
    comissao: "/assets/icons/kpi/comissao.png",
    investimento_meta: "/assets/meta.png",
    investimento_pin: "/assets/pinterest.png",
    lucro: "/assets/icons/kpi/lucro.png",
    roi: "/assets/icons/kpi/roi.png",
    pedidos: "/assets/icons/kpi/pedidos.png",
    cliques: "/assets/icons/kpi/cliques.png",
    abatimento: "/assets/icons/kpi/abatimento.png",
  };

  const CHANNEL_HERO = {
    orange: {
      card: "from-orange-500 via-orange-600 to-red-600 shadow-orange-500/15",
      label: "text-orange-100",
      currency: "text-orange-200",
      soft: "text-orange-100/85",
    },
    emerald: {
      card: "from-emerald-600 via-emerald-600 to-teal-700 shadow-emerald-500/15",
      label: "text-emerald-100",
      currency: "text-emerald-200",
      soft: "text-emerald-100/85",
    },
    meta: {
      card: "from-blue-600 via-indigo-600 to-blue-700 shadow-blue-500/15",
      label: "text-blue-100",
      currency: "text-blue-200",
      soft: "text-blue-100/85",
    },
    pin: {
      card: "from-rose-500 via-rose-600 to-red-600 shadow-rose-500/15",
      label: "text-rose-100",
      currency: "text-rose-200",
      soft: "text-rose-100/85",
    },
    rose: {
      card: "from-rose-500 via-rose-600 to-red-600 shadow-rose-500/15",
      label: "text-rose-100",
      currency: "text-rose-200",
      soft: "text-rose-100/85",
    },
    indigo: {
      card: "from-indigo-500 via-indigo-600 to-violet-700 shadow-indigo-500/15",
      label: "text-indigo-100",
      currency: "text-indigo-200",
      soft: "text-indigo-100/85",
    },
    sky: {
      card: "from-sky-500 via-sky-600 to-cyan-700 shadow-sky-500/15",
      label: "text-sky-100",
      currency: "text-sky-200",
      soft: "text-sky-100/85",
    },
    amber: {
      card: "from-amber-500 via-amber-600 to-orange-600 shadow-amber-500/15",
      label: "text-amber-100",
      currency: "text-amber-200",
      soft: "text-amber-100/85",
    },
  };

  function channelMetricCard(label, value, tone, iconKey, hint) {
    const theme = CHANNEL_HERO[tone] || CHANNEL_HERO.orange;
    const isMoney = String(value).startsWith("R$");
    let currency = "";
    let amount = value;
    if (isMoney) {
      currency = "R$";
      amount = String(value).replace(/^R\$\s*/, "");
    }
    return `<article class="channel-hero relative overflow-hidden bg-gradient-to-br ${theme.card} text-white rounded-2xl p-4 shadow-lg min-w-0">
      <div class="absolute -right-5 -bottom-5 w-20 h-20 bg-white/10 rounded-full blur-2xl pointer-events-none" aria-hidden="true"></div>
      <div class="relative mb-2.5 min-w-0">
        <span class="text-[10px] font-bold uppercase tracking-wider ${theme.label}">${escapeHtml(label)}</span>
      </div>
      <div class="relative min-w-0">
        ${isMoney
          ? `<div class="kpi-hero-value text-white channel-hero-value"><span class="text-base font-bold ${theme.currency} shrink-0">${currency}</span><span>${amount}</span></div>`
          : `<p class="channel-hero-value text-white font-black tracking-tight">${value}</p>`}
        ${hint ? `<p class="channel-hero-hint">${escapeHtml(hint)}</p>` : ""}
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
    const invMeta = k?.inv_meta;
    const hasRoi = hasData && Number(k?.inv_total) > 0 && Number.isFinite(Number(k?.roi));
    const lucroTone = lucroNeg ? "rose" : "emerald";
    const roiTone = roiNeg ? "rose" : "emerald";

    let cards = [];
    if (ch === "meta") {
      cards = [
        ["Faturamento", money(k?.faturamento), "orange", "faturamento"],
        ["Comissão", money(k?.comissao), "emerald", "comissao"],
        ["Investimento Meta", money(invMeta), "meta", "investimento_meta"],
        ["Lucro", money(k?.lucro), lucroTone, "lucro"],
        ["ROI", pct(hasRoi ? k?.roi : null), roiTone, "roi"],
        ["Pedidos", num(k?.pedidos), "indigo", "pedidos", "Validados"],
        ["Cliques Shopee", num(k?.cliques_shopee), "sky", "cliques"],
        ["Abatimento", pct(k?.abatimento_cliques), "amber", "abatimento"],
      ];
    } else if (ch === "pinterest") {
      cards = [
        ["Faturamento", money(k?.faturamento), "orange", "faturamento"],
        ["Comissão", money(k?.comissao), "emerald", "comissao"],
        ["Investimento Pinterest", money(k?.inv_pin), "pin", "investimento_pin"],
        ["Lucro", money(k?.lucro), lucroTone, "lucro"],
        ["ROI", pct(hasRoi ? k?.roi : null), roiTone, "roi"],
        ["Pedidos", num(k?.pedidos), "indigo", "pedidos", "Validados"],
        ["Cliques Shopee", num(k?.cliques_shopee), "sky", "cliques"],
        ["Abatimento", pct(k?.abatimento_cliques), "amber", "abatimento"],
      ];
    } else if (ch === "organico") {
      cards = [
        ["Faturamento", money(k?.faturamento), "orange", "faturamento"],
        ["Comissão", money(k?.comissao), "emerald", "comissao"],
        ["Pedidos", num(k?.pedidos), "indigo", "pedidos", "Validados"],
        ["Cliques Shopee", num(k?.cliques_shopee), "sky", "cliques"],
      ];
    }

    const cancelados = Number(k?.cancelados || 0);
    const unpaid = Number(k?.unpaid || 0);
    let alertHtml = "";
    if (hasData && (cancelados > 0 || unpaid > 0)) {
      const bits = [];
      if (cancelados > 0) bits.push(`<strong>${fmtNum(cancelados)}</strong> cancelado${cancelados === 1 ? "" : "s"}`);
      if (unpaid > 0) bits.push(`<strong>${fmtNum(unpaid)}</strong> não pago${unpaid === 1 ? "" : "s"}`);
      alertHtml = `<p class="channel-kpi-alert" role="status"><i class="fa-solid fa-circle-info" aria-hidden="true"></i><span>O card Pedidos conta só os <strong>validados</strong> (concluídos + pendentes). ${bits.join(" e ")} ficam de fora — não entram em faturamento nem comissão.</span></p>`;
    }

    el.innerHTML = `<div class="channel-kpi-metrics channel-kpi-metrics--${cards.length}">${cards.map(([lab, val, tone, icon, hint]) => channelMetricCard(lab, val, tone, icon, hint)).join("")}</div>${alertHtml}`;
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

  function ensureChartJs() {
    if (typeof Chart !== "undefined") return Promise.resolve(true);
    if (window._chartJsLoading) return window._chartJsLoading;
    window._chartJsLoading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js";
      s.async = true;
      s.onload = () => resolve(true);
      s.onerror = () => reject(new Error("Chart.js"));
      document.head.appendChild(s);
    });
    return window._chartJsLoading;
  }

  async function ensureBackupUi() {
    if (window.BackupUI) return window.BackupUI;
    if (!document.querySelector("link[data-backup-css]")) {
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = "/backup.css?v=pro-3";
      l.dataset.backupCss = "1";
      document.head.appendChild(l);
    }
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "/backup.js?v=pro-2";
      s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error("backup.js"));
      document.body.appendChild(s);
    });
    return window.BackupUI;
  }

  async function ensureRadarUi() {
    if (window.RadarUI) return window.RadarUI;
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "/radar.js?v=4";
      s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error("radar.js"));
      document.body.appendChild(s);
    });
    return window.RadarUI;
  }

  async function mountRadarPage() {
    try {
      const ui = await ensureRadarUi();
      if (ui) await ui.mount();
    } catch (e) {
      console.warn(e);
    }
  }

  function debounce(fn, ms) {
    let t = 0;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  function isMobileLayout() {
    return window.matchMedia("(max-width: 640px)").matches;
  }

  function setDashLoading(on) {
    $("#view-dashboard")?.classList.toggle("is-loading", !!on);
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

    const paint = () => paintProfitChart(host, rows);
    if (typeof Chart === "undefined") {
      host.innerHTML = `<div class="chart-empty">Carregando gráfico…</div>`;
      ensureChartJs().then(paint).catch(() => {
        host.innerHTML = `<div class="chart-empty">Chart.js não carregou. Recarregue a página.</div>`;
      });
      return;
    }
    paint();
  }

  function paintProfitChart(host, rows) {
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

  function formatIaMarkdown(text) {
    const esc = escapeHtml(String(text || ""));
    return esc
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n{2,}/g, "</p><p>")
      .replace(/\n/g, "<br>");
  }

  function fmtTok(n) {
    const v = Number(n || 0);
    return v.toLocaleString("pt-BR");
  }

  function fmtUsd(n) {
    const v = Number(n || 0);
    const digits = v > 0 && v < 0.01 ? 4 : 2;
    return `US$ ${v.toLocaleString("pt-BR", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })}`;
  }

  function resetIaUsage() {
    state.iaUsage = {
      sessionIn: 0,
      sessionOut: 0,
      sessionCostUsd: 0,
      last: null,
      pricingLabel: state.iaUsage?.pricingLabel || "Sonnet",
    };
    updateIaTokenBoard();
  }

  function updateIaPeriodPill() {
    const el = $("#ia-period-pill");
    if (!el) return;
    const start = $("#start-date")?.value || "—";
    const end = $("#end-date")?.value || "—";
    el.textContent = `Período ${start} → ${end}`;
  }

  function updateIaTokenBoard(extra) {
    const u = state.iaUsage;
    const last = u.last;
    const lastEl = $("#ia-tok-last");
    const lastDet = $("#ia-tok-last-detail");
    const sessEl = $("#ia-tok-session");
    const sessDet = $("#ia-tok-session-detail");
    const costEl = $("#ia-tok-cost");
    const costDet = $("#ia-tok-cost-detail");
    const dataEl = $("#ia-tok-data");
    const dataDet = $("#ia-tok-data-detail");

    if (lastEl) lastEl.textContent = last ? fmtTok(last.totalTokens) : "—";
    if (lastDet) {
      lastDet.textContent = last
        ? `${fmtTok(last.inputTokens)} entrada · ${fmtTok(last.outputTokens)} saída`
        : "Envie uma pergunta para ver tokens";
    }
    if (sessEl) sessEl.textContent = fmtTok(u.sessionIn + u.sessionOut);
    if (sessDet) sessDet.textContent = `${fmtTok(u.sessionIn)} in · ${fmtTok(u.sessionOut)} out`;
    if (costEl) costEl.textContent = fmtUsd(u.sessionCostUsd);
    if (costDet) {
      const rates = last?.rates;
      costDet.textContent = rates
        ? `${rates.label || u.pricingLabel} · in US$${rates.inputPerMTok}/1M · out US$${rates.outputPerMTok}/1M`
        : `Tabela Anthropic · ${u.pricingLabel}`;
    }

    const meta = extra?.contextMeta || last?.contextMeta;
    if (dataEl && dataDet) {
      if (meta) {
        dataEl.textContent = fmtTok(meta.contextApproxTokens || 0);
        dataDet.textContent =
          `${meta.totalSubIds || 0} SubIDs · ${meta.products || 0} produtos · ${meta.orders || 0} pedidos · ` +
          `${meta.campaigns || 0} campanhas · ~${fmtTok(meta.contextApproxTokens || 0)} tok contexto`;
      } else {
        dataEl.textContent = "—";
        dataDet.textContent = "Contexto do banco nesta pergunta";
      }
    }

    const pricingPill = $("#ia-pricing-pill");
    if (pricingPill && last?.rates) {
      pricingPill.textContent =
        `Cobrança: in US$${last.rates.inputPerMTok}/1M · out US$${last.rates.outputPerMTok}/1M tokens`;
    }
  }

  function iaUsageMetaHtml(cost) {
    if (!cost) return "";
    return `<div class="ia-msg-meta">
      <span class="ia-meta-chip ia-meta-chip--tok">${fmtTok(cost.totalTokens)} tokens</span>
      <span class="ia-meta-chip">${fmtTok(cost.inputTokens)} in · ${fmtTok(cost.outputTokens)} out</span>
      <span class="ia-meta-chip ia-meta-chip--cost">${fmtUsd(cost.totalUsd)}</span>
    </div>`;
  }

  function iaWelcomeHtml() {
    if (!state.claudeConfigured) {
      return `<div class="ia-welcome" data-welcome="1">
      <div class="ia-welcome-icon"><img src="/assets/ia.png?v=3" alt="" width="40" height="40" /></div>
      <h2>Conecte sua API do Claude</h2>
      <p>Cada conta usa a própria key da Anthropic (igual Shopee e Meta). Não há key global no servidor.</p>
      <div class="ia-chat-suggestions" id="ia-chat-suggestions">
        <button type="button" class="ia-chip" data-ia-goto-config="1">Abrir Configurações → Conexões</button>
      </div>
    </div>`;
    }
    return `<div class="ia-welcome" data-welcome="1">
      <div class="ia-welcome-icon"><img src="/assets/ia.png?v=3" alt="" width="40" height="40" /></div>
      <h2>Pergunte sobre a operação</h2>
      <p>Ex.: “Qual campanha está com ROI ruim?”</p>
      <div class="ia-chat-suggestions" id="ia-chat-suggestions">
        <button type="button" class="ia-chip" data-prompt="Qual campanha ou SubID está com ROI ruim no período? Liste os piores com invest e ROI.">ROI ruim</button>
        <button type="button" class="ia-chip" data-prompt="Quais SubIDs Meta eu deveria pausar ou escalar agora? Justifique com números.">Pausar / escalar</button>
        <button type="button" class="ia-chip" data-prompt="Como está o progresso da meta de faturamento do mês e o que falta para 100%/125%/150%?">Meta do mês</button>
        <button type="button" class="ia-chip" data-prompt="Resuma top produtos, pedidos e onde está o maior lucro vs maior gasto.">Visão completa</button>
      </div>
    </div>`;
  }

  function wireIaSuggestionChips(root) {
    (root || document).querySelectorAll("#ia-chat-suggestions .ia-chip").forEach((btn) => {
      if (btn.dataset.wired) return;
      btn.dataset.wired = "1";
      btn.addEventListener("click", () => {
        if (btn.dataset.iaGotoConfig) {
          openConfig("conexoes");
          return;
        }
        sendIaChat(btn.dataset.prompt || btn.textContent);
      });
    });
  }

  function appendIaMessage(role, content, { error = false, typing = false, cost = null } = {}) {
    const box = $("#ia-chat-messages");
    if (!box) return null;
    box.querySelector('[data-welcome="1"]')?.remove();
    const el = document.createElement("div");
    el.className = `ia-msg ${role === "user" ? "ia-msg--user" : "ia-msg--bot"}${error ? " is-error" : ""}${typing ? " is-typing" : ""}`;
    const avatar = role === "user"
      ? `<div class="ia-msg-avatar">Você</div>`
      : `<div class="ia-msg-avatar"><img src="/assets/ia.png?v=3" alt="" width="20" height="20" /></div>`;
    const body = typing
      ? `<p class="ia-typing-dots"><span></span><span></span><span></span> Lendo o banco e analisando…</p>`
      : `<p>${formatIaMarkdown(content)}</p>`;
    const meta = role === "assistant" && !typing && !error ? iaUsageMetaHtml(cost) : "";
    el.innerHTML = `${avatar}<div class="ia-msg-col"><div class="ia-msg-bubble">${body}</div>${meta}</div>`;
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
    return el;
  }

  function mountIaChat() {
    const box = $("#ia-chat-messages");
    if (!box) return;
    if (!state.iaChat.length) {
      box.innerHTML = iaWelcomeHtml();
      wireIaSuggestionChips(box);
      return;
    }
    box.innerHTML = "";
    for (const m of state.iaChat) {
      appendIaMessage(m.role, m.content, { error: Boolean(m.error), cost: m.cost || null });
    }
  }

  function clearIaChat() {
    state.iaChat = [];
    resetIaUsage();
    mountIaChat();
    const st = $("#ia-chat-status");
    if (st) {
      st.className = "ia-chat-status";
      st.textContent = "";
    }
  }

  function applyIaUsage(cost, contextMeta) {
    if (!cost) return;
    state.iaUsage.sessionIn += Number(cost.inputTokens || 0);
    state.iaUsage.sessionOut += Number(cost.outputTokens || 0);
    state.iaUsage.sessionCostUsd += Number(cost.totalUsd || 0);
    state.iaUsage.last = { ...cost, contextMeta };
    if (cost.rates?.label) state.iaUsage.pricingLabel = cost.rates.label;
    updateIaTokenBoard({ contextMeta });
  }

  async function sendIaChat(prompt) {
    const text = String(prompt || "").trim();
    if (!text || state.iaBusy) return;
    if (!state.claudeConfigured) {
      const st = $("#ia-chat-status");
      if (st) {
        st.className = "ia-chat-status is-err";
        st.textContent = "Salve a sua API key do Claude em Configurações → Conexões (cada usuário configura a própria).";
      }
      openConfig("conexoes");
      return;
    }

    const input = $("#ia-chat-input");
    if (input) input.value = "";
    state.iaBusy = true;
    $("#btn-ia-send") && ($("#btn-ia-send").disabled = true);
    updateIaPeriodPill();
    appendIaMessage("user", text);
    state.iaChat.push({ role: "user", content: text });
    const typingEl = appendIaMessage("assistant", "", { typing: true });
    const st = $("#ia-chat-status");
    if (st) {
      st.className = "ia-chat-status";
      st.textContent = "Lendo tabelas do Supabase e enviando ao Claude…";
    }

    try {
      const start = $("#start-date")?.value || null;
      const end = $("#end-date")?.value || null;
      const history = state.iaChat
        .filter((m) => !m.error)
        .slice(0, -1)
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));
      const r = await api("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({ message: text, history, start, end }),
      });
      typingEl?.remove();
      const reply = r.reply || "Sem resposta.";
      const cost = r.cost || null;
      appendIaMessage("assistant", reply, { cost });
      state.iaChat.push({ role: "assistant", content: reply, cost });
      applyIaUsage(cost, r.contextMeta);

      if (st) {
        st.className = "ia-chat-status";
        const c = r.cost;
        const meta = r.contextMeta;
        st.textContent = c
          ? `Última: ${fmtTok(c.totalTokens)} tokens (${fmtTok(c.inputTokens)} in / ${fmtTok(c.outputTokens)} out) · ${fmtUsd(c.totalUsd)}` +
            (meta ? ` · contexto ~${fmtTok(meta.contextApproxTokens)} tok` : "")
          : `Modelo ${r.model || "Claude"}`;
      }
    } catch (err) {
      typingEl?.remove();
      const msg = err.message || String(err);
      appendIaMessage("assistant", msg, { error: true });
      state.iaChat.push({ role: "assistant", content: msg, error: true });
      if (st) {
        st.className = "ia-chat-status is-err";
        st.textContent = msg;
      }
    } finally {
      state.iaBusy = false;
      if ($("#btn-ia-send")) $("#btn-ia-send").disabled = false;
      input?.focus();
    }
  }

  function renderSuggestions() {
    /* legado removido — Análise IA virou chat */
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
    return [...rows].sort((a, b) => {
      const c = compareSortValues(get(a), get(b), dir || "asc");
      if (c !== 0) return c;
      return String(a.subid || "").localeCompare(String(b.subid || ""), "pt-BR", {
        sensitivity: "base",
        numeric: true,
      });
    });
  }

  function toggleSortState(sortState, key, defaultDir = "desc") {
    if (sortState.key === key) sortState.dir = sortState.dir === "asc" ? "desc" : "asc";
    else {
      sortState.key = key;
      sortState.dir = defaultDir;
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
      if (e.target.closest("input, select, textarea")) return;
      const th = e.target.closest("th[data-sort]");
      if (!th || !root.contains(th)) return;
      e.preventDefault();
      const defaultDir = th.classList.contains("num") ? "desc" : "asc";
      toggleSortState(getSortState(), th.dataset.sort, defaultDir);
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

  /**
   * True quando o SubID tem qualquer métrica não-zero no período carregado.
   * O backend devolve todos os SubIDs de subid_metrics (histórico completo) e o
   * enrich zera as métricas fora do intervalo — então basta olhar os totais.
   */
  function subHasPeriodActivity(r) {
    if (!r) return false;
    const nz = (v) => Number(v || 0) > 0;
    if (nz(r.faturamento) || nz(r.comissao) || nz(r.pedidos)) return true;
    if (nz(r.concluidos) || nz(r.pendentes) || nz(r.cancelados)) return true;
    if (nz(r.inv_meta) || nz(r.inv_pin)) return true;
    if (nz(r.cliques_meta) || nz(r.cliques_pin)) return true;
    if (r.cliques_shopee != null && Number(r.cliques_shopee) > 0) return true;
    return false;
  }

  function filteredSubIds(list, q, channel, { activeOnly = false } = {}) {
    const query = (q || "").trim().toLowerCase();
    const ch = channel != null ? channel : state.channel;
    return (list || []).filter((r) => {
      if (query && !String(r.subid).toLowerCase().includes(query)) return false;
      if (activeOnly && !subHasPeriodActivity(r)) return false;
      if (!ch || ch === "geral") return true;
      return (r.canal || "indefinido") === ch;
    });
  }

  function periodRange() {
    const start = state.dash?.range?.startDate || $("#start-date")?.value;
    const end = state.dash?.range?.endDate || $("#end-date")?.value;
    return { start, end };
  }

  const _aggCache = new WeakMap();
  function aggregateSubInPeriod(r, start, end) {
    if (r && typeof r === "object") {
      let bucket = _aggCache.get(r);
      const key = `${start || ""}|${end || ""}`;
      if (bucket && bucket[key]) return bucket[key];
      const result = aggregateSubInPeriodImpl(r, start, end);
      if (!bucket) { bucket = {}; _aggCache.set(r, bucket); }
      bucket[key] = result;
      return result;
    }
    return aggregateSubInPeriodImpl(r, start, end);
  }
  function aggregateSubInPeriodImpl(r, start, end) {
    const allDaily = r?.daily || [];
    if (!start || !end || !allDaily.length) {
      return {
        faturamento: Number(r?.faturamento || 0),
        comissao: Number(r?.comissao || 0),
        pedidos: Number(r?.pedidos || 0),
        concluidos: Number(r?.concluidos || 0),
        pendentes: Number(r?.pendentes || 0),
        cancelados: Number(r?.cancelados || 0),
        unpaid: Number(r?.unpaid || 0),
        inv_meta: Number(r?.inv_meta || 0),
        inv_pin: Number(r?.inv_pin || 0),
        cliques_meta: Number(r?.cliques_meta || 0),
        cliques_pin: Number(r?.cliques_pin || 0),
        cliques_shopee: r?.cliques_shopee != null ? Number(r.cliques_shopee) : null,
      };
    }
    const days = allDaily.filter((d) => d.data >= start && d.data <= end);
    if (!days.length) {
      const invM = Number(r?.inv_meta || 0);
      const invP = Number(r?.inv_pin || 0);
      if (invM > 0 || invP > 0) {
        return {
          faturamento: 0,
          comissao: 0,
          pedidos: 0,
          concluidos: 0,
          pendentes: 0,
          cancelados: 0,
          unpaid: 0,
          inv_meta: invM,
          inv_pin: invP,
          cliques_meta: Number(r?.cliques_meta || 0),
          cliques_pin: Number(r?.cliques_pin || 0),
          cliques_shopee: 0,
        };
      }
      return {
        faturamento: 0,
        comissao: 0,
        pedidos: 0,
        concluidos: 0,
        pendentes: 0,
        cancelados: 0,
        unpaid: 0,
        inv_meta: 0,
        inv_pin: 0,
        cliques_meta: 0,
        cliques_pin: 0,
        cliques_shopee: 0,
      };
    }
    const agg = {
      faturamento: 0,
      comissao: 0,
      pedidos: 0,
      concluidos: 0,
      pendentes: 0,
      cancelados: 0,
      unpaid: 0,
      inv_meta: 0,
      inv_pin: 0,
      cliques_meta: 0,
      cliques_pin: 0,
      cliques_shopee: 0,
    };
    for (const d of days) {
      agg.faturamento += Number(d.faturamento || 0);
      agg.comissao += Number(d.comissao || 0);
      agg.pedidos += Number(d.pedidos || 0);
      agg.concluidos += Number(d.concluidos || 0);
      agg.pendentes += Number(d.pendentes || 0);
      agg.cancelados += Number(d.cancelados || 0);
      agg.unpaid += Number(d.unpaid || 0);
      agg.inv_meta += Number(d.inv_meta || 0);
      agg.inv_pin += Number(d.inv_pin || 0);
      agg.cliques_meta += Number(d.cliques_meta || 0);
      agg.cliques_pin += Number(d.cliques_pin || 0);
      agg.cliques_shopee += Number(d.cliques_shopee || 0);
    }
    return agg;
  }

  function kpisFromSubIds(subs, baseKpis) {
    const list = subs || [];
    const { start, end } = periodRange();
    let fat = 0, com = 0, invMeta = 0, invPin = 0;
    let pedidos = 0, concluidos = 0, pendentes = 0, cancelados = 0, unpaid = 0;
    let cliquesMeta = 0, cliquesPin = 0, cliquesAds = 0;
    let impressoes = 0, alcance = 0;
    let cliquesShopeeRaw = null;
    for (const r of list) {
      const a = aggregateSubInPeriod(r, start, end);
      fat += a.faturamento;
      com += a.comissao;
      invMeta += a.inv_meta;
      invPin += a.inv_pin;
      pedidos += Number(a.concluidos || 0) + Number(a.pendentes || 0);
      concluidos += a.concluidos;
      pendentes += a.pendentes;
      cancelados += a.cancelados;
      unpaid += Number(a.unpaid || 0);
      cliquesMeta += a.cliques_meta;
      cliquesPin += a.cliques_pin;
      cliquesAds += adsClicksFor(a, state.channel);
      impressoes += Number(r.impressoes || 0);
      alcance += Number(r.alcance || 0);
      if (a.cliques_shopee != null) {
        cliquesShopeeRaw = (cliquesShopeeRaw == null ? 0 : cliquesShopeeRaw) + Number(a.cliques_shopee);
      }
    }
    const spendMeta = invMeta;
    const cpc_meta = cliquesMeta > 0 ? Math.round((spendMeta / cliquesMeta) * 100) / 100 : null;
    const ctr_meta = impressoes > 0 ? Math.round((cliquesMeta / impressoes) * 10000) / 100 : null;
    const tax = {
      taxRate: Number(state.dash?.tax?.taxRate ?? state.settings.taxRate ?? 0),
      metaTaxRate: Number(state.dash?.tax?.metaTaxRate ?? state.settings.metaTaxRate ?? 12),
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
      unpaid,
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
    paintChannelCounts();
    if (state.view === "canais") renderOpsTable();
    else if (state.view === "config" && state.cfgTab === "indefinidos") renderIndefinidos();
    else if (state.view === "dashboard" && state.channel !== "geral") renderSubIdsDash();
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
  function dailyFromSubIds(subs, start, end) {
    const metaTax = Number(state.settings.metaTaxRate != null ? state.settings.metaTaxRate : 12) / 100;
    const gov = Number(state.settings.taxRate || 0) / 100;
    const byDay = new Map();
    for (const s of subs || []) {
      for (const d of s.daily || []) {
        if (start && d.data < start) continue;
        if (end && d.data > end) continue;
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
    if (eyebrow) eyebrow.textContent = `canal ${label} · altere o status`;
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
    organico: ["subid", "comissao", "pedidos", "cliques_shopee", "abatimento", "tendencia", "status"],
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
    if (isMobileLayout()) {
      const keep = new Set(["subid", "lucro", "roi", "status"]);
      return allSubidColumnDefs(ch).filter((c) => keep.has(c.key));
    }
    return allSubidColumnDefs(ch).filter((c) => c.locked || prefs[c.key]);
  }

  let _trendDatesCache = { key: "", dates: [] };
  function trendDatesFor(start, end) {
    const key = `${start || ""}|${end || ""}`;
    if (_trendDatesCache.key === key) return _trendDatesCache.dates;
    const dates = [];
    if (start && end) {
      const cur = new Date(`${start}T12:00:00`);
      const last = new Date(`${end}T12:00:00`);
      while (cur <= last) {
        dates.push(cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
      }
    }
    _trendDatesCache = { key, dates };
    return dates;
  }
  function subidTrendScore(r) {
    const byDate = new Map();
    for (const d of r.daily || []) {
      const key = String(d.data || "");
      if (!key) continue;
      byDate.set(key, (byDate.get(key) || 0) + Number(d.comissao || 0));
    }

    const start = state.dash?.range?.startDate;
    const end = state.dash?.range?.endDate;
    let dates;
    if (start && end) {
      dates = trendDatesFor(start, end);
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
        return `<td class="subid" data-subid="${escapeHtml(String(r.subid || ""))}">${escapeHtml(String(r.subid || ""))}</td>`;
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

  function channelKpisFor(ch, dash, channelSubs) {
    const fromServer = dash?.channelKpis?.[ch];
    if (fromServer && fromServer.faturamento != null) return fromServer;
    return kpisFromSubIds(channelSubs, dash?.kpis);
  }

  function refreshCampaignKpisFromFilter() {
    const ch = state.channel || "geral";
    if (ch !== "meta" && ch !== "pinterest" && ch !== "organico") return;
    const dash = state.dash;
    if (!dash) {
      renderChannelKpis(ch, {});
      return;
    }
    const q = ($("#subid-search")?.value || "").trim();
    const channelSubs = filteredSubIds(dash.subIds || [], q, ch, { activeOnly: true });
    let k = q
      ? kpisFromSubIds(channelSubs, dash.kpis)
      : channelKpisFor(ch, dash, channelSubs);
    if (ch === "meta" && k.cliques_shopee != null && Number(k.cliques_meta) > 0) {
      k.abatimento_cliques = Math.round((Number(k.cliques_shopee) / Number(k.cliques_meta)) * 10000) / 100;
    }
    if (ch === "pinterest" && k.cliques_shopee != null && Number(k.cliques_pin) > 0) {
      k.abatimento_cliques = Math.round((Number(k.cliques_shopee) / Number(k.cliques_pin)) * 10000) / 100;
    }
    renderChannelKpis(ch, k);
    const liveText = $("#dash-live-text");
    if (liveText) {
      const label = `${canalLabel(ch)} · `;
      liveText.textContent = channelSubs.length
        ? `${label}${fmtNum(channelSubs.length)} SubID${channelSubs.length === 1 ? "" : "s"}${q ? ` · filtro "${q}"` : ""}`
        : q ? `${label}Nenhum SubID para "${q}"` : `${label}Ao vivo`;
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
      renderMetaProgressCard({});
      renderChannelKpis(ch, {});
      renderSuggestions(null);
      renderChart([]);
      return;
    }

    const channelSubs = filteredSubIds(dash.subIds || [], "", ch, { activeOnly: isChannel });
    let k = isChannel
      ? (channelKpisFor(ch, dash, channelSubs))
      : {
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
    // Totais de mídia do enrich (dashboard geral — todas as linhas Meta/Pin do período)
    if (dash.kpis && !isChannel) {
      if (dash.kpis.cliques_meta != null) k.cliques_meta = dash.kpis.cliques_meta;
      if (dash.kpis.cliques_pin != null) k.cliques_pin = dash.kpis.cliques_pin;
      if (dash.kpis.cliques_ads != null) k.cliques_ads = dash.kpis.cliques_ads;
      if (dash.kpis.cliques_shopee != null) k.cliques_shopee = dash.kpis.cliques_shopee;
      if (dash.kpis.impressoes != null) k.impressoes = dash.kpis.impressoes;
      if (dash.kpis.alcance != null) k.alcance = dash.kpis.alcance;
      if (dash.kpis.ctr_meta != null) k.ctr_meta = dash.kpis.ctr_meta;
      if (dash.kpis.cpc_meta != null) k.cpc_meta = dash.kpis.cpc_meta;
      if (dash.kpis.abatimento_cliques != null) k.abatimento_cliques = dash.kpis.abatimento_cliques;
    }
    if (isChannel && ch === "meta" && k.cliques_shopee != null && Number(k.cliques_meta) > 0) {
      k.abatimento_cliques = Math.round((Number(k.cliques_shopee) / Number(k.cliques_meta)) * 10000) / 100;
    }
    if (isChannel && ch === "pinterest" && k.cliques_shopee != null && Number(k.cliques_pin) > 0) {
      k.abatimento_cliques = Math.round((Number(k.cliques_shopee) / Number(k.cliques_pin)) * 10000) / 100;
    }
    const { start, end } = periodRange();
    const daily = isChannel
      ? (dash.dailyByChannel?.[ch] || dailyFromSubIds(channelSubs, start, end))
      : (dash.daily || []);
    const defer = (fn) => {
      // Aba escondida (troca de tab, janela minimizada) suspende requestAnimationFrame
      // e a tabela do canal ficaria em branco até voltar. Cai para setTimeout nesse caso.
      if (typeof requestAnimationFrame === "function" && !document.hidden) requestAnimationFrame(fn);
      else setTimeout(fn, 0);
    };
    if (!isChannel) {
      const activeCount = (dash.subIds || []).filter(subHasPeriodActivity).length;
      renderKpis(k, activeCount);
      renderMetaProgressCard(k);
      renderChart(daily);
      defer(() => renderDailyTable(daily, k));
    } else {
      if (!state.subidColPrefs) state.subidColPrefs = {};
      if (!state.subidColPrefs[ch]) state.subidColPrefs[ch] = readSubidColPrefs(ch);
      paintSubidColPicker(ch);
      renderChannelKpis(ch, k);
      defer(() => renderSubIdsDash());
    }
    renderSuggestions(dash);

    if (!isChannel) {
      const liveText = $("#dash-live-text");
      if (liveText) {
        const indef = dash.channelKpis?.indefinido;
        const indefCom = Number(indef?.comissao || 0);
        liveText.textContent = indefCom > 0.009
          ? `Ao vivo · ${fmt(indefCom)} de comissão em SubIDs indefinidos (não entram nas campanhas)`
          : "Ao vivo";
      }
    }
  }

  function wireInfiniteScroll(scrollSel, onMore) {
    const el = $(scrollSel);
    if (!el || el.dataset.infiniteWired === "1") return;
    el.dataset.infiniteWired = "1";
    let last = 0;
    el.addEventListener("scroll", () => {
      const now = Date.now();
      if (now - last < 160) return;
      last = now;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) onMore();
    }, { passive: true });
  }

  function renderInfiniteHint(el, shown, total, onMore) {
    if (!el) return;
    if (!total) {
      el.innerHTML = "";
      return;
    }
    if (shown >= total) {
      el.innerHTML = `<span class="infinite-hint">${fmtNum(total)} registro(s)</span>`;
      return;
    }
    const label = `Mostrando ${fmtNum(shown)} de ${fmtNum(total)} · role ou toque para carregar mais`;
    if (typeof onMore === "function") {
      el.innerHTML = `<button type="button" class="btn ghost sm infinite-hint" data-more="1">${label}</button>`;
      const btn = el.querySelector("button[data-more]");
      if (btn) btn.addEventListener("click", (e) => { e.preventDefault(); onMore(); });
    } else {
      el.innerHTML = `<span class="infinite-hint">${label}</span>`;
    }
  }

  function renderOpsTable() {
    const tb = $("#ops-tbody");
    if (!tb) return;
    const statusRank = { ativa: 0, teste: 1, desativada: 2 };
    const sortKey = state.opsSort?.key || "status";
    const sortDir = state.opsSort?.dir || "asc";

    let list = filteredSubIds(state.dash?.subIds || [], $("#ops-search")?.value, "geral");

    list = sortRows(list, sortKey, sortDir, (r) => {
      if (sortKey === "subid") return r.subid;
      if (sortKey === "canal") return canalLabel(r.canal || "indefinido");
      if (sortKey === "status") return statusRank[normalizeStatus(r.status)] ?? 9;
      return r[sortKey];
    });

    const total = list.length;
    state.opsTotal = total;
    const slice = list;

    const countPill = $("#ops-count-pill");
    if (countPill) countPill.textContent = fmtNum(total);
    paintSortHeaders("#ops-thead", state.opsSort);

    tb.innerHTML = slice.map((r) => {
      const id = String(r.subid || "");
      const canal = r.canal || "indefinido";
      const status = normalizeStatus(r.status);
      const off = status === "desativada" ? " is-desativada" : "";
      return `<tr class="subid-row${off}">
        <td class="subid">${escapeHtml(id)}</td>
        <td>${canalSelectHtml(id, canal)}</td>
        <td>${statusSelectHtml(id, status)}</td>
      </tr>`;
    }).join("") || `<tr><td colspan="3" class="cell-muted">${state.dash ? "Nenhum SubID encontrado." : "Carregue o painel para listar SubIDs."}</td></tr>`;
    wireOpsSelects("#ops-tbody");
    renderInfiniteHint($("#ops-pager"), slice.length, total);
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
          <table class="subid-history-table">
            <thead>
              <tr>
                <th>Dia</th>
                <th class="num">Comissão</th>
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
    tb.addEventListener("click", async (e) => {
      if (e.target.closest("select, button, input, a, label, .op-select")) return;
      const cell = e.target.closest("td.subid[data-subid]");
      if (!cell) return;
      e.preventDefault();
      const id = cell.dataset.subid;
      if (!id) return;
      const opening = !state.expandedSubIds[id];
      state.expandedSubIds[id] = opening;
      const row = (state.dash?.subIds || []).find((r) => String(r.subid || "") === id);
      if (opening && row && !Array.isArray(row.daily)) {
        row.daily = [];
        renderFn();
        try {
          const start = $("#start-date")?.value || "";
          const end = $("#end-date")?.value || "";
          const r = await api(`/api/subid-daily?subid=${encodeURIComponent(id)}&start=${start}&end=${end}`);
          row.daily = r.daily || [];
        } catch (_) {
          row.daily = [];
        }
      }
      renderFn();
    });
  }

  function renderSubIdsDash() {
    const ch = state.channel || "geral";
    const mobile = isMobileLayout();
    const cols = paintSubidThead(ch);
    const search = $("#subid-search")?.value || "";
    let all = filteredSubIds(state.dash?.subIds || [], search, ch, { activeOnly: true });
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
    state.subidTotal = total;
    // Reseta janela de visíveis quando muda canal/busca/ordenação
    const filterKey = `${ch}|${search}|${state.subidSort.key || "status"}|${state.subidSort.dir || "asc"}`;
    if (state._subidFilterKey !== filterKey) {
      state._subidFilterKey = filterKey;
      state.subidVisible = 40;
    }
    if (!state.subidVisible || state.subidVisible < 40) state.subidVisible = 40;
    const slice = all.slice(0, state.subidVisible);
    const pill = $("#subid-count-pill");
    if (pill) pill.textContent = fmtNum(total);

    const tbody = $("#subid-tbody");
    const cardList = $("#subid-card-list");
    const table = $("#subid-table");
    if (mobile) {
      if (table) table.classList.add("is-mobile-hidden");
      if (cardList) {
        cardList.classList.remove("hidden");
        cardList.innerHTML = slice.map((r) => renderSubIdCard(r, ch)).join("")
          || `<div class="subid-card-empty">Nenhum SubID neste canal no período.</div>`;
        wireOpsSelects("#subid-card-list");
        wireSubIdCardExpand(cardList, renderSubIdsDash);
      }
      if (tbody) tbody.innerHTML = "";
    } else {
      if (cardList) {
        cardList.classList.add("hidden");
        cardList.innerHTML = "";
      }
      if (table) table.classList.remove("is-mobile-hidden");
      if (!tbody) return;
      const span = cols.length;
      tbody.innerHTML = slice.map((r) => {
        const id = String(r.subid || "");
        const open = Boolean(state.expandedSubIds[id]);
        const cells = cols.map((c) => {
          if (c.key === "subid") {
            return `<td class="subid is-clickable" data-subid="${escapeHtml(id)}" title="Ver histórico diário">
              <span class="subid-caret" aria-hidden="true"></span>${escapeHtml(id)}
            </td>`;
          }
          return cellForSubidCol(r, c, ch);
        }).join("");
        return `<tr class="subid-row${open ? " is-open" : ""}" data-subid="${escapeHtml(id)}">${cells}</tr>${
          open ? subIdDailyHistoryHtml(r, span) : ""
        }`;
      }).join("") || `<tr><td colspan="${span}">Nenhum SubID neste canal no período.</td></tr>`;
      wireOpsSelects("#subid-tbody");
      wireSubIdExpand("#subid-tbody", renderSubIdsDash);
    }

    const loadMore = () => {
      if (state.subidVisible >= state.subidTotal) return;
      state.subidVisible = Math.min(state.subidVisible + 40, state.subidTotal);
      renderSubIdsDash();
    };
    renderInfiniteHint($("#subid-pager"), slice.length, total, loadMore);
    wireInfiniteScroll("#subid-scroll", loadMore);
    refreshCampaignKpisFromFilter();
  }

  function renderSubIdCard(r, ch) {
    const id = String(r.subid || "");
    const open = Boolean(state.expandedSubIds[id]);
    const fat = Number(r.faturamento || 0);
    const com = Number(r.comissao || 0);
    const inv = investForRoi(r);
    const lucro = r.lucro != null ? Number(r.lucro) : com - inv;
    const roi = displayRoi(r);
    const pedidos = Number(r.pedidos ?? r.concluidos ?? 0);
    const cliquesShopee = Number(r.cliques_shopee ?? r.cliques ?? 0);
    const cliquesAds = adsClicksFor(r, ch);
    const abatFat = fat > 0 ? (com / fat) * 100 : Number(r.abatimento || 0);
    const abatCli = clickAbatPct(r, ch);
    const trend = subidTrendScore(r);
    const trendChip = trend === 1
      ? `<span class="subid-card-chip trend-up" title="Comissão subindo">▲ subindo</span>`
      : trend === -1
        ? `<span class="subid-card-chip trend-down" title="Comissão caindo">▼ caindo</span>`
        : trend === 0
          ? `<span class="subid-card-chip trend-flat" title="Comissão estável">→ estável</span>`
          : "";
    const showInvest = ch !== "organico";
    const showAds = ch === "meta" || ch === "pinterest";

    return `<article class="subid-card${open ? " is-open" : ""}" data-subid="${escapeHtml(id)}" role="listitem">
      <header class="subid-card-head">
        <button type="button" class="subid-card-toggle" data-subid-toggle="${escapeHtml(id)}" aria-expanded="${open ? "true" : "false"}" title="Ver histórico diário">
          <span class="subid-card-caret" aria-hidden="true"></span>
          <span class="subid-card-name">${escapeHtml(id)}</span>
        </button>
        <div class="subid-card-status">${statusSelectHtml(id, r.status)}</div>
      </header>
      <div class="subid-card-grid">
        <div class="subid-card-cell"><span class="lab">Faturamento</span><span class="val">${fmt(fat)}</span></div>
        <div class="subid-card-cell"><span class="lab">Comissão</span><span class="val cell-emerald">${fmt(com)}</span></div>
        ${showInvest ? `<div class="subid-card-cell"><span class="lab">Investim.</span><span class="val cell-gasto">${fmt(inv)}</span></div>` : ""}
        <div class="subid-card-cell"><span class="lab">Lucro</span><span class="val ${lucroCellClass(lucro)}">${fmt(lucro)}</span></div>
        <div class="subid-card-cell"><span class="lab">ROI</span><span class="val ${roiTierClass(roi)}">${fmtPct(roi)}</span></div>
        <div class="subid-card-cell"><span class="lab">Pedidos</span><span class="val">${fmtNum(pedidos)}</span></div>
      </div>
      <div class="subid-card-foot">
        <span class="subid-card-chip">🖱 Shopee <b>${fmtNum(cliquesShopee)}</b></span>
        ${showAds ? `<span class="subid-card-chip">🖱 Ads <b>${fmtNum(cliquesAds)}</b></span>` : ""}
        <span class="subid-card-chip">Abat. <b>${fmtPct(showAds ? abatCli : abatFat)}</b></span>
        ${trendChip}
      </div>
      ${open ? subIdDailyHistoryCards(r) : ""}
    </article>`;
  }

  function subIdDailyHistoryCards(r) {
    const days = Array.isArray(r.daily) ? r.daily : [];
    if (!days.length) {
      return `<div class="subid-card-history subid-card-history--empty">Sem histórico diário para este SubID no período.</div>`;
    }
    const rows = days.map((d) => {
      const inv = investForRoi(d);
      const lucro = d.lucro != null ? Number(d.lucro) : Number(d.comissao || 0) - inv;
      const roi = displayRoi(d);
      return `<div class="subid-card-history-row">
        <span class="hday">${escapeHtml(shortDayLabel(d.data))}</span>
        <span class="hcell"><span class="lab">Com.</span><span class="val cell-emerald">${fmt(d.comissao)}</span></span>
        <span class="hcell"><span class="lab">Inv.</span><span class="val cell-gasto">${fmt(inv)}</span></span>
        <span class="hcell"><span class="lab">Lucro</span><span class="val ${lucroCellClass(lucro)}">${fmt(lucro)}</span></span>
        <span class="hcell"><span class="lab">ROI</span><span class="val ${roiTierClass(roi)}">${fmtPct(roi)}</span></span>
      </div>`;
    }).join("");
    const totCom = days.reduce((a, d) => a + Number(d.comissao || 0), 0);
    const totInv = days.reduce((a, d) => a + investForRoi(d), 0);
    const totLucro = days.reduce((a, d) => a + (d.lucro != null ? Number(d.lucro) : Number(d.comissao || 0) - investForRoi(d)), 0);
    const totRoi = totInv > 0 ? (totLucro / totInv) * 100 : null;
    return `<div class="subid-card-history">
      ${rows}
      <div class="subid-card-history-row is-total">
        <span class="hday">Total ${days.length}d</span>
        <span class="hcell"><span class="lab">Com.</span><span class="val cell-emerald">${fmt(totCom)}</span></span>
        <span class="hcell"><span class="lab">Inv.</span><span class="val cell-gasto">${fmt(totInv)}</span></span>
        <span class="hcell"><span class="lab">Lucro</span><span class="val ${lucroCellClass(totLucro)}">${fmt(totLucro)}</span></span>
        <span class="hcell"><span class="lab">ROI</span><span class="val ${roiTierClass(totRoi)}">${fmtPct(totRoi)}</span></span>
      </div>
    </div>`;
  }

  function wireSubIdCardExpand(root, renderFn) {
    if (!root || root.dataset.expandWired === "1") return;
    root.dataset.expandWired = "1";
    root.addEventListener("click", async (e) => {
      if (e.target.closest("select, .op-select")) return;
      const btn = e.target.closest("[data-subid-toggle]");
      if (!btn) return;
      e.preventDefault();
      const id = btn.dataset.subidToggle;
      if (!id) return;
      const opening = !state.expandedSubIds[id];
      state.expandedSubIds[id] = opening;
      const row = (state.dash?.subIds || []).find((r) => String(r.subid || "") === id);
      if (opening && row && !Array.isArray(row.daily)) {
        row.daily = [];
        renderFn();
        try {
          const start = $("#start-date")?.value || "";
          const end = $("#end-date")?.value || "";
          const dRes = await api(`/api/subid-daily?subid=${encodeURIComponent(id)}&start=${start}&end=${end}`);
          row.daily = dRes.daily || [];
        } catch (_) {
          row.daily = [];
        }
      }
      renderFn();
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

  async function renderBackupPage() {
    try {
      const ui = await ensureBackupUi();
      if (ui) await ui.mount();
    } catch (e) {
      console.warn(e);
    }
  }

  async function loadDataView(view) {
    const titleEl = $("#data-title");
    const subEl = $("#data-sub");
    if (titleEl) titleEl.textContent = VIEW_LABELS[view] || view;
    if (subEl) {
      subEl.textContent = view === "produtos"
        ? "Gerencie produtos principais, reservas e oportunidades de substituição em um único lugar."
        : "Dados reais da sua conta no período selecionado.";
    }
    const panelTitle = $("#data-panel-title");
    if (panelTitle) panelTitle.textContent = VIEW_LABELS[view];
    state.dataKind = view;

    if (view === "produtos") {
      await renderBackupPage();
      return;
    }

    if (!$("#data-thead")) return;

    const start = $("#start-date")?.value || daysAgoFromShopeeEnd(6);
    const end = $("#end-date")?.value || yesterdayISO();

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
            { label: "Pedidos validados", value: fmtNum(k.pedidos) },
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
            { label: "Pedidos validados", value: fmtNum(k.pedidos || 0) },
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

  function applyDash(dash, { cached, userTriggered } = {}) {
    state.dash = dash;
    state.subidPage = 1;
    applyChannelView();
    if (state.view === "canais") renderOpsTable();
    if (state.view === "config" && state.cfgTab === "indefinidos") renderIndefinidos();
    const when = dash.syncedAt ? new Date(dash.syncedAt).toLocaleString("pt-BR") : "—";
    $("#sync-meta").textContent = `${cached ? "cache · " : ""}${dash.nodes || 0} nodes · ${when}`;
    $("#footer-sync").textContent = `Última sincronização ${when}`;
    SyncNotify.notify(dash, { userTriggered: !!userTriggered });
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
    "7d": "Últimos 7 dias",
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

  async function loadClaudeCreds() {
    try {
      const c = await api("/api/ai/credentials");
      state.claudeConfigured = Boolean(c.configured);
      setStateChip("#cfg-claude-state", c.configured, "Conectada", "Pendente");
      setStateChip("#ia-claude-state", c.configured, "Sua key OK", "Configurar");
      if (c.pricing?.label) state.iaUsage.pricingLabel = c.pricing.label;
      if ($("#claude-model")) {
        $("#claude-model").value = c.model || "claude-sonnet-4-6";
      }
      if ($("#claude-api-key")) {
        $("#claude-api-key").value = "";
        $("#claude-api-key").placeholder = c.apiKeyMasked
          ? `Salvo: ${c.apiKeyMasked} (deixe vazio para manter)`
          : "sk-ant-… (sua key Anthropic)";
      }
      const navIa = $("#nav-count-ia");
      if (navIa) navIa.textContent = c.configured ? "Chat" : "Key";
      const pricingPill = $("#ia-pricing-pill");
      if (pricingPill && c.pricing) {
        pricingPill.textContent =
          `Cobrança: in US$${c.pricing.inputPerMTokUsd}/1M · out US$${c.pricing.outputPerMTokUsd}/1M tokens`;
      }
      updateIaTokenBoard();
      if (!state.iaChat.length) mountIaChat();
    } catch (e) {
      console.warn(e);
      const st = $("#ia-chat-status");
      if (st && /not_found/i.test(e.message || "")) {
        st.className = "ia-chat-status is-err";
        st.textContent = "API /api/ai não encontrada — reinicie o servidor (npm start) e atualize a página.";
      }
    }
  }

  function cacheMetaProjSettings(s) {
    try {
      localStorage.setItem("afilia:metaProj", JSON.stringify({
        metaBase: s.metaBase,
        metaDias: s.metaDias,
        metaBonus100: s.metaBonus100,
        metaBonus125: s.metaBonus125,
        metaBonus150: s.metaBonus150,
      }));
    } catch (_) { /* ignore */ }
  }

  function readMetaProjCache() {
    try {
      return JSON.parse(localStorage.getItem("afilia:metaProj") || "null");
    } catch (_) {
      return null;
    }
  }

  async function loadSettingsUi() {
    try {
      const s = await api("/api/settings");
      const local = readMetaProjCache();
      state.settings = {
        taxRate: s.taxRate,
        metaTaxRate: s.metaTaxRate != null ? s.metaTaxRate : 12,
        metaBase: s.metaBase != null ? Number(s.metaBase) : (local?.metaBase ?? 863959),
        metaDias: s.metaDias != null ? Number(s.metaDias) : (local?.metaDias ?? null),
        metaBonus100: s.metaBonus100 != null ? Number(s.metaBonus100) : (local?.metaBonus100 ?? 1),
        metaBonus125: s.metaBonus125 != null ? Number(s.metaBonus125) : (local?.metaBonus125 ?? 2),
        metaBonus150: s.metaBonus150 != null ? Number(s.metaBonus150) : (local?.metaBonus150 ?? 3),
        teamName: s.teamName,
        teamPlan: s.teamPlan,
      };
      // Se o banco ainda não tem as colunas novas, mantém o cache local
      if (local && (s.metaBonus100 == null || s.metaDias === undefined)) {
        if (local.metaDias != null) state.settings.metaDias = local.metaDias;
        if (local.metaBonus100 != null) state.settings.metaBonus100 = local.metaBonus100;
        if (local.metaBonus125 != null) state.settings.metaBonus125 = local.metaBonus125;
        if (local.metaBonus150 != null) state.settings.metaBonus150 = local.metaBonus150;
      }
      cacheMetaProjSettings(state.settings);
      paintSettingsForms(state.settings);
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

  async function pollSyncStatus(maxMs = 90000) {
    const started = Date.now();
    while (Date.now() - started < maxMs) {
      try {
        const st = await api("/api/sync/status");
        if (st.status !== "running") return st;
      } catch (_) { /* keep polling */ }
      await new Promise((r) => setTimeout(r, 2000));
    }
    return { status: "idle", timeout: true };
  }

  async function loadDashboard({ force = false } = {}) {
    const start = $("#start-date").value;
    const end = $("#end-date").value;
    const btn = force ? $("#btn-sync") : ($("#btn-load") || $("#btn-sync"));
    const prev = btn ? btn.innerHTML : "";
    if (btn) {
      btn.disabled = true;
      btn.textContent = force ? "Sincronizando…" : "Carregando…";
    }
    setDashLoading(true);
    try {
      if (force) {
        await api("/api/sync", {
          method: "POST",
          body: JSON.stringify({ start, end, startDate: start, endDate: end }),
        }).then((started) => {
          if (started.already) return;
          const token = getToken();
          fetch("/api/sync/worker", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ start, end, startDate: start, endDate: end }),
          }).catch(() => {});
        });
        const banner = $("#sync-banner");
        if (banner) {
          banner.className = "banner keep";
          banner.textContent = "Sincronizando Shopee + Meta em segundo plano…";
        }
        await pollSyncStatus();
      }
      const q = new URLSearchParams({ start, end });
      const dash = await api(`/api/dashboard?${q}`, { dedupeKey: "dashboard" });
      applyDash(dash, { cached: dash.cached, userTriggered: force });
      const banner = $("#sync-banner");
      if (force) {
        banner.className = "banner ok keep";
        banner.textContent = `Sincronização concluída · ${dash.nodes || 0} nodes`;
        setTimeout(() => {
          if (banner.classList.contains("keep")) banner.className = "banner hidden";
        }, 8000);
      } else if (!banner.classList.contains("keep")) {
        banner.className = "banner hidden";
        banner.textContent = "";
      }
    } catch (err) {
      if (err.code === "ABORTED") return;
      const banner = $("#sync-banner");
      banner.className = "banner err";
      banner.textContent = err.message || String(err);
      if (err.code === "CREDS_MISSING") setView("config");
    } finally {
      setDashLoading(false);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = prev;
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
      $("#start-date").value = daysAgoFromShopeeEnd(6);
      $("#end-date").value = yesterdayISO();
    } else if (kind === "14d") {
      $("#start-date").value = daysAgoFromShopeeEnd(13);
      $("#end-date").value = yesterdayISO();
    } else if (kind === "30d") {
      $("#start-date").value = daysAgoFromShopeeEnd(29);
      $("#end-date").value = yesterdayISO();
    } else if (kind === "all") {
      $("#start-date").value = daysAgoFromShopeeEnd(89);
      $("#end-date").value = yesterdayISO();
    } else if (kind === "prev_month") {
      const range = monthPreviousRangeISO();
      $("#start-date").value = range.start;
      $("#end-date").value = range.end;
    } else {
      $("#start-date").value = monthStartISO();
      $("#end-date").value = yesterdayISO();
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

    const max = yesterdayISO();
    const startEl = $("#start-date");
    const endEl = $("#end-date");
    if (startEl) {
      startEl.max = max;
      startEl.value = daysAgoFromShopeeEnd(6);
    }
    if (endEl) {
      endEl.max = max;
      endEl.value = max;
    }
    state.periodPreset = "7d";
    syncTopbarRange();
    $$("#period-bar .period-preset[data-range]").forEach((b) => b.classList.toggle("active", b.dataset.range === "7d"));

    $("#btn-period-custom")?.addEventListener("click", () => togglePeriodCustom());
    $("#btn-period-apply")?.addEventListener("click", () => {
      const start = $("#start-date")?.value;
      let end = $("#end-date")?.value;
      const max = yesterdayISO();
      if (end && end > max) {
        end = max;
        if ($("#end-date")) $("#end-date").value = max;
      }
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
      if (window.innerWidth > 1023) setSidebarOpen(false);
    });

    const mqMobile = window.matchMedia("(max-width: 640px)");
    const onMobileChange = () => {
      if (state.view === "dashboard" && state.channel !== "geral") renderSubIdsDash();
    };
    if (mqMobile.addEventListener) mqMobile.addEventListener("change", onMobileChange);
    else if (mqMobile.addListener) mqMobile.addListener(onMobileChange);

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
      const prev = btn.innerHTML;
      btn.textContent = "Sincronizando…";
      try {
        await syncMetaAds($("#sync-banner"), btn);
      } catch {
        /* status already set */
      } finally {
        btn.innerHTML = prev;
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
      const opsSearch = $("#ops-search");
      if (opsSearch) {
        opsSearch.value = q;
        if (state.view === "canais") renderOpsTable();
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

    $("#subid-search")?.addEventListener("input", debounce(() => { renderSubIdsDash(); }, 200));
    $("#ops-search")?.addEventListener("input", debounce(() => { renderOpsTable(); }, 200));
    wireSortHeaders("#ops-thead", () => state.opsSort, () => {
      renderOpsTable();
    });
    wireSortHeaders("#subid-thead", () => state.subidSort, () => {
      renderSubIdsDash();
    });
    wireSortHeaders("#daily-table thead", () => state.dailySort, () => {
      renderDailyTable(state.dailyRows, state.dash?.kpis || {});
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

    $("#claude-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const status = $("#claude-status");
      if (status) {
        status.className = "form-status";
        status.textContent = "Salvando Claude…";
      }
      try {
        const body = {
          model: ($("#claude-model")?.value || "").trim() || "claude-sonnet-4-6",
        };
        const key = ($("#claude-api-key")?.value || "").trim();
        if (key) body.apiKey = key;
        else if (!state.claudeConfigured) {
          throw new Error("Cole a API key do Claude");
        } else {
          body.apiKey = "••••";
        }
        const saved = await api("/api/ai/credentials", {
          method: "POST",
          body: JSON.stringify(body),
        });
        if (status) {
          status.className = "form-status ok";
          status.textContent = saved.configured
            ? `Claude salvo (${saved.apiKeyMasked || "ok"}).`
            : "Salvo.";
        }
        if ($("#claude-api-key")) $("#claude-api-key").value = "";
        await loadClaudeCreds();
      } catch (err) {
        if (status) {
          status.className = "form-status err";
          status.textContent = err.message;
        }
      }
    });

    $("#btn-claude-test")?.addEventListener("click", async () => {
      const status = $("#claude-status");
      if (status) {
        status.className = "form-status";
        status.textContent = "Testando Claude…";
      }
      try {
        const r = await api("/api/ai/test", { method: "POST", body: "{}" });
        if (status) {
          status.className = "form-status ok";
          status.textContent = `Claude OK · ${r.model || "modelo"}${r.preview ? ` · ${r.preview}` : ""}`;
        }
        await loadClaudeCreds();
      } catch (err) {
        if (status) {
          status.className = "form-status err";
          status.textContent = err.message;
        }
      }
    });

    $("#ia-chat-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      sendIaChat($("#ia-chat-input")?.value || "");
    });
    $("#ia-chat-input")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendIaChat($("#ia-chat-input")?.value || "");
      }
    });
    $("#btn-ia-clear")?.addEventListener("click", () => clearIaChat());
    $("#btn-ia-open-config")?.addEventListener("click", () => openConfig("conexoes"));
    document.addEventListener("click", (e) => {
      const chip = e.target?.closest?.("#ia-chat-suggestions .ia-chip");
      if (!chip || !chip.closest("#view-analise-ia")) return;
      e.preventDefault();
      sendIaChat(chip.dataset.prompt || chip.textContent);
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
        const periodo = r.range?.since && r.range?.until ? ` · ${r.range.since} a ${r.range.until}` : "";
        const gasto = r.gasto != null ? ` · gasto ${Number(r.gasto).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "";
        const classif = r.classificados
          ? ` · ${r.classificados} SubIDs classificados (${r.ativas || 0} ativas / ${r.desativadas || 0} desativadas)`
          : "";
        status.textContent = `Pinterest: ${r.gravados} linhas${classif}${gasto}${periodo}. Ajuste o período para ver Campanhas Pinterest.`;
        await loadDashboard({ force: false });
      } catch (err) {
        status.className = "form-status err";
        status.textContent = err.message;
      }
    });

    $("#btn-shopee-clicks-import")?.addEventListener("click", async () => {
      const status = $("#shopee-clicks-status");
      const file = $("#shopee-clicks-file")?.files?.[0];
      if (!file) {
        status.className = "form-status err";
        status.textContent = "Selecione o CSV de cliques Shopee.";
        return;
      }
      status.className = "form-status";
      status.textContent = "Importando cliques…";
      try {
        const text = await file.text();
        const r = await api("/api/shopee/clicks-import", {
          method: "POST",
          body: JSON.stringify({ csv: text }),
        });
        status.className = "form-status ok";
        const periodo = r.range?.since && r.range?.until ? ` · ${r.range.since} a ${r.range.until}` : "";
        if (r.skipped) {
          status.textContent = `${r.message || "CSV já importado."}${periodo}`;
        } else {
          const extra = r.message ? ` ${r.message}.` : "";
          status.textContent = `Cliques Shopee: ${Number(r.cliques || 0).toLocaleString("pt-BR")} cliques · ${r.subids || 0} SubIDs${periodo}.${extra} Recarregue Campanhas Meta.`;
        }
        await loadDashboard({ force: false });
      } catch (err) {
        status.className = "form-status err";
        status.textContent = err.message;
      }
    });

    $("#settings-form-taxes")?.addEventListener("submit", (e) => saveSettingsFromForms(e, "taxes"));
    $("#settings-form-metas")?.addEventListener("submit", (e) => saveSettingsFromForms(e, "metas"));
    [
      "set-tax", "set-meta-tax", "set-team-name", "set-team-plan",
      "set-meta-base", "set-meta-dias", "set-bonus-100", "set-bonus-125", "set-bonus-150",
    ].forEach((id) => {
      const inp = $(`#${id}`);
      if (!inp) return;
      inp.readOnly = false;
      inp.disabled = false;
      inp.addEventListener("change", () => {
        const part = id.startsWith("set-bonus") || id === "set-meta-base" || id === "set-meta-dias" ? "metas" : "taxes";
        saveSettingsFromForms(null, part);
      });
    });

    $$("#cfg-subnav .cfg-subnav-btn").forEach((b) => {
      b.addEventListener("click", () => setCfgTab(b.dataset.cfgTab));
    });

    const taxInput = $("#set-tax");
    taxInput?.addEventListener("blur", () => {
      taxInput.value = formatBrPctInput(parseBrNumber(taxInput.value));
    });
    const metaTaxInput = $("#set-meta-tax");
    metaTaxInput?.addEventListener("blur", () => {
      metaTaxInput.value = formatBrPctInput(parseBrNumber(metaTaxInput.value));
    });
    const metaBaseInput = $("#set-meta-base");
    metaBaseInput?.addEventListener("blur", () => {
      metaBaseInput.value = formatBrMoneyInput(parseBrNumber(metaBaseInput.value));
    });
    ["set-bonus-100", "set-bonus-125", "set-bonus-150"].forEach((id) => {
      const inp = $(`#${id}`);
      inp?.addEventListener("blur", () => {
        inp.value = formatBrPctInput(parseBrNumber(inp.value));
      });
    });
  }

  function readSettingsFromForms() {
    const metaDiasRaw = ($("#set-meta-dias")?.value || "").trim();
    return {
      taxRate: parseBrNumber($("#set-tax")?.value || String(state.settings.taxRate || 11.7)),
      metaTaxRate: parseBrNumber($("#set-meta-tax")?.value || String(state.settings.metaTaxRate || 12)),
      metaBase: parseBrNumber($("#set-meta-base")?.value || String(state.settings.metaBase || 0)),
      metaDias: metaDiasRaw === "" ? null : Math.max(1, Math.min(31, parseInt(metaDiasRaw, 10) || 0)) || null,
      metaBonus100: parseBrNumber($("#set-bonus-100")?.value || String(state.settings.metaBonus100 ?? 1)),
      metaBonus125: parseBrNumber($("#set-bonus-125")?.value || String(state.settings.metaBonus125 ?? 2)),
      metaBonus150: parseBrNumber($("#set-bonus-150")?.value || String(state.settings.metaBonus150 ?? 3)),
      teamName: ($("#set-team-name")?.value || state.settings.teamName || "").trim(),
      teamPlan: ($("#set-team-plan")?.value || state.settings.teamPlan || "").trim(),
    };
  }

  function paintSettingsForms(s) {
    if ($("#set-tax")) $("#set-tax").value = formatBrPctInput(s.taxRate);
    if ($("#set-meta-tax")) $("#set-meta-tax").value = formatBrPctInput(s.metaTaxRate);
    if ($("#set-meta-base")) $("#set-meta-base").value = formatBrMoneyInput(s.metaBase);
    if ($("#set-meta-dias")) $("#set-meta-dias").value = s.metaDias != null ? String(s.metaDias) : "";
    if ($("#set-bonus-100")) $("#set-bonus-100").value = formatBrPctInput(s.metaBonus100);
    if ($("#set-bonus-125")) $("#set-bonus-125").value = formatBrPctInput(s.metaBonus125);
    if ($("#set-bonus-150")) $("#set-bonus-150").value = formatBrPctInput(s.metaBonus150);
    if ($("#set-team-name")) $("#set-team-name").value = s.teamName || "";
    if ($("#set-team-plan")) $("#set-team-plan").value = s.teamPlan || "";
    if ($("#team-name")) $("#team-name").textContent = s.teamName || "";
    if ($("#team-plan")) $("#team-plan").textContent = s.teamPlan || "";
  }

  async function saveSettingsFromForms(e, part) {
    e?.preventDefault?.();
    const status = $(part === "metas" ? "#settings-status-metas" : "#settings-status-taxes");
    if (state.settingsSaving) return;
    state.settingsSaving = true;
    try {
      const all = readSettingsFromForms();
      const payload = part === "metas"
        ? {
            metaBase: all.metaBase,
            metaDias: all.metaDias,
            metaBonus100: all.metaBonus100,
            metaBonus125: all.metaBonus125,
            metaBonus150: all.metaBonus150,
          }
        : {
            taxRate: all.taxRate,
            metaTaxRate: all.metaTaxRate,
            teamName: all.teamName,
            teamPlan: all.teamPlan,
          };
      const s = await api("/api/settings", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      state.settings = {
        taxRate: s.taxRate != null ? Number(s.taxRate) : (payload.taxRate != null ? payload.taxRate : state.settings.taxRate),
        metaTaxRate: s.metaTaxRate != null ? Number(s.metaTaxRate) : (payload.metaTaxRate != null ? payload.metaTaxRate : state.settings.metaTaxRate),
        metaBase: s.metaBase != null ? Number(s.metaBase) : (payload.metaBase != null ? payload.metaBase : state.settings.metaBase),
        metaDias: s.metaDias !== undefined && s.metaDias !== null ? Number(s.metaDias) : (part === "metas" ? all.metaDias : state.settings.metaDias),
        metaBonus100: s.metaBonus100 != null ? Number(s.metaBonus100) : (payload.metaBonus100 != null ? payload.metaBonus100 : state.settings.metaBonus100),
        metaBonus125: s.metaBonus125 != null ? Number(s.metaBonus125) : (payload.metaBonus125 != null ? payload.metaBonus125 : state.settings.metaBonus125),
        metaBonus150: s.metaBonus150 != null ? Number(s.metaBonus150) : (payload.metaBonus150 != null ? payload.metaBonus150 : state.settings.metaBonus150),
        teamName: s.teamName != null ? s.teamName : (payload.teamName != null ? payload.teamName : state.settings.teamName),
        teamPlan: s.teamPlan != null ? s.teamPlan : (payload.teamPlan != null ? payload.teamPlan : state.settings.teamPlan),
      };
      paintSettingsForms(state.settings);
      cacheMetaProjSettings(state.settings);
      if (status) {
        status.className = "form-status ok";
        status.textContent = part === "metas" ? "Metas e bônus salvos no banco." : "Impostos e equipe salvos no banco.";
      }
      loadDashboard({ force: false }).catch(() => {});
    } catch (err) {
      if (status) {
        status.className = "form-status err";
        status.textContent = err.message;
      }
    } finally {
      state.settingsSaving = false;
    }
  }

  async function bootApp() {
    SyncNotify.registerPush();
    setDashLoading(true);
    loadDashboard({ force: false }).catch(() => {});
    await Promise.all([
      loadCredentials(),
      loadMetaCreds(),
      loadSettingsUi(),
    ]);
  }

  function startAutoSyncPoller() {
    const POLL_MS = 2 * 60 * 1000;
    setInterval(async () => {
      if (!getToken()) return;
      try {
        const start = $("#start-date")?.value;
        const end = $("#end-date")?.value;
        if (!start || !end) return;
        const q = new URLSearchParams({ start, end });
        const dash = await api(`/api/dashboard?${q}`, { dedupeKey: "bg-poll" });
        applyDash(dash, { cached: true, userTriggered: false });
      } catch (_) { /* silent */ }
    }, POLL_MS);
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
      startAutoSyncPoller();
    } catch {
      clearSession();
      showAuth();
    }
  }

  boot();
})();
