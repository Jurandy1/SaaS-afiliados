"use strict";

const { getSupabaseAdmin, getUser, requireUserId } = require("./auth");

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "teste@gmail.com").trim().toLowerCase();

function isAdminEmail(email) {
  return String(email || "").trim().toLowerCase() === ADMIN_EMAIL;
}

async function getProfile(userId) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("user_profiles").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
}

async function upsertProfile(row) {
  const sb = getSupabaseAdmin();
  const payload = {
    ...row,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await sb.from("user_profiles").upsert(payload).select("*").maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Garante perfil; admin email sempre admin+approved. */
async function ensureProfile({ id, email }) {
  const existing = await getProfile(id);
  if (existing) {
    if (isAdminEmail(email) && (existing.role !== "admin" || existing.status !== "approved")) {
      return upsertProfile({
        ...existing,
        user_id: id,
        email: String(email || "").toLowerCase(),
        role: "admin",
        status: "approved",
        display_name: existing.display_name || "Administrador",
        approved_at: existing.approved_at || new Date().toISOString(),
      });
    }
    if (email && existing.email !== email) {
      return upsertProfile({ ...existing, user_id: id, email: String(email).toLowerCase() });
    }
    return existing;
  }

  const admin = isAdminEmail(email);
  return upsertProfile({
    user_id: id,
    email: String(email || "").toLowerCase(),
    role: admin ? "admin" : "user",
    // Contas já existentes no Auth (sem perfil) entram aprovadas; novos registros usam createPendingProfile
    status: "approved",
    display_name: admin ? "Administrador" : "",
    company: "",
    notes: "",
    approved_at: new Date().toISOString(),
  });
}

async function touchLogin(userId) {
  const sb = getSupabaseAdmin();
  await sb.from("user_profiles").update({
    last_login_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);
}

async function createPendingProfile({ id, email, displayName, company }) {
  if (isAdminEmail(email)) {
    return ensureProfile({ id, email });
  }
  return upsertProfile({
    user_id: id,
    email: String(email || "").toLowerCase(),
    role: "user",
    status: "pending",
    display_name: String(displayName || "").slice(0, 120),
    company: String(company || "").slice(0, 120),
    notes: "",
  });
}

function profilePublic(p) {
  if (!p) return null;
  return {
    userId: p.user_id,
    email: p.email,
    role: p.role,
    status: p.status,
    displayName: p.display_name || "",
    company: p.company || "",
    notes: p.notes || "",
    approvedAt: p.approved_at,
    lastLoginAt: p.last_login_at,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

async function requireApprovedUser() {
  const u = getUser();
  if (!u?.id) {
    const err = new Error("Não autenticado");
    err.code = "UNAUTHORIZED";
    throw err;
  }
  const profile = u.profile || await ensureProfile(u);
  if (profile.role === "admin" || profile.status === "approved") return profile;
  const err = new Error(
    profile.status === "pending"
      ? "Sua conta aguarda aprovação do administrador."
      : profile.status === "rejected"
        ? "Sua conta foi recusada."
        : "Sua conta está suspensa.",
  );
  err.code = profile.status === "pending" ? "PENDING_APPROVAL" : "ACCOUNT_BLOCKED";
  err.profile = profilePublic(profile);
  throw err;
}

async function requireAdmin() {
  const profile = await requireApprovedUser();
  if (profile.role !== "admin" && !isAdminEmail(profile.email)) {
    const err = new Error("Acesso restrito à área administrativa");
    err.code = "FORBIDDEN";
    throw err;
  }
  return profile;
}

async function listProfiles({ status, q, limit = 200 } = {}) {
  const sb = getSupabaseAdmin();
  let query = sb.from("user_profiles").select("*").order("created_at", { ascending: false }).limit(limit);
  if (status && status !== "all") query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  let rows = data || [];
  const needle = String(q || "").trim().toLowerCase();
  if (needle) {
    rows = rows.filter((r) =>
      [r.email, r.display_name, r.company, r.status, r.role, r.notes]
        .some((v) => String(v || "").toLowerCase().includes(needle)));
  }
  return rows.map(profilePublic);
}

async function getUserDetail(userId) {
  const profile = await getProfile(userId);
  if (!profile) return null;
  const sb = getSupabaseAdmin();
  const [{ data: cred }, { data: meta }, { data: settings }, { data: lastRun }, { count: ordersCount }] = await Promise.all([
    sb.from("app_credentials").select("app_id, updated_at").eq("user_id", userId).maybeSingle(),
    sb.from("meta_credentials").select("ad_account_ids, api_version, updated_at").eq("user_id", userId).maybeSingle(),
    sb.from("app_settings").select("*").eq("user_id", userId).maybeSingle(),
    sb.from("sync_runs").select("synced_at, nodes, pages").eq("user_id", userId).order("synced_at", { ascending: false }).limit(1).maybeSingle(),
    sb.from("orders").select("*", { count: "exact", head: true }).eq("user_id", userId),
  ]);

  return {
    profile: profilePublic(profile),
    shopee: {
      configured: Boolean(cred?.app_id),
      appId: cred?.app_id || null,
      updatedAt: cred?.updated_at || null,
    },
    meta: {
      configured: Boolean(meta?.ad_account_ids),
      accounts: String(meta?.ad_account_ids || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      apiVersion: meta?.api_version || null,
      updatedAt: meta?.updated_at || null,
    },
    settings: settings
      ? {
          teamName: settings.team_name,
          teamPlan: settings.team_plan,
          metaBase: Number(settings.meta_base || 0),
          taxRate: Number(settings.tax_rate || 0),
        }
      : null,
    activity: {
      lastSyncAt: lastRun?.synced_at || null,
      lastSyncNodes: lastRun?.nodes || 0,
      ordersCount: ordersCount || 0,
    },
  };
}

async function setProfileStatus(userId, status, { notes, adminId } = {}) {
  const allowed = new Set(["pending", "approved", "rejected", "suspended"]);
  if (!allowed.has(status)) throw new Error("Status inválido");
  const existing = await getProfile(userId);
  if (!existing) throw new Error("Usuário não encontrado");
  if (existing.role === "admin" && status !== "approved") {
    throw new Error("Não é possível bloquear o administrador principal");
  }
  return upsertProfile({
    ...existing,
    user_id: userId,
    status,
    notes: notes != null ? String(notes).slice(0, 500) : existing.notes,
    approved_by: status === "approved" ? adminId || null : existing.approved_by,
    approved_at: status === "approved" ? new Date().toISOString() : existing.approved_at,
  });
}

async function deleteUserAccount(userId, actorId) {
  if (!userId) throw new Error("userId obrigatório");
  if (actorId && userId === actorId) throw new Error("Você não pode excluir a própria conta admin");
  const existing = await getProfile(userId);
  if (existing?.role === "admin" || isAdminEmail(existing?.email)) {
    throw new Error("Não é possível excluir o administrador principal");
  }

  const sb = getSupabaseAdmin();
  const tables = [
    "order_items", "orders", "products", "product_backups", "daily_metrics", "subid_metrics",
    "sync_runs", "meta_ads_daily", "pinterest_ads_daily", "app_credentials",
    "meta_credentials", "app_settings", "user_profiles",
  ];
  for (const table of tables) {
    try {
      await sb.from(table).delete().eq("user_id", userId);
    } catch (_) { /* tabela pode não existir */ }
  }

  const { error } = await sb.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
  return { deleted: true, userId };
}

async function adminStats() {
  const rows = await listProfiles({ status: "all", limit: 1000 });
  const stats = {
    total: rows.length,
    pending: 0,
    approved: 0,
    rejected: 0,
    suspended: 0,
    admins: 0,
    withShopee: 0,
  };
  for (const r of rows) {
    if (stats[r.status] != null) stats[r.status] += 1;
    if (r.role === "admin") stats.admins += 1;
  }
  return { stats, recentPending: rows.filter((r) => r.status === "pending").slice(0, 8) };
}

module.exports = {
  ADMIN_EMAIL,
  isAdminEmail,
  getProfile,
  ensureProfile,
  createPendingProfile,
  touchLogin,
  profilePublic,
  requireApprovedUser,
  requireAdmin,
  listProfiles,
  getUserDetail,
  setProfileStatus,
  deleteUserAccount,
  adminStats,
  requireUserId,
};
