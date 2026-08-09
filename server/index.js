"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const {
  credentialsPublic,
  saveCredentials,
  loadCredentials,
  loadDashboardFromDb,
} = require("./store");
const { testCredentials, clearCredsCache } = require("./shopee");
const { buildDashboard } = require("./metrics");

const PORT = Number(process.env.PORT || 3790);
const PUBLIC_DIR = path.join(__dirname, "..", "public");

function loadEnvFile() {
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
loadEnvFile();

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function sendText(res, status, text, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type });
  res.end(text);
}

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

function serveStatic(req, res, pathname) {
  let rel = pathname === "/" ? "/index.html" : pathname;
  rel = decodeURIComponent(rel).replace(/\.\./g, "");
  const filePath = path.join(PUBLIC_DIR, rel);
  if (!filePath.startsWith(PUBLIC_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    sendText(res, 404, "Not found");
    return;
  }
  res.writeHead(200, { "Content-Type": contentType(filePath) });
  fs.createReadStream(filePath).pipe(res);
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function defaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 6);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { startDate: fmt(start), endDate: fmt(end) };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const { pathname } = url;

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      res.end();
      return;
    }

    if (pathname === "/api/health") {
      const cred = await credentialsPublic();
      sendJson(res, 200, {
        ok: true,
        shopeeConfigured: cred.configured,
        supabase: Boolean(process.env.SUPABASE_URL),
        metaEnabled: false,
        pinterestEnabled: false,
      });
      return;
    }

    if (pathname === "/api/credentials" && req.method === "GET") {
      sendJson(res, 200, await credentialsPublic());
      return;
    }

    if (pathname === "/api/credentials" && req.method === "POST") {
      const body = await readBody(req);
      try {
        const saved = await saveCredentials({ appId: body.appId, secret: body.secret });
        clearCredsCache();
        sendJson(res, 200, {
          success: true,
          ...saved,
          message: saved.reset
            ? "API trocada — dados anteriores foram resetados. Sincronize de novo."
            : "Credenciais salvas no Supabase.",
        });
      } catch (err) {
        sendJson(res, 400, { success: false, error: err.message });
      }
      return;
    }

    if (pathname === "/api/credentials/test" && req.method === "POST") {
      try {
        const { appId, secret } = await loadCredentials();
        if (!appId || !secret) {
          sendJson(res, 400, { success: false, error: "Credenciais não configuradas" });
          return;
        }
        const result = await testCredentials();
        sendJson(res, 200, { success: true, ...result });
      } catch (err) {
        sendJson(res, 400, { success: false, error: err.message || String(err) });
      }
      return;
    }

    if (pathname === "/api/dashboard" && req.method === "GET") {
      const startDate = url.searchParams.get("start") || defaultRange().startDate;
      const endDate = url.searchParams.get("end") || defaultRange().endDate;
      const force = url.searchParams.get("force") === "1";

      const cred = await credentialsPublic();
      if (!cred.configured) {
        sendJson(res, 400, {
          success: false,
          error: "Configure a API Shopee em Configuração antes de sincronizar.",
          code: "CREDS_MISSING",
        });
        return;
      }

      try {
        if (!force) {
          const fromDb = await loadDashboardFromDb(startDate, endDate);
          if (fromDb) {
            sendJson(res, 200, { success: true, cached: true, ...fromDb });
            return;
          }
        }
        const dash = await buildDashboard({ startDate, endDate, persist: true });
        sendJson(res, 200, { success: true, cached: false, ...dash });
      } catch (err) {
        sendJson(res, 500, { success: false, error: err.message || String(err) });
      }
      return;
    }

    if (pathname.startsWith("/api/")) {
      sendJson(res, 404, { error: "not_found" });
      return;
    }

    serveStatic(req, res, pathname);
  } catch (err) {
    sendJson(res, 500, { error: err.message || String(err) });
  }
});

server.listen(PORT, async () => {
  let cred;
  try {
    cred = await credentialsPublic();
  } catch {
    cred = { configured: false };
  }
  console.log(`\n  Metricly SaaS → http://localhost:${PORT}`);
  console.log(`  Supabase: ${(process.env.SUPABASE_URL || "").replace(/https?:\/\//, "").slice(0, 40) || "NÃO"}`);
  console.log(`  Shopee API: ${cred.configured ? "configurada" : "PENDENTE"}`);
  console.log(`  Meta/Pinterest: off\n`);
});
