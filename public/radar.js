/* Radar de Supercomissões — varredura Shopee productOfferV2 */
(function (global) {
  "use strict";

  function $(sel, root) { return (root || document).querySelector(sel); }

  const state = { wired: false, busy: false, produtos: [], min: 20 };

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

  function paintTable() {
    const min = state.min || Number($("#radar-min")?.value || 15);
    const list = visibleProdutos();
    const q = ($("#radar-filter")?.value || "").trim();
    const tb = $("#radar-tbody");
    const pill = $("#radar-count-pill");
    if (pill) pill.textContent = String(list.length);
    if (!tb) return;
    if (!state.produtos.length) {
      tb.innerHTML = `<tr><td colspan="7" class="radar-empty">Clique em Minerar para varrer a Shopee.</td></tr>`;
      return;
    }
    if (!list.length) {
      tb.innerHTML = `<tr><td colspan="7" class="radar-empty">${q ? `Nenhum produto para “${esc(q)}”.` : `Nada acima de ${esc(String(min))}%.`}</td></tr>`;
      return;
    }
    renderRows(list, min);
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
      return `<img src="${esc(p.imagem)}" alt="" width="48" height="48" class="radar-thumb" />`;
    }
    return `<div class="radar-thumb radar-thumb--empty">🛒</div>`;
  }

  function renderRows(produtos, min) {
    const tb = $("#radar-tbody");
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
        <td class="radar-actions-cell">
          <div class="radar-actions">
            <button type="button" class="radar-btn-backup" data-radar-backup="${esc(p.itemId)}">+ Backup</button>
            <a class="radar-btn-link" href="${esc(p.link || p.linkProduto || "#")}" target="_blank" rel="noopener" data-radar-link="${esc(p.itemId)}">Gerar Link</a>
          </div>
        </td>
      </tr>`).join("");
  }

  async function minerar(e) {
    if (e) e.preventDefault();
    if (state.busy) return;
    const kw = ($("#radar-keyword")?.value || "").trim();
    const min = Number($("#radar-min")?.value || 15);
    const tb = $("#radar-tbody");
    const status = $("#radar-status");
    const pill = $("#radar-media-pill");
    const btn = $("#btn-radar-minerar");
    state.busy = true;
    if (btn) btn.disabled = true;
    if (tb) tb.innerHTML = `<tr><td colspan="7" class="radar-empty">Varrendo a Shopee…</td></tr>`;
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
      if (tb) tb.innerHTML = `<tr><td colspan="7" class="radar-empty radar-empty--err">${esc(err.message || String(err))}</td></tr>`;
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

  function wire() {
    if (state.wired) return;
    state.wired = true;
    $("#radar-form")?.addEventListener("submit", minerar);
    $("#radar-filter")?.addEventListener("input", () => paintTable());
    $("#radar-tbody")?.addEventListener("click", (e) => {
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
    });
  }

  async function mount() {
    wire();
    if (!state.produtos.length) {
      const status = $("#radar-status");
      if (status && status.textContent.includes("Sem varredura")) {
        /* keep empty until the user mines */
      }
    }
  }

  global.RadarUI = { mount, minerar };
})(window);
