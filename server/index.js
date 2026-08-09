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
  loadOrders,
  loadProducts,
  loadSettings,
  saveSettings,
} = require("./store");
const { testCredentials, clearCredsCache } = require("./shopee");
const { buildDashboard } = require("./metrics");
const { enrichDashboardWithAds } = require("./finance");
const {
  metaCredentialsPublic,
  saveMetaCredentials,
  testMetaCredentials,
  syncMetaDaily,
  loadCampaigns,
} = require("./meta");
const { importPinterestCsv } = require("./pinterest");
const {
  runWithUser,
  verifyAccessToken,
  registerUser,
  loginUser,
  getUser,
} = require("./auth");

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
  const ct = String(req.headers["content-type"] || "");
  if (ct.includes("multipart/form-data")) return { _raw: raw, _ct: ct };
  try {
    return JSON.parse(raw);
  } catch {
    return { _text: raw };
  }
}

function extractMultipartFile(raw, contentType) {
  const m = String(contentType || "").match(/boundary=(.+)$/i);
  if (!m) return null;
  const boundary = m[1].trim();
  const parts = raw.split(`--${boundary}`);
  for (const part of parts) {
    if (!part.includes("Content-Disposition") || part.includes('filename=""')) continue;
    if (!/filename="/i.test(part)) continue;
    const idx = part.indexOf("\r\n\r\n");
    if (idx < 0) continue;
    let body = part.slice(idx + 4);
    if (body.endsWith("\r\n")) body = body.slice(0, -2);
    if (body.endsWith("--")) body = body.slice(0, -2);
    return body;
  }
  return null;
}

function defaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 6);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { startDate: fmt(start), endDate: fmt(end) };
}

function bearer(req) {
  const h = String(req.headers.authorization || "");
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

const PUBLIC_API = new Set([
  "/api/health",
  "/api/auth/login",
  "/api/auth/register",
]);

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const { pathname } = url;

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      });
      res.end();
      return;
    }

    if (pathname === "/api/health") {
      sendJson(res, 200, {
        ok: true,
        multiUser: true,
        supabase: Boolean(process.env.SUPABASE_URL),
      });
      return;
    }

    if (pathname === "/api/auth/register" && req.method === "POST") {
      const body = await readBody(req);
      try {
        if (!body.email || !body.password || String(body.password).length < 6) {
          sendJson(res, 400, { success: false, error: "Email e senha (mín. 6) obrigatórios" });
          return;
        }
        const result = await registerUser(body.email, body.password);
        sendJson(res, 200, {
          success: true,
          user: result.user,
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token,
          expires_at: result.session.expires_at,
        });
      } catch (err) {
        sendJson(res, 400, { success: false, error: err.message });
      }
      return;
    }

    if (pathname === "/api/auth/login" && req.method === "POST") {
      const body = await readBody(req);
      try {
        const result = await loginUser(body.email, body.password);
        sendJson(res, 200, {
          success: true,
          user: result.user,
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token,
          expires_at: result.session.expires_at,
        });
      } catch (err) {
        sendJson(res, 401, { success: false, error: err.message });
      }
      return;
    }

    if (pathname.startsWith("/api/") && !PUBLIC_API.has(pathname)) {
      const token = bearer(req);
      const user = await verifyAccessToken(token);
      if (!user) {
        sendJson(res, 401, { success: false, error: "Faça login para continuar", code: "UNAUTHORIZED" });
        return;
      }

      await runWithUser(user, async () => {
        if (pathname === "/api/auth/me" && req.method === "GET") {
          sendJson(res, 200, { success: true, user: getUser() });
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
            clearCredsCache(user.id);
            sendJson(res, 200, {
              success: true,
              ...saved,
              message: saved.reset
                ? "Sua API Shopee trocou — só os seus dados foram resetados. Sincronize de novo."
                : "Credenciais Shopee salvas na sua conta.",
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

        if (pathname === "/api/meta/credentials" && req.method === "GET") {
          sendJson(res, 200, { success: true, ...(await metaCredentialsPublic()) });
          return;
        }

        if (pathname === "/api/meta/credentials" && req.method === "POST") {
          const body = await readBody(req);
          try {
            const saved = await saveMetaCredentials({
              accessToken: body.accessToken,
              adAccountIds: body.adAccountIds,
              apiVersion: body.apiVersion,
            });
            sendJson(res, 200, { success: true, ...saved, message: "Credenciais Meta salvas na sua conta." });
          } catch (err) {
            sendJson(res, 400, { success: false, error: err.message });
          }
          return;
        }

        if (pathname === "/api/meta/test" && req.method === "POST") {
          try {
            const result = await testMetaCredentials();
            sendJson(res, 200, { success: true, ...result });
          } catch (err) {
            sendJson(res, 400, { success: false, error: err.message || String(err) });
          }
          return;
        }

        if (pathname === "/api/meta/sync" && req.method === "POST") {
          const body = await readBody(req);
          try {
            const daysBack = Number(body.daysBack || url.searchParams.get("days") || 7);
            const result = await syncMetaDaily({ daysBack });
            sendJson(res, 200, { success: true, ...result });
          } catch (err) {
            sendJson(res, 500, { success: false, error: err.message || String(err) });
          }
          return;
        }

        if (pathname === "/api/pinterest/import" && req.method === "POST") {
          const body = await readBody(req);
          try {
            let text = body.csv || body._text || "";
            if (body._raw && body._ct) text = extractMultipartFile(body._raw, body._ct) || text;
            if (!text.trim()) {
              sendJson(res, 400, { success: false, error: "Envie o CSV" });
              return;
            }
            const result = await importPinterestCsv(text);
            sendJson(res, 200, { success: true, ...result });
          } catch (err) {
            sendJson(res, 400, { success: false, error: err.message || String(err) });
          }
          return;
        }

        if (pathname === "/api/settings" && req.method === "GET") {
          sendJson(res, 200, { success: true, ...(await loadSettings()) });
          return;
        }

        if (pathname === "/api/settings" && req.method === "POST") {
          const body = await readBody(req);
          try {
            const s = await saveSettings(body);
            sendJson(res, 200, { success: true, ...s });
          } catch (err) {
            sendJson(res, 400, { success: false, error: err.message });
          }
          return;
        }

        if (pathname === "/api/orders" && req.method === "GET") {
          try {
            const startDate = url.searchParams.get("start") || defaultRange().startDate;
            const endDate = url.searchParams.get("end") || defaultRange().endDate;
            const orders = await loadOrders({ startDate, endDate, limit: 500 });
            sendJson(res, 200, { success: true, orders });
          } catch (err) {
            sendJson(res, 500, { success: false, error: err.message });
          }
          return;
        }

        if (pathname === "/api/products" && req.method === "GET") {
          try {
            const products = await loadProducts({ limit: 500 });
            sendJson(res, 200, { success: true, products });
          } catch (err) {
            sendJson(res, 500, { success: false, error: err.message });
          }
          return;
        }

        if (pathname === "/api/campaigns" && req.method === "GET") {
          try {
            const startDate = url.searchParams.get("start") || defaultRange().startDate;
            const endDate = url.searchParams.get("end") || defaultRange().endDate;
            const campaigns = await loadCampaigns(startDate, endDate);
            sendJson(res, 200, { success: true, campaigns });
          } catch (err) {
            sendJson(res, 500, { success: false, error: err.message });
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
              error: "Configure a sua API Shopee em Configuração.",
              code: "CREDS_MISSING",
            });
            return;
          }
          try {
            if (!force) {
              let fromDb = await loadDashboardFromDb(startDate, endDate);
              if (fromDb) {
                fromDb = await enrichDashboardWithAds(fromDb);
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

        sendJson(res, 404, { error: "not_found" });
      });
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

server.listen(PORT, () => {
  console.log(`\n  Metricly SaaS (multi-user) → http://localhost:${PORT}`);
  console.log(`  Auth: login/registro por conta`);
  console.log(`  Cada usuário: Shopee + Meta + dados isolados\n`);
});
