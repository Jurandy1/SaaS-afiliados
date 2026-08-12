/**
 * Google Apps Script — dispara o sync diário do SaaS Afiliados.
 *
 * O Google NÃO puxa Shopee/Meta sozinho. Este script só acorda o SaaS
 * (igual o agendador do Afiliadoteste no Firebase).
 *
 * Setup (2 min):
 * 1. https://script.google.com → Novo projeto
 * 2. Cole este arquivo
 * 3. Ajuste SAAS_URL e CRON_SECRET
 * 4. Relógio (Triggers) → Acionador → syncSaaSDaily
 *    - Tipo: baseado em tempo
 *    - Intervalo: dia
 *    - Horário: 04:00–05:00 (fuso do script: File → Project settings → timezone America/Sao_Paulo)
 */

const SAAS_URL = "https://SEU-APP.vercel.app"; // URL do SaaS
const CRON_SECRET = "cole-o-mesmo-CRON_SECRET-do-SaaS";

function syncSaaSDaily() {
  const url = SAAS_URL.replace(/\/$/, "") + "/api/cron/sync?mode=daily";
  const res = UrlFetchApp.fetch(url, {
    method: "get",
    muteHttpExceptions: true,
    followRedirects: true,
    headers: {
      Authorization: "Bearer " + CRON_SECRET,
    },
  });
  const code = res.getResponseCode();
  const body = res.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error("SaaS sync HTTP " + code + ": " + body.slice(0, 500));
  }
  console.log(body.slice(0, 1000));
}

/** Opcional: a cada 2h (últimos 3 dias), se quiser mais fresco. */
function syncSaaSRecent() {
  const url = SAAS_URL.replace(/\/$/, "") + "/api/cron/sync?mode=recent";
  const res = UrlFetchApp.fetch(url, {
    method: "get",
    muteHttpExceptions: true,
    headers: { Authorization: "Bearer " + CRON_SECRET },
  });
  const code = res.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error("SaaS recent HTTP " + code + ": " + res.getContentText().slice(0, 500));
  }
}
