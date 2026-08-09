"use strict";

const { AsyncLocalStorage } = require("async_hooks");
const { createClient } = require("@supabase/supabase-js");

const als = new AsyncLocalStorage();

function getSupabaseAdmin() {
  const url = (process.env.SUPABASE_URL || "").trim().replace(/\/rest\/v1\/?$/, "");
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) throw new Error("Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getSupabaseAnon() {
  const url = (process.env.SUPABASE_URL || "").trim().replace(/\/rest\/v1\/?$/, "");
  const key = (process.env.SUPABASE_ANON_KEY || "").trim();
  if (!url || !key) throw new Error("Configure SUPABASE_ANON_KEY");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function runWithUser(user, fn) {
  return als.run({ user }, fn);
}

function getUser() {
  return als.getStore()?.user || null;
}

function requireUserId() {
  const u = getUser();
  if (!u?.id) {
    const err = new Error("Não autenticado");
    err.code = "UNAUTHORIZED";
    throw err;
  }
  return u.id;
}

async function verifyAccessToken(accessToken) {
  if (!accessToken) return null;
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.getUser(accessToken);
  if (error || !data?.user) return null;
  return {
    id: data.user.id,
    email: data.user.email || "",
  };
}

async function registerUser(email, password) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.admin.createUser({
    email: String(email || "").trim().toLowerCase(),
    password: String(password || ""),
    email_confirm: true,
  });
  if (error) throw new Error(error.message);
  // também gera sessão via signIn
  const anon = getSupabaseAnon();
  const login = await anon.auth.signInWithPassword({
    email: String(email || "").trim().toLowerCase(),
    password: String(password || ""),
  });
  if (login.error) throw new Error(login.error.message);
  return {
    user: { id: data.user.id, email: data.user.email },
    session: login.data.session,
  };
}

async function loginUser(email, password) {
  const anon = getSupabaseAnon();
  const { data, error } = await anon.auth.signInWithPassword({
    email: String(email || "").trim().toLowerCase(),
    password: String(password || ""),
  });
  if (error) throw new Error(error.message);
  return {
    user: { id: data.user.id, email: data.user.email },
    session: data.session,
  };
}

module.exports = {
  getSupabaseAdmin,
  getSupabaseAnon,
  runWithUser,
  getUser,
  requireUserId,
  verifyAccessToken,
  registerUser,
  loginUser,
};
