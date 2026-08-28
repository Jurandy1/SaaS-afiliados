/* Radar de Supercomissões — varredura Shopee productOfferV2 */
(function (global) {
  "use strict";

  function $(sel, root) { return (root || document).querySelector(sel); }

  const state = {
    wired: false,
    busy: false,
    produtos: [],
    min: 20,
    visible: 5,
    listExpanded: false,
  };
  const MQ = "(max-width: 767px)";
  const PREVIEW = 5;
  const PAGE = 15;

  function isMobile() {
    return window.matchMedia(MQ).matches;
  }

  function visibleProdutos() {
    const q = ($("#radar-filter")?.value || "").trim().toLowerCase();
    const list = state.produtos || [];
    if (!q) return list;
    return list.filter((p) => {
      const nome = String(p.nome || "").toLowerCase();
      const loja = String(p.loja || "").toLowerCase();
      return nome.includes(q) || loja.includes(q);
    });
  }

  function setListMode() {
    const table = $("#radar-table");
    const cards = $("#radar-card-list");
    const mobile = isMobile();
    if (table) table.classList.toggle("is-mobile-hidden", mobile);
    if (cards) cards.classList.toggle("hidden", !mobile);
  }

  function paintEmpty(msg, isErr) {
    const tb = $("#radar-tbody");
    const cards = $("#radar-card-list");
    const cls = isErr ? "radar-empty radar-empty--err" : "radar-empty";
    setListMode();
    clearPager();
    if (isMobile()) {
      if (tb) tb.innerHTML = "";
      if (cards) cards.innerHTML = `<div class="${cls} radar-card-empty">${msg}</div>`;
    } else {
      if (cards) cards.innerHTML = "";
      if (tb) tb.innerHTML = `<tr><td colspan="7" class="${cls}">${msg}</td></tr>`;
    }
  }

  function clearPager() {
    const host = $("#radar-mobile-pager");
    if (host) host.remove();
  }

  function paintPager(shown, total) {
    clearPager();
    if (!isMobile() || !total) return;
    const wrap = $("#radar-card-list");
    if (!wrap) return;
    const rest = Math.max(0, total - shown);
    const pager = document.createElement("div");
    pager.id = "radar-mobile-pager";
    pager.className = "m-list-pager";
    let actions = "";
    if (!state.listExpanded && total > PREVIEW) {
      actions = `<button type="button" class="btn primary sm" data-radar-expand>Ver mais ${total - PREVIEW} produtos</button>`;
    } else if (state.listExpanded) {
      if (shown < total) {
        actions += `<button type="button" class="btn primary sm" data-radar-more>Carregar mais (${rest})</button>`;
      }
      actions += `<button type="button" class="btn ghost sm" data-radar-collapse>Recolher lista</button>`;
    }
    if (!actions && total <= PREVIEW) {
      pager.innerHTML = `<div class="m-list-pager-meta"><span>${shown} de ${total} produtos</span></div>`;
    } else {
      pager.innerHTML = `<div class="m-list-pager-meta"><span>${shown} de ${total} produtos</span></div><div class="m-list-pager-actions">${actions}</div>`;
    }
    wrap.appendChild(pager);
    pager.querySelector("[data-radar-expand]")?.addEventListener("click", (e) => {
      e.preventDefault();
      state.listExpanded = true;
      state.visible = Math.min(PAGE, total);
      paintTable();
    });
    pager.querySelector("[data-radar-more]")?.addEventListener("click", (e) => {
      e.preventDefault();
      state.visible = Math.min(state.visible + PAGE, total);
      paintTable();
    });
    pager.querySelector("[data-radar-collapse]")?.addEventListener("click", (e) => {
      e.preventDefault();
      state.listExpanded = false;
      state.visible = PREVIEW;
      paintTable();
    });
  }

  function paintTable() {
    const min = state.min || Number($("#radar-min")?.value || 15);
    const list = visibleProdutos();
    const q = ($("#radar-filter")?.value || "").trim();
    const pill = $("#radar-count-pill");
    if (pill) pill.textContent = String(list.length);
    setListMode();
    if (!state.produtos.length) {
      paintEmpty("Clique em Minerar para varrer a Shopee.");
      return;
    }
    if (!list.length) {
      paintEmpty(q ? `Nenhum produto para “${esc(q)}”.` : `Nada acima de ${esc(String(min))}%.`);
      return;
    }
    if (isMobile()) {
      if (!state.listExpanded) state.visible = Math.min(PREVIEW, list.length);
      const slice = list.slice(0, state.visible);
      renderCards(slice);
      paintPager(slice.length, list.length);
    } else {
      clearPager();
      renderRows(list, min);
    }
  }

  function brl(n) {
    return "R$ " + Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function pct(n) {
    return Number(n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";
  }
  function fmtNum(n) {
    return Number(n || 0).toLocaleString("pt-BR");
  }
  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function api(path, opts = {}) {
    if (typeof global.api === "function") return global.api(path, opts);
    const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
    const token = localStorage.getItem("metricly_access_token") || "";
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(path, { ...opts, headers, credentials: "include" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) throw new Error(json.error || res.statusText || `HTTP ${res.status}`);
    return json;
  }

  function thumb(p) {
    if (p.imagem) {
      return `<img src="${esc(p.imagem)}" alt="" width="56" height="56" class="radar-thumb" loading="lazy" />`;
    }
    return `<div class="radar-thumb radar-thumb--empty" aria-hidden="true"></div>`;
  }

  function actionsHtml(p) {
    return `<div class="radar-actions">
      <button type="button" class="radar-btn-backup" data-radar-backup="${esc(p.itemId)}">+ Backup</button>
      <a class="radar-btn-link" href="${esc(p.link || p.linkProduto || "#")}" target="_blank" rel="noopener" data-radar-link="${esc(p.itemId)}">Gerar Link</a>
    </div>`;
  }

  function renderRows(produtos, min) {
    const tb = $("#radar-tbody");
    const cards = $("#radar-card-list");
    if (cards) cards.innerHTML = "";
    if (!tb) return;
    if (!produtos.length) {
      tb.innerHTML = `<tr><td colspan="7" class="radar-empty">Nada acima de ${esc(String(min))}%. Tente outra palavra-chave.</td></tr>`;
      return;
    }
    tb.innerHTML = produtos.map((p) => `
      <tr>
        <td>
          <div class="radar-prod">
            ${thumb(p)}
            <div class="min-w-0">
              <p class="radar-nome">${esc(p.nome)}</p>
              <p class="radar-loja">Loja: ${esc(p.loja || "Shopee")}</p>
            </div>
          </div>
        </td>
        <td class="radar-price">${brl(p.preco)}</td>
        <td class="radar-cell-shopee">${pct(p.comissaoShopee)}</td>
        <td class="radar-cell-bonus">${pct(p.comissaoVendedor)}</td>
        <td class="radar-cell-total">${pct(p.comissaoTotal)}</td>
        <td>
          <div class="radar-metrics">
            <span>${fmtNum(p.vendas)} vendas</span>
            <span class="radar-star">★ ${(Number(p.rating) || 0).toFixed(1)}</span>
          </div>
        </td>
        <td class="radar-actions-cell">${actionsHtml(p)}</td>
      </tr>`).join("");
  }

  function renderCards(produtos) {
    const tb = $("#radar-tbody");
    const cards = $("#radar-card-list");
    if (tb) tb.innerHTML = "";
    if (!cards) return;
    cards.innerHTML = produtos.map((p) => `
      <article class="radar-card" role="listitem">
        <div class="radar-card-top">
          ${thumb(p)}
          <div class="radar-card-meta min-w-0">
            <p class="radar-card-nome">${esc(p.nome)}</p>
            <p class="radar-card-loja">${esc(p.loja || "Shopee")}</p>
          </div>
        </div>
        <div class="radar-card-metrics">
          <div class="radar-card-cell">
            <span class="lab">Preço</span>
            <span class="val">${brl(p.preco)}</span>
          </div>
          <div class="radar-card-cell">
            <span class="lab">Comissão</span>
            <span class="val radar-card-com">${pct(p.comissaoTotal)}</span>
          </div>
        </div>
        <details class="radar-card-more">
          <summary>Ver detalhes</summary>
          <div class="radar-card-metrics">
            <div class="radar-card-cell">
              <span class="lab">Shopee</span>
              <span class="val">${pct(p.comissaoShopee)}</span>
            </div>
            <div class="radar-card-cell">
              <span class="lab">Bônus</span>
              <span class="val">${pct(p.comissaoVendedor)}</span>
            </div>
          </div>
          <div class="radar-card-foot">
            <span>${fmtNum(p.vendas)} vendas</span>
            <span class="radar-star">★ ${(Number(p.rating) || 0).toFixed(1)}</span>
          </div>
          ${actionsHtml(p)}
        </details>
      </article>`).join("");
  }

  async function minerar(e) {
    if (e) e.preventDefault();
    if (state.busy) return;
    const kw = ($("#radar-keyword")?.value || "").trim();
    const min = Number($("#radar-min")?.value || 15);
    const status = $("#radar-status");
    const pill = $("#radar-media-pill");
    const btn = $("#btn-radar-minerar");
    state.busy = true;
    state.listExpanded = false;
    state.visible = PREVIEW;
    if (btn) btn.disabled = true;
    paintEmpty("Varrendo a Shopee…");
    if (status) status.innerHTML = `<span class="radar-scan-dot"></span> Varrendo agora…`;
    try {
      const q = new URLSearchParams({ min: String(min), limit: "50" });
      if (kw) q.set("keyword", kw);
      const r = await api(`/api/radar-supercomissoes?${q}`);
      state.produtos = r.produtos || [];
      state.min = min;
      if ($("#radar-filter")) $("#radar-filter").value = "";
      paintTable();
      if (status) {
        status.innerHTML = `<span class="radar-scan-dot"></span> Varredura agora mesmo`;
      }
      if (pill) pill.textContent = state.produtos.length ? `Média da lista: ${pct(r.media)}` : "Média da lista: —";
    } catch (err) {
      paintEmpty(esc(err.message || String(err)), true);
      if (status) status.innerHTML = `<span class="radar-scan-dot"></span> Falha na varredura`;
    } finally {
      state.busy = false;
      if (btn) btn.disabled = false;
    }
  }

  async function salvarBackup(itemId) {
    const p = state.produtos.find((x) => String(x.itemId) === String(itemId));
    if (!p) return;
    try {
      await api("/api/backup", {
        method: "POST",
        body: JSON.stringify({
          produto: {
            itemId: p.itemId,
            shopId: p.shopId,
            nome: p.nome,
            preco: p.preco || 0,
            comissao_pct: p.comissaoTotal || 0,
            vendas_shopee: p.vendas || 0,
            imagem: p.imagem || "",
            rating: p.rating || 0,
            loja: p.loja || "",
            linkProduto: p.linkProduto || "",
            linkAfiliado: p.linkAfiliado || "",
          },
        }),
      });
      alert("Salvo no Backup.");
    } catch (err) {
      alert(err.message || String(err));
    }
  }

  async function gerarLink(itemId, anchor) {
    const p = state.produtos.find((x) => String(x.itemId) === String(itemId));
    if (!p) return;
    const origin = p.linkProduto || (p.shopId && p.itemId
      ? `https://shopee.com.br/product/${p.shopId}/${p.itemId}`
      : p.link);
    if (!origin) return;
    try {
      const r = await api("/api/backup/shortlink", {
        method: "POST",
        body: JSON.stringify({ originUrl: origin }),
      });
      const href = r.shortLink || r.longLink || origin;
      if (anchor) {
        anchor.href = href;
        window.open(href, "_blank", "noopener");
      }
    } catch (_) {
      window.open(origin, "_blank", "noopener");
    }
  }

  function onRadarClick(e) {
    const bak = e.target.closest("[data-radar-backup]");
    if (bak) {
      e.preventDefault();
      salvarBackup(bak.dataset.radarBackup);
      return;
    }
    const link = e.target.closest("[data-radar-link]");
    if (link && !link.dataset.done) {
      e.preventDefault();
      gerarLink(link.dataset.radarLink, link);
    }
  }

  function wire() {
    if (state.wired) return;
    state.wired = true;
    $("#radar-form")?.addEventListener("submit", minerar);
    $("#radar-filter")?.addEventListener("input", () => {
      state.listExpanded = false;
      state.visible = PREVIEW;
      paintTable();
    });
    $("#radar-tbody")?.addEventListener("click", onRadarClick);
    $("#radar-card-list")?.addEventListener("click", onRadarClick);
    window.matchMedia(MQ).addEventListener?.("change", () => {
      if (state.produtos.length) paintTable();
      else setListMode();
    });
  }

  async function mount() {
    wire();
    setListMode();
    if (state.produtos.length) paintTable();
  }

  global.RadarUI = { mount, minerar };
})(window);
