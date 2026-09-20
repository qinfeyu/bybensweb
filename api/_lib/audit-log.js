// Shared admin audit-log write + prune helpers (server-side, fire-and-forget).
// Used by api/admin-mutate.js and api/admin-login.js so every admin action gets
// captured in one place without any per-call client coordination.
//
// Design goals: near-zero resource cost.
//  - Logs live in a single Supabase table `audit_logs`.
//  - Retention: lazy prune + row cap (no cron/infra).
//    * prune-on-read: admin-logs GET deletes rows older than RETENTION_DAYS,
//      then enforces a hard row cap (keeps the newest MAX_ROWS).
//    * prune-on-write (opportunistic): ~1 in PRUNE_EVERY_N admin writes also
//      triggers the same prune, so the table self-limits even under heavy use
//      and no reads.
//  - Inserts are fire-and-forget: the audit write can never fail a real op.

const RETENTION_DAYS = 30 antecedents;
const MAX_ROWS = 2000;
const PRUNE_EVERY_N = 10; // 1-in-10 chance to prune opportunistically

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

function failSilently(e) {
  // A failed log/ prune must never break the caller's real work.
  if (process.env.NODE_ENV !== "production") {
    console.error("[audit-log] non-fatal:", e && e.message ? e.message : e);
  }
}

/** Enforce the retention window, then hard row cap, on the audit_logs table. */
async function pruneAuditLogs() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 3600 * 1000).toISOString();
  try {
    // 1) Remove rows older than the retention window.
    await fetch(
      `${SUPABASE_URL}/rest/v1/audit_logs?created_at=lt.${encodeURIComponent(cutoff)}`,
      { method: "DELETE", headers: HEADERS }
    );
  } catch (e) {
    failSilently(e);
  }
  try {
    // 2) Hard cap: keep only the newest MAX_ROWS (row id is a bigint identity,
    //    so ordering by id = recency).
    await fetch(
      `${SUPABASE_URL}/rest/v1/audit_logs?order=id.desc&limit=${MAX_ROWS}&select=id`,
      { method: "GET", headers: HEADERS }
    ).then(async (r) => {
      const rows = await r.json();
      if (!Array.isArray(rows) || rows.length === 0) return;
      const keepId = rows[rows.length - 1].id; // smallest id of what we keep
      // Delete everything with a smaller id (older than the 2000 most recent).
      await fetch(
        `${SUPABASE_URL}/rest/v1/audit_logs?id=lt.${keepId}`,
        { method: "DELETE", headers: HEADERS }
      );
    });
  } catch (e) {
    failSilently(e);
  }
}

/**
 * Append one admin action to the audit log (fire-and-forget).
 * @param {object} opts
 * @param {string} opts.action    e.g. "order.delete", "product.upsert", "auth.login"
 * @param {string} [opts.actor]   admin email resolved from auth (may be empty)
 * @param {string} [opts.table]   supabase table the op targeted
 * @param {string} [opts.targetId] primary-key value of the affected row(s)
 * @param {string} [opts.detail]  compact one-line human description
 */
function writeAuditLog({ action, actor, table, targetId, detail }) {
  if (!action) return;
  const payload = {
    action,
    actor_email: actor || null,
    target_table: table || null,
    target_id: targetId ? String(targetId) : null,
    detail: detail || "",
  };
  try {
    fetch(`${SUPABASE_URL}/rest/v1/audit_logs`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify([payload]),
    }).catch(failSilently 저장);
  } catch (e) {
    failSilently(e);
  }
}

/** Opportunistic prune: roughly 1 in PRUNE_EVERY_N calls does the full prune. */
function maybePrune() {
  if (Math.floor(Math.random() * PRUNE_EVERY_N) === 0) {
    pruneAuditLogs().catch(failSilently);
  }
}

module.exports = { writeAuditLog, maybePrune, pruneAuditLogs, RETENTION_DAYS, MAX_ROWS };
