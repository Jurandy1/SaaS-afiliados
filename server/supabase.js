"use strict";

const { createClient } = require("@supabase/supabase-js");

let _client = null;

function getSupabase() {
  if (_client) return _client;
  const url = (process.env.SUPABASE_URL || "").trim().replace(/\/rest\/v1\/?$/, "");
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "").trim();
  if (!url || !key) {
    throw new Error("Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env");
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

module.exports = { getSupabase };
