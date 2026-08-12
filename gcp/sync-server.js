"use strict";

/**
 * Worker HTTP do Google Cloud Run.
 * Cloud Scheduler chama GET /sync?mode=recent|daily com CRON_SECRET.
 * Aqui o GCP puxa Shopee + Meta e grava no Supabase do SaaS.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}
loadEnv();

const { runAutoSync, cronAuthorized } = require("../server/autoSync");

const PORT = Number(process.env.PORT || 8080);

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(json);
}

const server = http.createServer((req, res) => {
  Promise.resolve((async () => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = url.pathname.replace(/\/$/, "") || "/";

    if (pathname === "/health" || pathname === "/") {
      send(res, 200, { ok: true, service: "saas-afiliados-sync", gcp: true });
      return;
    }

    if ((pathname === "/sync" || pathname === "/api/cron/sync") && (req.method === "GET" || req.method === "POST")) {
      if (!cronAuthorized(req)) {
        send(res, 401, { ok: false, error: "unauthorized" });
        return;
      }
      const mode = String(url.searchParams.get("mode") || "daily").toLowerCase();
      const result = await runAutoSync({ mode: mode === "recent" ? "recent" : "daily" });
      send(res, 200, { success: true, ...result });
      return;
    }

    send(res, 404, { error: "not_found" });
  })()).catch((err) => {
    console.error("[gcp-sync]", err);
    try {
      send(res, 500, { ok: false, error: err.message || String(err) });
    } catch (_) { /* ignore */ }
  });
});

server.listen(PORT, () => {
  console.log(`[gcp-sync] Cloud Run worker na porta ${PORT}`);
});
