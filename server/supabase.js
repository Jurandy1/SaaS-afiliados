"use strict";

// Re-export admin client; prefer getSupabaseAdmin from auth.js in new code
const { getSupabaseAdmin } = require("./auth");

function getSupabase() {
  return getSupabaseAdmin();
}

module.exports = { getSupabase };
