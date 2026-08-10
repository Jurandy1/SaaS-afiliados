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
    const isAdmin = user?.role === "admin" || user?.profile?.role === "admin";
    const adminLink = $("#admin-entry");
    if (adminLink) adminLink.classList.toggle("hidden", !isAdmin);
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
    $("#app-shell").classList.add("hidden");
  }

  const DATA_VIEWS = new Set(["produtos", "campanhas", "pedidos"]);

  const VIEW_LABELS = {
    dashboard: "Painel de Lucro",
    subids: "SubIDs",
    canais: "Canais e status",
    config: "Configurações",
    produtos: "Produtos",
    campanhas: "Campanhas",
    pedidos: "Pedidos",
  };

  const SPARK = {
    up: "M0,18 L14,14 L28,15 L42,10 L56,11 L70,7 L84,5 L100,3",
    upFill: "M0,18 L14,14 L28,15 L42,10 L56,11 L70,7 L84,5 L100,3 L100,22 L0,22 Z",
    flat: "M0,11 L14,10 L28,12 L42,9 L56,11 L70,10 L84,12 L100,11",
    flatFill: "M0,11 L14,10 L28,12 L42,9 L56,11 L70,10 L84,12 L100,11 L100,22 L0,22 Z",
  };

  const state = {
    view: "dashboard",
    channel: "geral",
    tab: "Geral",
    dash: null,
    configured: false,
    metaConfigured: false,
    settings: { metaBase: 863959, taxRate: 11.7, metaTaxRate: 12, teamName: "SaaS SHOPPE", teamPlan: "Shopee · Meta" },
    subidPage: 1,
    subidPageFull: 1,
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
  };

  function fmt(v) {
    return "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtNum(v) {
    return Number(v || 0).toLocaleString("pt-BR");
  }
  function fmtPct(v) {
    if (v == null || Number.isNaN(Number(v))) return "—";
    return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
  }

  /** Invest usado no ROI (Meta com imposto + Pin), alinhado ao painel de referência. */
  function investForRoi(r) {
    if (!r) return 0;
    if (r.inv_meta_taxed != null || r.inv_pin != null) {
      const taxed = r.inv_meta_taxed != null
        ? Number(r.inv_meta_taxed)
        : Number(r.inv_meta || 0) * (1 + Number(state.settings.metaTaxRate != null ? state.settings.metaTaxRate : 12) / 100);
      return taxed + Number(r.inv_pin || 0);
    }
    return Number(r.inv_total || 0);
  }

  function displayRoi(r) {
    if (!r) return null;
    const inv = investForRoi(r);
    if (inv <= 0) return null;
    if (r.roi != null && Number.isFinite(Number(r.roi))) return Number(r.roi);
    const lucro = r.lucro != null
      ? Number(r.lucro)
      : Number(r.comissao || 0) * (1 - Number(state.settings.taxRate || 0) / 100) - inv;
    return (lucro / inv) * 100;
  }

  function roiClass(roi) {
    if (roi == null || !Number.isFinite(Number(roi))) return "";
    return Number(roi) >= 0 ? "green" : "neg";
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
  function formatBrMoneyInput(v) {
    return Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function formatBrPctInput(v) {
    return Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
    const view = navKey === "integracoes" ? "config" : navKey;
    state.view = view;
    if (view === "dashboard" && state.channel === "subid") state.channel = "geral";

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
    $("#view-canais")?.classList.toggle("hidden", view !== "canais");
    $("#view-config").classList.toggle("hidden", view !== "config");
    $("#view-data").classList.toggle("hidden", !isData);
    $("#crumb-label").textContent = VIEW_LABELS[navKey] || VIEW_LABELS[view] || view;
    setSidebarOpen(false);

    if (view === "dashboard") applyChannelView();
    if (view === "subids") renderSubIdsFull();
    if (view === "canais") renderOpsTable();
    if (isData) loadDataView(view);
  }

  function sparkSvg(path, fill, color) {
    return `<svg viewBox="0 0 100 22" preserveAspectRatio="none">
      <path d="${path}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${fill}" fill="${color}" fill-opacity="0.08"/>
    </svg>`;
  }

  function renderKpis(k) {
    const invMeta = Number(k.inv_meta || 0);
    const invPin = Number(k.inv_pin || 0);
    const invTotal = Number(k.inv_total || 0);
    const lucro = k.lucro != null ? Number(k.lucro) : Number(k.comissao || 0) - invTotal;
    const C_ACCENT = "#22d3a4";
    const C_GOLD = "#e4b84a";
    const C_MUTED = "#5a5f6b";
    const C_RED = "#f87171";
    const C_META = "#6c9bf5";
    const C_PIN = "#ea5c86";
    const cards = [
      { label: "Lucro", value: fmt(lucro), delta: "após impostos", on: true, color: lucro >= 0 ? C_ACCENT : C_RED, spark: SPARK.up, fill: SPARK.upFill, tone: lucro >= 0 ? "pos" : "neg", hero: true },
      { label: "Faturamento", value: fmt(k.faturamento), delta: "Shopee", on: true, color: C_GOLD, spark: SPARK.up, fill: SPARK.upFill, tone: "" },
      { label: "Comissão", value: fmt(k.comissao), delta: "Shopee", on: true, color: C_ACCENT, spark: SPARK.up, fill: SPARK.upFill, tone: "" },
      { label: "Invest. Meta", value: fmt(invMeta), delta: invMeta ? "bruto API" : "sem sync", on: invMeta > 0, color: invMeta ? C_META : C_MUTED, spark: SPARK.flat, fill: SPARK.flatFill, tone: "" },
      { label: "Invest. Pin", value: fmt(invPin), delta: invPin ? "CSV" : "manual", on: invPin > 0, color: invPin ? C_PIN : C_MUTED, spark: SPARK.flat, fill: SPARK.flatFill, tone: "" },
      { label: "Invest. Total", value: fmt(invTotal), delta: invTotal ? "c/ imposto Meta" : "bruto", on: invTotal > 0, color: invTotal ? C_GOLD : C_MUTED, spark: SPARK.flat, fill: SPARK.flatFill, tone: "" },
      { label: "ROI", value: fmtPct(k.roi), delta: invTotal ? "lucro/invest*" : "—", on: invTotal > 0, color: C_ACCENT, spark: SPARK.up, fill: SPARK.upFill, tone: invTotal > 0 ? "pos" : "" },
      { label: "Abatimento", value: fmtPct(k.abatimento), delta: `${fmtNum(k.pedidos)} ped.`, on: true, color: C_MUTED, spark: SPARK.flat, fill: SPARK.flatFill, tone: "" },
    ];
    $("#kpi-grid").innerHTML = cards.map((c) => `
      <div class="kpi${c.hero ? " kpi--hero" : ""}">
        <div class="kpi-top">
          <div class="kpi-label">${c.label}</div>
          <span class="kpi-delta ${c.on ? "on" : "off"}">${c.delta}</span>
        </div>
        <div class="kpi-value ${c.tone || ""}">${c.value}</div>
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
    const left = Math.max(1, daysLeftInMonth());
    const sub = $("#proj-sub");
    if (sub) {
      sub.innerHTML = `Faturamento <strong class="mono">${fmt(fat)}</strong> · base <strong class="mono">${fmt(base)}</strong> · ${left} dias restantes`;
    }
    const headers = [`<div class="h">% Bônus s/ faturamento</div>`].concat(targets.map((t) => `<div class="h r">${t.label}</div>`)).join("");
    const rowFat = [`<div class="c">Faturamento para atingir</div>`].concat(targets.map((t) => `<div class="c r mono">${fmt(base * t.mult)}</div>`)).join("");
    const rowBonus = [`<div class="c hi">Valor do bônus meta</div>`].concat(targets.map((t) => `<div class="c r green">${fmt(base * t.mult * t.bonusPct)}</div>`)).join("");
    const rowDaily = [`<div class="c">Faturamento diário necessário</div>`].concat(targets.map((t) => {
      const need = Math.max(0, base * t.mult - fat) / left;
      return `<div class="c r mono">${fmt(need)}</div>`;
    })).join("");
    const rowProg = [`<div class="c">Progresso da meta</div>`].concat(targets.map((t) => {
      const pct = Math.min(100, (fat / (base * t.mult)) * 100);
      const bg = pct >= 100 ? "#22d3a4" : pct >= 66 ? "#e4b84a" : "#f0888a";
      return `<div class="c r"><div class="prog-row"><div class="prog-bar"><i style="width:${pct.toFixed(1)}%;background:${bg}"></i></div><span class="prog-pct" style="color:${bg}">${pct.toFixed(1).replace(".", ",")}%</span></div></div>`;
    })).join("");
    const html = headers + rowFat + rowBonus + rowDaily + rowProg;
    const dashGrid = $("#proj-grid-dash");
    const cfgGrid = $("#proj-grid");
    if (dashGrid) dashGrid.innerHTML = html;
    if (cfgGrid) cfgGrid.innerHTML = html;
  }

  function renderChart(daily) {
    const rows = daily || [];
    if (!rows.length) {
      $("#daily-chart").innerHTML = `<div class="panel-sub" style="padding:8px 0">Sem dados no período.</div>`;
      return;
    }
    const vals = rows.map((d) => Number(d.lucro != null ? d.lucro : Number(d.comissao || 0) - Number(d.inv_total || 0)));
    const maxAbs = Math.max(...vals.map((v) => Math.abs(v)), 1);
    const n = rows.length;
    const cols = rows.map((d, i) => {
      const lucro = vals[i];
      const h = Math.max(4, Math.round((Math.abs(lucro) / maxAbs) * 100));
      const cls = lucro >= 0 ? "fat" : "loss";
      const sign = lucro >= 0 ? "+" : "";
      return `
        <div class="chart-col" title="${d.data}: ${fmt(lucro)}">
          <div class="chart-val ${lucro >= 0 ? "pos" : "neg"}">${sign}${fmt(lucro).replace("R$ ", "")}</div>
          <div class="chart-pair">
            <div class="chart-bar ${cls}" style="height:${h}%"></div>
          </div>
        </div>`;
    }).join("");
    const labels = rows.map((d) => `<span>${chartDay(d.data)}</span>`).join("");
    $("#daily-chart").innerHTML = `
      <div class="chart-inner">
        <div class="chart-ylabels">
          <span>${fmt(maxAbs).replace("R$ ", "")}</span>
          <span>${fmt(maxAbs * 0.5).replace("R$ ", "")}</span>
          <span>0</span>
        </div>
        <div class="chart-plot">
          <div class="chart-grid"><i style="top:0"></i><i style="top:50%"></i><i style="top:100%"></i></div>
          <div class="chart-bars" style="grid-template-columns:repeat(${n},1fr)">${cols}</div>
          <div class="chart-labels" style="grid-template-columns:repeat(${n},1fr)">${labels}</div>
        </div>
      </div>`;
  }

  function renderSuggestions(dash) {
    const el = $("#suggestions-body");
    if (!el) return;
    const ch = state.channel;
    if (ch !== "geral" && ch !== "meta") {
      el.innerHTML = `<div class="panel-sub" style="padding:12px 20px">Sugestões disponíveis na visão Geral ou Meta.</div>`;
      return;
    }
    const subs = (dash?.subIds || []).filter((s) => (s.canal || "meta") === "meta");
    const tips = [];
    for (const s of subs) {
      const days = [...(s.daily || [])].sort((a, b) => String(a.data).localeCompare(String(b.data)));
      const last15 = days.slice(-15);
      const inv15 = last15.reduce((a, d) => a + Number(d.inv_meta || 0), 0);
      const lucro15 = last15.reduce((a, d) => a + Number(d.lucro || 0), 0);
      const roi15 = inv15 > 0 ? (lucro15 / inv15) * 100 : Number(s.roi);
      const inv = Number(s.inv_meta || s.inv_total || 0);
      const lucro = Number(s.lucro || 0);
      const st = s.status || "ativa";
      const roi = Number.isFinite(roi15) ? roi15 : Number(s.roi);

      if (st === "ativa" && Number.isFinite(roi) && roi < 40 && inv > 0) {
        tips.push({
          subid: s.subid,
          kind: "desativar",
          reason: `ROI 15d ${fmtPct(roi)} abaixo de 40%`,
          action: "Considerar pausar",
        });
      } else if (st === "ativa" && Number.isFinite(roi) && roi >= 40 && inv > 0) {
        const recent = last15.filter((d) => Number(d.inv_meta || 0) > 0).slice(-4);
        if (recent.length >= 4 && recent.every((d) => Number(d.roi || 0) >= 0)) {
          const avg = recent.reduce((a, d) => a + Number(d.inv_meta || 0), 0) / recent.length;
          tips.push({
            subid: s.subid,
            kind: "escalar",
            reason: "4 dias com ROI ≥ 0 e ROI 15d ≥ 40%",
            action: `Escalar ~${fmt(avg * 0.2)} (+20%)`,
          });
        }
      } else if (st === "teste" && Number.isFinite(roi) && roi <= -70) {
        tips.push({
          subid: s.subid,
          kind: "desativar",
          reason: `Teste com ROI ${fmtPct(roi)} (≤ −70%)`,
          action: "Encerrar teste",
        });
      } else if (st === "teste" && lucro > 0 && Number.isFinite(roi) && roi > 0) {
        tips.push({
          subid: s.subid,
          kind: "promover",
          reason: "Teste com ROI positivo",
          action: "Promover para Ativa",
        });
      }
    }
    if (!tips.length) {
      el.innerHTML = `<div class="banner ok" style="margin:12px 16px">Sem sugestões no momento — Meta está estável no período.</div>`;
      return;
    }
    el.innerHTML = `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>SubID</th><th>Tipo</th><th>Motivo</th><th>Sugestão</th></tr></thead>
      <tbody>${tips.map((t) => `<tr>
        <td class="subid">${escapeHtml(t.subid)}</td>
        <td>${escapeHtml(t.kind)}</td>
        <td>${escapeHtml(t.reason)}</td>
        <td>${escapeHtml(t.action)}</td>
      </tr>`).join("")}</tbody>
    </table></div>`;
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

    if (state.dailyRows.length) {
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

  function canalLabel(c) {
    if (c === "meta") return "Meta";
    if (c === "pinterest") return "Pinterest";
    if (c === "organico") return "Orgânico";
    return c || "—";
  }

  function statusLabel(s) {
    if (s === "teste") return "Em Teste";
    if (s === "pausada") return "Pausada";
    return "Ativa";
  }

  function statusPillHtml(status) {
    const st = status || "ativa";
    return `<span class="status-pill st-${st}"><i></i>${statusLabel(st)}</span>`;
  }

  function canalChipHtml(canal) {
    const c = canal || "meta";
    return `<span class="canal-chip ch-${c}">${canalLabel(c)}</span>`;
  }

  function filteredSubIds(list, q, channel) {
    const query = (q || "").trim().toLowerCase();
    const ch = channel != null ? channel : state.channel;
    return (list || []).filter((r) => {
      if (query && !String(r.subid).toLowerCase().includes(query)) return false;
      if (!ch || ch === "geral" || ch === "subid") return true;
      return (r.canal || "meta") === ch;
    });
  }

  function kpisFromSubIds(subs, baseKpis) {
    const list = subs || [];
    const fat = list.reduce((a, r) => a + Number(r.faturamento || 0), 0);
    const com = list.reduce((a, r) => a + Number(r.comissao || 0), 0);
    const invMeta = list.reduce((a, r) => a + Number(r.inv_meta || 0), 0);
    const invPin = list.reduce((a, r) => a + Number(r.inv_pin || 0), 0);
    const pedidos = list.reduce((a, r) => a + Number(r.pedidos || 0), 0);
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
      }
    }
    applyChannelView();
    renderOpsTable();
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
    el.addEventListener("click", (e) => {
      if (e.target.closest("select[data-op]")) e.stopPropagation();
    });
  }

  function applyChannelView() {
    const ch = state.channel || "geral";
    $$("#channel-tabs .channel-tab").forEach((b) => {
      b.classList.toggle("active", b.dataset.channel === ch);
    });
    const dash = state.dash;
    if (!dash) {
      renderKpis({});
      renderProjection({});
      renderSuggestions(null);
      renderChart([]);
      return;
    }

    const channelSubs = filteredSubIds(dash.subIds || [], "", ch === "subid" ? "geral" : ch);
    const k = !ch || ch === "geral" || ch === "subid"
      ? (dash.kpis || {})
      : kpisFromSubIds(channelSubs, dash.kpis);
    renderKpis(k);
    renderProjection(dash.kpis || {});
    renderSuggestions(dash);
    renderChart(dash.daily || []);
    renderDailyTable(dash.daily || [], dash.kpis || {});
    renderSubIdsDash();

    const showMetas = ch === "geral";
    const showSug = ch === "geral" || ch === "meta";
    $("#dash-metas-panel")?.classList.toggle("hidden", !showMetas);
    $("#dash-suggestions-panel")?.classList.toggle("hidden", !showSug);
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
      const canal = r.canal || "meta";
      const status = r.status || "ativa";
      return `<tr>
        <td class="subid">${escapeHtml(id)}</td>
        <td>
          <select class="op-select" data-op="canal" data-subid="${escapeHtml(id)}">
            <option value="meta" ${canal === "meta" ? "selected" : ""}>Meta</option>
            <option value="pinterest" ${canal === "pinterest" ? "selected" : ""}>Pinterest</option>
            <option value="organico" ${canal === "organico" ? "selected" : ""}>Orgânico</option>
          </select>
        </td>
        <td>
          <select class="op-select" data-op="status" data-subid="${escapeHtml(id)}">
            <option value="ativa" ${status === "ativa" ? "selected" : ""}>Ativa</option>
            <option value="teste" ${status === "teste" ? "selected" : ""}>Em Teste</option>
            <option value="pausada" ${status === "pausada" ? "selected" : ""}>Pausada</option>
          </select>
        </td>
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
      if (last && i - last > 1) btns.push(`<span style="padding:5px 4px;color:#a3a3a3">...</span>`);
      btns.push(`<button type="button" class="${i === page ? "active" : ""}" data-p="${i}">${i}</button>`);
      last = i;
    });
    btns.push(`<button type="button" data-p="${page + 1}" ${page >= pages ? "disabled" : ""}>Proximo</button>`);
    el.innerHTML = `
      <div>Exibindo <strong style="color:var(--text)">${from}–${to}</strong> de <strong style="color:var(--text)">${fmtNum(total)}</strong></div>
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
        <td class="num">${fmt(d.comissao)}</td>
        <td class="num">${fmt(inv)}</td>
        <td class="num ${lucro >= 0 ? "green" : "neg"}">${fmt(lucro)}</td>
        <td class="num ${roiClass(roi)}">${fmtPct(roi)}</td>
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
                <td class="num">${fmt(totCom)}</td>
                <td class="num">${fmt(totInv)}</td>
                <td class="num ${totLucro >= 0 ? "green" : "neg"}">${fmt(totLucro)}</td>
                <td class="num ${roiClass(totRoi)}">${fmtPct(totRoi)}</td>
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
    let all = filteredSubIds(state.dash?.subIds || [], $("#subid-search")?.value);
    const statusRank = { ativa: 0, teste: 1, pausada: 2 };
    all = sortRows(all, state.subidSort.key || "status", state.subidSort.dir || "asc", (r) => {
      if (state.subidSort.key === "subid") return r.subid;
      if (state.subidSort.key === "canal") return r.canal || "";
      if (state.subidSort.key === "status" || !state.subidSort.key) return statusRank[r.status || "ativa"] ?? 9;
      if (state.subidSort.key === "roi") return displayRoi(r);
      if (state.subidSort.key === "inv_total") return investForRoi(r);
      if (state.subidSort.key === "lucro") return r.lucro != null ? Number(r.lucro) : Number(r.comissao || 0) - investForRoi(r);
      return r[state.subidSort.key];
    });
    paintSortHeaders("#subid-table thead", state.subidSort);
    const total = all.length;
    const pages = Math.max(1, Math.ceil(total / state.pageSize));
    if (state.subidPage > pages) state.subidPage = pages;
    const slice = all.slice((state.subidPage - 1) * state.pageSize, state.subidPage * state.pageSize);
    $("#subid-count-pill").textContent = fmtNum(total);
    $("#nav-subid-count").textContent = fmtNum(state.dash?.subIds?.length || 0);
    $("#subid-tbody").innerHTML = slice.map((r) => {
      const id = String(r.subid || "");
      const open = Boolean(state.expandedSubIds[id]);
      const inv = investForRoi(r);
      const roi = displayRoi(r);
      const lucro = r.lucro != null ? Number(r.lucro) : Number(r.comissao || 0) - inv;
      const main = `<tr class="subid-row ${open ? "is-open" : ""}" data-subid="${escapeHtml(id)}">
        <td class="subid" data-subid="${escapeHtml(id)}" title="Clique para ver o historico diario">
          <span class="subid-caret"></span>
          ${escapeHtml(id)}
        </td>
        <td>${canalChipHtml(r.canal)}</td>
        <td class="num">${fmt(r.faturamento)}</td>
        <td class="num">${fmt(r.comissao)}</td>
        <td class="num">${fmt(inv)}</td>
        <td class="num ${lucro >= 0 ? "green" : "neg"}">${fmt(lucro)}</td>
        <td class="num ${roiClass(roi)}">${fmtPct(roi)}</td>
        <td class="num">${fmtNum(r.pedidos)}</td>
        <td>${statusPillHtml(r.status)}</td>
      </tr>`;
      return open ? main + subIdDailyHistoryHtml(r, 9) : main;
    }).join("") || `<tr><td colspan="9">Nenhum SubID neste período.</td></tr>`;
    wireSubIdExpand("#subid-tbody", renderSubIdsDash);
    renderPager($("#subid-pager"), state.subidPage, total, state.pageSize, (p) => {
      state.subidPage = p;
      renderSubIdsDash();
    });
  }

  function renderSubIdsFull() {
    let all = filteredSubIds(state.dash?.subIds || [], $("#subid-search-full")?.value, "geral");
    const statusRank = { ativa: 0, teste: 1, pausada: 2 };
    all = sortRows(all, state.subidSort.key, state.subidSort.dir, (r) => {
      if (state.subidSort.key === "subid") return r.subid;
      if (state.subidSort.key === "canal") return r.canal || "";
      if (state.subidSort.key === "status") return statusRank[r.status || "ativa"] ?? 9;
      if (state.subidSort.key === "roi") return displayRoi(r);
      if (state.subidSort.key === "inv_total") return investForRoi(r);
      if (state.subidSort.key === "lucro") return r.lucro != null ? Number(r.lucro) : Number(r.comissao || 0) - investForRoi(r);
      return r[state.subidSort.key];
    });
    paintSortHeaders("#subid-table-full thead", state.subidSort);
    const total = all.length;
    const pages = Math.max(1, Math.ceil(total / state.pageSize));
    if (state.subidPageFull > pages) state.subidPageFull = pages;
    const slice = all.slice((state.subidPageFull - 1) * state.pageSize, state.subidPageFull * state.pageSize);
    $("#subid-tbody-full").innerHTML = slice.map((r) => {
      const id = String(r.subid || "");
      const open = Boolean(state.expandedSubIds[id]);
      const inv = investForRoi(r);
      const roi = displayRoi(r);
      const lucro = r.lucro != null ? Number(r.lucro) : Number(r.comissao || 0) - inv;
      const main = `<tr class="subid-row ${open ? "is-open" : ""}" data-subid="${escapeHtml(id)}">
        <td class="subid" data-subid="${escapeHtml(id)}" title="Clique para ver o historico diario">
          <span class="subid-caret"></span>
          ${escapeHtml(id)}
        </td>
        <td>${canalChipHtml(r.canal)}</td>
        <td>${statusPillHtml(r.status)}</td>
        <td class="num">${fmt(r.faturamento)}</td>
        <td class="num">${fmt(r.comissao)}</td>
        <td class="num">${fmt(inv)}</td>
        <td class="num ${lucro >= 0 ? "green" : "neg"}">${fmt(lucro)}</td>
        <td class="num ${roiClass(roi)}">${fmtPct(roi)}</td>
        <td class="num">${fmtNum(r.pedidos)}</td>
      </tr>`;
      return open ? main + subIdDailyHistoryHtml(r, 9) : main;
    }).join("") || `<tr><td colspan="9">Nenhum SubID.</td></tr>`;
    wireSubIdExpand("#subid-tbody-full", renderSubIdsFull);
    renderPager($("#subid-pager-full"), state.subidPageFull, total, state.pageSize, (p) => {
      state.subidPageFull = p;
      renderSubIdsFull();
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
      } else if (view === "metas") {
        const base = Number(state.settings.metaBase || 0);
        paintDataTable(
          [{ label: "Campo", key: "label" }, { label: "Valor", num: true, key: "value" }],
          [
            { label: "Meta base", value: fmt(base) },
            { label: "Faturamento do período", value: fmt(k.faturamento) },
            { label: "Progresso da meta (100%)", value: fmtPct(base ? (Number(k.faturamento || 0) / base) * 100 : 0) },
            { label: "Bônus 1% ao atingir 100%", value: fmt(base * 0.01) },
            { label: "Bônus 2% ao atingir 125%", value: fmt(base * 1.25 * 0.02) },
            { label: "Bônus 3% ao atingir 150%", value: fmt(base * 1.5 * 0.03) },
          ],
        );
        $("#data-sub").textContent = `Meta base ${fmt(base)} · faturamento ${fmt(k.faturamento)}`;
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
            { label: "Meta base", value: fmt(state.settings.metaBase) },
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
    state.subidPageFull = 1;
    const k = dash.kpis || {};
    applyChannelView();
    renderSubIdsFull();
    renderOpsTable();
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
        metaTaxRate: s.metaTaxRate != null ? s.metaTaxRate : 12,
        teamName: s.teamName,
        teamPlan: s.teamPlan,
      };
      $("#set-meta-base").value = formatBrMoneyInput(s.metaBase);
      $("#set-tax").value = formatBrPctInput(s.taxRate);
      if ($("#set-meta-tax")) $("#set-meta-tax").value = formatBrPctInput(state.settings.metaTaxRate);
      $("#set-team-name").value = s.teamName;
      $("#set-team-plan").value = s.teamPlan;
      $("#team-name").textContent = s.teamName;
      $("#team-plan").textContent = s.teamPlan;
      state.metaBase = s.metaBase;
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
      const r = await api("/api/meta/sync", { method: "POST", body: JSON.stringify({ daysBack: 7 }) });
      if (status) {
        if (isBanner) {
          status.className = "banner ok";
          status.textContent = `Meta sync: ${r.gravados} linhas (${r.range?.since} a ${r.range?.until})`;
        } else {
          status.className = "form-status ok";
          status.textContent = `Meta sync: ${r.gravados} linhas (${r.range?.since} a ${r.range?.until})` +
            (r.erros?.length ? ` · avisos: ${r.erros.join("; ")}` : "");
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
      banner.textContent = `${start} a ${end}: ${fmt(dash.kpis.comissao)} comissão · ${fmt(dash.kpis.inv_total)} invest · ROI ${fmtPct(dash.kpis.roi)}`;
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
    function setAuthMode(mode) {
      authMode = mode;
      const isReg = mode === "register";
      $("#auth-tab-login")?.classList.toggle("active", !isReg);
      $("#auth-tab-register")?.classList.toggle("active", isReg);
      $("#auth-submit").textContent = isReg ? "Validar APIs e criar conta" : "Entrar";
      $("#register-extra")?.classList.toggle("hidden", !isReg);
      $("#auth-card")?.classList.toggle("register-mode", isReg);
      if (isReg) {
        if ($("#auth-email").value === "teste@gmail.com") $("#auth-email").value = "";
        if ($("#auth-password").value === "123456789") $("#auth-password").value = "";
        $("#auth-email").placeholder = "seu@email.com";
      } else {
        if (!$("#auth-email").value) $("#auth-email").value = "teste@gmail.com";
        if (!$("#auth-password").value) $("#auth-password").value = "123456789";
      }
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

    $$(".chip-btn").forEach((b) => b.addEventListener("click", () => setRange(b.dataset.range)));

    $("#btn-load").addEventListener("click", () => loadDashboard({ force: false }));
    $("#btn-sync").addEventListener("click", () => loadDashboard({ force: true }));
    $("#btn-export").addEventListener("click", exportCsv);
    $("#btn-edit-meta")?.addEventListener("click", () => setView("config"));
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

    $$("#channel-tabs .channel-tab").forEach((b) => {
      b.addEventListener("click", () => {
        const ch = b.dataset.channel;
        if (ch === "subid") {
          state.channel = "geral";
          setView("subids");
          return;
        }
        state.channel = ch || "geral";
        if (state.view !== "dashboard") setView("dashboard");
        else applyChannelView();
      });
    });

    $("#subid-search")?.addEventListener("input", () => { state.subidPage = 1; renderSubIdsDash(); });
    $("#subid-search-full")?.addEventListener("input", () => { state.subidPageFull = 1; renderSubIdsFull(); });
    $("#ops-search")?.addEventListener("input", () => { state.opsPage = 1; renderOpsTable(); });
    $("#ops-page-size")?.addEventListener("change", () => {
      state.opsPageSize = Number($("#ops-page-size").value) || 25;
      state.opsPage = 1;
      renderOpsTable();
    });
    wireSortHeaders("#subid-table thead", () => state.subidSort, () => {
      state.subidPage = 1;
      renderSubIdsDash();
      renderSubIdsFull();
    });
    wireSortHeaders("#subid-table-full thead", () => state.subidSort, () => {
      state.subidPageFull = 1;
      renderSubIdsDash();
      renderSubIdsFull();
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
        const metaBase = parseBrNumber($("#set-meta-base").value);
        const taxRate = parseBrNumber($("#set-tax").value);
        const metaTaxRate = parseBrNumber($("#set-meta-tax")?.value || "12");
        const s = await api("/api/settings", {
          method: "POST",
          body: JSON.stringify({
            metaBase,
            taxRate,
            metaTaxRate,
            teamName: $("#set-team-name").value.trim(),
            teamPlan: $("#set-team-plan").value.trim(),
          }),
        });
        state.settings = {
          metaBase: s.metaBase,
          taxRate: s.taxRate,
          metaTaxRate: s.metaTaxRate != null ? s.metaTaxRate : metaTaxRate,
          teamName: s.teamName,
          teamPlan: s.teamPlan,
        };
        $("#set-meta-base").value = formatBrMoneyInput(s.metaBase);
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

    const moneyInput = $("#set-meta-base");
    moneyInput?.addEventListener("blur", () => {
      moneyInput.value = formatBrMoneyInput(parseBrNumber(moneyInput.value));
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
      renderProjection({});
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
