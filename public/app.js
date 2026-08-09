(() => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];

  const state = {
    view: "dashboard",
    dash: null,
    configured: false,
  };

  function fmt(v) {
    return "R$ " + Number(v || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  function fmtNum(v) {
    return Number(v || 0).toLocaleString("pt-BR");
  }
  function fmtPct(v) {
    return Number(v || 0).toFixed(1).replace(".", ",") + "%";
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }
  function daysAgoISO(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }

  function setView(view) {
    state.view = view;
    $$(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
    $("#view-dashboard").classList.toggle("hidden", view !== "dashboard");
    $("#view-subids").classList.toggle("hidden", view !== "subids");
    $("#view-config").classList.toggle("hidden", view !== "config");
    $("#crumb-label").textContent =
      view === "config" ? "Configuração API" : view === "subids" ? "Por SubID" : "Painel de Lucro";
  }

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
      ...opts,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      const err = new Error(json.error || `HTTP ${res.status}`);
      err.code = json.code;
      throw err;
    }
    return json;
  }

  async function loadCredentials() {
    const c = await api("/api/credentials");
    state.configured = Boolean(c.configured);
    $("#sidebar-status").textContent = c.configured
      ? `APP ${c.appId} · ${c.secretMasked}`
      : "API não configurada";
    if (c.appId) $("#app-id").value = c.appId;
    const banner = $("#sync-banner");
    if (c.configured) {
      banner.className = "banner ok";
      banner.innerHTML = "API Shopee configurada. Use <strong>Sincronizar Shopee</strong> para puxar o período.";
    } else {
      banner.className = "banner";
      banner.innerHTML = 'Configure a API Shopee em <button type="button" class="linkish" data-goto="config">Configuração</button> para puxar vendas reais.';
      banner.querySelector("[data-goto]")?.addEventListener("click", () => setView("config"));
    }
    return c;
  }

  function renderKpis(k) {
    const cards = [
      { label: "Faturamento", value: fmt(k.faturamento), sub: "GMV válido (sem cancelados)" },
      { label: "Comissão", value: fmt(k.comissao), sub: "totalCommission / net" },
      { label: "Pedidos", value: fmtNum(k.pedidos), sub: `${fmtNum(k.subIdsCount)} SubIDs` },
      { label: "Abatimento", value: fmtPct(k.abatimento), sub: "comissão ÷ faturamento" },
    ];
    $("#kpi-grid").innerHTML = cards.map((c) => `
      <div class="kpi">
        <div class="kpi-label">${c.label}</div>
        <div class="kpi-value">${c.value}</div>
        <div class="kpi-sub">${c.sub}</div>
      </div>
    `).join("");

    $("#status-row").innerHTML = `
      <div class="status-card ok"><div class="l">Concluídos</div><div class="v">${fmtNum(k.concluidos)}</div></div>
      <div class="status-card warn"><div class="l">Pendentes</div><div class="v">${fmtNum(k.pendentes)}</div></div>
      <div class="status-card bad"><div class="l">Cancelados</div><div class="v">${fmtNum(k.cancelados)}</div></div>
      <div class="status-card"><div class="l">Não pagos</div><div class="v">${fmtNum(k.unpaid)}</div></div>
    `;
  }

  function renderDaily(daily) {
    const max = Math.max(...daily.map((d) => d.comissao), 1);
    $("#daily-bars").innerHTML = daily.map((d) => {
      const h = Math.max(4, Math.round((d.comissao / max) * 120));
      const label = d.data.slice(5).replace("-", "/");
      return `
        <div class="bar-col" title="${d.data}: ${fmt(d.comissao)}">
          <div class="bar-val">${fmt(d.comissao).replace("R$ ", "")}</div>
          <div class="bar" style="height:${h}px"></div>
          <div class="bar-label">${label}</div>
        </div>
      `;
    }).join("") || `<div class="panel-sub" style="padding:20px">Sem dados no período.</div>`;
  }

  function renderSubIds(list) {
    const q = ($("#subid-search").value || "").trim().toLowerCase();
    const rows = (list || []).filter((r) => !q || r.subid.toLowerCase().includes(q));
    $("#subid-tbody").innerHTML = rows.map((r) => `
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
    `).join("") || `<tr><td colspan="8">Nenhum SubID neste período.</td></tr>`;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function applyDash(dash, { cached } = {}) {
    state.dash = dash;
    renderKpis(dash.kpis || {});
    renderDaily(dash.daily || []);
    renderSubIds(dash.subIds || []);
    const when = dash.syncedAt ? new Date(dash.syncedAt).toLocaleString("pt-BR") : "—";
    $("#sync-meta").textContent = `${cached ? "cache · " : ""}${dash.nodes || 0} nodes · ${when}`;
  }

  async function loadDashboard({ force = false } = {}) {
    const start = $("#start-date").value;
    const end = $("#end-date").value;
    const btn = force ? $("#btn-sync") : $("#btn-load");
    btn.disabled = true;
    btn.textContent = force ? "Sincronizando…" : "Carregando…";
    try {
      const q = new URLSearchParams({ start, end });
      if (force) q.set("force", "1");
      const dash = await api(`/api/dashboard?${q}`);
      applyDash(dash, { cached: dash.cached });
      const banner = $("#sync-banner");
      banner.className = "banner ok";
      banner.textContent = `Período ${start} → ${end}: ${fmt(dash.kpis.comissao)} de comissão · ${fmtNum(dash.kpis.pedidos)} pedidos.`;
    } catch (err) {
      const banner = $("#sync-banner");
      banner.className = "banner err";
      banner.textContent = err.message || String(err);
      if (err.code === "CREDS_MISSING") setView("config");
    } finally {
      btn.disabled = false;
      btn.textContent = force ? "Sincronizar Shopee" : "Atualizar";
    }
  }

  function wire() {
    $("#start-date").value = daysAgoISO(6);
    $("#end-date").value = todayISO();

    $$(".nav-item").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
    document.body.addEventListener("click", (e) => {
      const t = e.target.closest("[data-goto]");
      if (t) setView(t.dataset.goto);
    });

    $("#btn-load").addEventListener("click", () => loadDashboard({ force: false }));
    $("#btn-sync").addEventListener("click", () => loadDashboard({ force: true }));
    $("#subid-search").addEventListener("input", () => renderSubIds(state.dash?.subIds || []));

    $("#cred-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const status = $("#cred-status");
      status.className = "form-status";
      status.textContent = "Salvando…";
      try {
        const saved = await api("/api/credentials", {
          method: "POST",
          body: JSON.stringify({
            appId: $("#app-id").value.trim(),
            secret: $("#app-secret").value.trim(),
          }),
        });
        status.className = "form-status ok";
        status.textContent = saved.reset
          ? "API trocada — dados anteriores resetados. Clique em Sincronizar."
          : (saved.message || "Credenciais salvas no Supabase.");
        $("#app-secret").value = "";
        await loadCredentials();
        if (saved.reset) {
          state.dash = null;
          renderKpis({});
          renderDaily([]);
          renderSubIds([]);
        }
      } catch (err) {
        status.className = "form-status err";
        status.textContent = err.message;
      }
    });

    $("#btn-test").addEventListener("click", async () => {
      const status = $("#cred-status");
      status.className = "form-status";
      status.textContent = "Testando API…";
      try {
        const r = await api("/api/credentials/test", { method: "POST", body: "{}" });
        const nome = r.sample?.productName || "ok";
        status.className = "form-status ok";
        status.textContent = `API OK — amostra: ${nome}`;
      } catch (err) {
        status.className = "form-status err";
        status.textContent = err.message;
      }
    });
  }

  async function boot() {
    wire();
    await loadCredentials();
    if (state.configured) {
      await loadDashboard({ force: false });
    }
  }

  boot();
})();
