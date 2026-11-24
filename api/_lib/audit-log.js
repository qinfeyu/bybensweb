// Shared admin audit-log write + prune helpers (server-side, best-effort).
// Used by api/admin-mutate.js and api/admin-login.js so every admin action gets
// captured in one place without any per-call client coordination.
//
// Design goals:
//  - Logs live in a single Supabase table `audit_logs`.
//  - Retention: lazy prune + row cap (no cron/infra), driven by writes only.
//    Read paths never delete rows; at most one full prune per hour per warm
//    instance, so retention is deterministic rather than probabilistic.
//  - A failed audit write/prune never fails the operator's real action, but it
//    is always logged: a broken audit trail must not fail silently.

const RETENTION_DAYS = 30;
const MAX_ROWS = 2000;
const PRUNE_INTERVAL_MS = 60 * 60 * 1000;
let lastPruneAt = 0;

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

const HEADERS = {
  "Content-Type": "application/json",
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  Prefer: "return=representation",
};

function reportFailure(e) {
  console.error("[audit-log]", e && e.message ? e.message : e);
}

/** Enforce the retention window, then hard row cap, on the audit_logs table. */
async function pruneAuditLogs() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    reportFailure(new Error("audit_logs destination is not configured"));
    return;
  }
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 3600 * 1000).toISOString();
  try {
    // 1) Remove rows older than the retention window.
    const oldRes = await fetch(
      `${SUPABASE_URL}/rest/v1/audit_logs?created_at=lt.${encodeURIComponent(cutoff)}`,
      { method: "DELETE", headers: HEADERS }
    );
    if (!oldRes.ok) throw new Error(`retention delete failed: HTTP ${oldRes.status}`);

    // 2) Hard cap: keep only the newest MAX_ROWS (bigint id = recency).
    const listRes = await fetch(
      `${SUPABASE_URL}/rest/v1/audit_logs?order=id.desc&limit=${MAX_ROWS}&select=id`,
      { method: "GET", headers: HEADERS }
    );
    if (!listRes.ok) throw new Error(`row-cap read failed: HTTP ${listRes.status}`);
    const rows = await listRes.json();
    if (!Array.isArray(rows) || rows.length === 0) return;
    const keepId = rows[rows.length - 1].id; // smallest id of what we keep

    const capRes = await fetch(
      `${SUPABASE_URL}/rest/v1/audit_logs?id=lt.${keepId}`,
      { method: "DELETE", headers: HEADERS }
    );
    if (!capRes.ok) throw new Error(`row-cap delete failed: HTTP ${capRes.status}`);
  } catch (e) {
    reportFailure(e);
  }
}

/** Deterministic opportunistic prune: at most once per interval per instance. */
async function maybePrune() {
  const now = Date.now();
  if (now - lastPruneAt < PRUNE_INTERVAL_MS) return false;
  lastPruneAt = now;
  await pruneAuditLogs();
  return true;
}

/**
 * Append one admin action to the audit log. Resolves true only when Supabase
 * accepted the row; never throws into the caller's real operation.
 * Callers MUST await the returned promise on serverless runtimes.
 * @param {object} opts
 * @param {string} opts.action    e.g. "order.delete", "product.upsert", "auth.login"
 * @param {string} [opts.actor]   admin email resolved from auth (may be empty)
 * @param {string} [opts.table]   supabase table the op targeted
 * @param {string} [opts.targetId] primary-key value of the affected row(s)
 * @param {string} [opts.detail]  compact one-line human description
 */
async function writeAuditLog({ action, actor, table, targetId, detail }) {
  if (!action) return false;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    reportFailure(new Error("audit_logs destination is not configured"));
    return false;
  }
  const payload = {
    action,
    actor_email: actor || null,
    target_table: table || null,
    target_id: targetId ? String(targetId) : null,
    detail: detail || "",
  };
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/audit_logs`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify([payload]),
    });
    if (!response.ok) throw new Error(`audit write failed: HTTP ${response.status}`);
    await maybePrune();
    return true;
  } catch (e) {
    reportFailure(e);
    return false;
  }
}

module.exports = { writeAuditLog, maybePrune, pruneAuditLogs, RETENTION_DAYS, MAX_ROWS };
