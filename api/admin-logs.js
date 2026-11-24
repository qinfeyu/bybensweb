// Admin audit-log viewer + cleanup endpoint.
//  GET    list the newest audit_logs (read-only; retention runs on writes)
//         ?limit=, ?action=, ?actor=, ?table=, ?days=  (server filters)
//  DELETE prune rows:  { olderThanDays?: number }  -> delete older than N days
//                      { ids?: string[] }           -> delete those ids only
//                      { all?: true }               -> wipe everything
// Mirrors the trust model of the rest of the admin api (service-role from env).
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

const { applyAdminCors, requireAdmin } = require("./_lib/admin-auth");

const HEADERS = {
  "Content-Type": "application/json",
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  Prefer: "return=representation",
};
const DEFAULT_LIMIT = 200;

// Retention is enforced by the shared audit helper on writes (deterministic
// interval), not by this read path. A GET must never delete rows.

module.exports = async function handler(req, res) {
  if (!applyAdminCors(req, res)) {
    return res.status(403).json({ error: "Origin not allowed" });
  }

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET" && req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  try {
    if (req.method === "GET") {
      let url = `${SUPABASE_URL}/rest/v1/audit_logs?order=created_at.desc`;
      const { limit, action, actor, table, days } = req.query || {};
      const lim = Math.min(Number(limit) || DEFAULT_LIMIT, 500);
      if (action && String(action).trim()) url += `&action=eq.${encodeURIComponent(String(action))}`;
      if (actor && String(actor).trim()) url += `&actor_email=eq.${encodeURIComponent(String(actor))}`;
      if (table && String(table).trim()) url += `&target_table=eq.${encodeURIComponent(String(table))}`;
      if (days) {
        const cutoff = new Date(Date.now() - Number(days) * 24 * 3600 * 1000).toISOString();
        url += `&created_at=gte.${encodeURIComponent(cutoff)}`;
      }
      url += `&limit=${lim}`;
      const response = await fetch(url, { method: "GET", headers: HEADERS });
      const data = await response.json();
      if (!response.ok) return res.status(response.status || 500).json({ error: "Admin log request failed. Please try again." });
      return res.status(200).json({ success: true, logs: data });
    }

    // DELETE
    const { olderThanDays, ids, all } = req.body || req.query || {};
    let url = `${SUPABASE_URL}/rest/v1/audit_logs`;
    if (all) {
      // wipe
    } else if (Array.isArray(ids) && ids.length) {
      const inList = ids.filter(Boolean).map((i) => encodeURIComponent(String(i))).join(",");
      url += `?id=in.(${inList})`;
    } else if (olderThanDays) {
      const cutoff = new Date(Date.now() - Number(olderThanDays) * 24 * 3600 * 1000).toISOString();
      url += `?created_at=lt.${encodeURIComponent(cutoff)}`;
    } else {
      return res.status(400).json({ error: "Nothing to prune (send ids, olderThanDays, or all)" });
    }
    const response = await fetch(url, { method: "DELETE", headers: HEADERS });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return res.status(response.status || 500).json({ error: "Admin log request failed. Please try again." });
    return res.status(200).json({ success: true, data });
  } catch (e) {
    console.error("[admin-logs]", e && e.message ? e.message : e);
    return res.status(500).json({ error: "Admin log request failed. Please try again." });
  }
};
