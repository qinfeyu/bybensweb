const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://uogwlzuiemxwsnpigydg.supabase.co";

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

const { applyAdminCors, requireAdmin } = require("./_lib/admin-auth");

const SB_HEADERS = {
  "Content-Type": "application/json",
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  Prefer: "return=representation",
};

// Only tables the panel actually writes through /api/admin-mutate.
const ALLOWED_TABLES = new Set([
  "inventory_items",
  "categories",
  "sub_categories",
  "products",
  "orders",
  "pre_orders",
  "pre_order_items",
  "expenses",
  "customers",
  "settings",
  "delivery_prices",
  "promo_codes",
  "bundle",
  "gift_config",
  "notes",
]);
const SAFE_ACTIONS = new Set(["upsert", "insert", "update", "delete"]);
const SAFE_COLUMN = /^[A-Za-z_][A-Za-z0-9_]*$/;

function buildMatchQuery(match) {
  if (match === undefined || match === null) return "";
  if (typeof match !== "object" || Array.isArray(match)) return null;
  const parts = [];
  for (const [column, raw] of Object.entries(match)) {
    if (!SAFE_COLUMN.test(column)) return null;
    if (typeof raw === "string" && raw.startsWith("like:")) {
      parts.push(`${column}=like.${encodeURIComponent(raw.slice(5))}`);
    } else if (typeof raw === "string" && raw.startsWith("in:(") && raw.endsWith(")")) {
      const values = raw.slice(4, -1).split(",").filter(Boolean).map((v) => {
        try { return encodeURIComponent(decodeURIComponent(v)); }
        catch (_) { return encodeURIComponent(v); }
      });
      parts.push(`${column}=in.(${values.join(",")})`);
    } else {
      parts.push(`${column}=eq.${encodeURIComponent(String(raw))}`);
    }
  }
  return parts.join("&");
}

let { writeAuditLog } = { };
try {
  ({ writeAuditLog } = require("./_lib/audit-log"));
} catch (_) {
  writeAuditLog = () => {};
}

module.exports = async function handler(req, res) {
  if (!applyAdminCors(req, res)) {
    return res.status(403).json({ error: "Origin not allowed" });
  }

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  try {
    const { action, table, data, match } = req.body || {};
    if (!table || !action) {
      return res.status(400).json({ error: "Table and action are required" });
    }
    if (typeof table !== "string" || !ALLOWED_TABLES.has(table)) {
      return res.status(400).json({ error: "Invalid table" });
    }
    if (!SAFE_ACTIONS.has(action)) {
      return res.status(400).json({ error: "Invalid action" });
    }
    if ((action === "update" || action === "delete") &&
        (!match || typeof match !== "object" || Array.isArray(match) || Object.keys(match).length === 0)) {
      return res.status(400).json({ error: "A non-empty match is required for update/delete" });
    }
    const matchQuery = buildMatchQuery(match);
    if (matchQuery === null) {
      return res.status(400).json({ error: "Invalid match filter" });
    }

    let url = `${SUPABASE_URL}/rest/v1/${encodeURIComponent(table)}`;
    let method = "POST";
    const headers = { ...SB_HEADERS };

    if (action === "upsert") {
      method = "POST";
      headers["Prefer"] = "resolution=merge-duplicates,return=representation";
    } else if (action === "insert") {
      method = "POST";
    } else if (action === "update") {
      method = "PATCH";
      if (matchQuery) url += `?${matchQuery}`;
    } else if (action === "delete") {
      method = "DELETE";
      if (matchQuery) url += `?${matchQuery}`;
    }

    const opts = { method, headers };
    if (data && (action === "upsert" || action === "insert" || action === "update")) {
      opts.body = JSON.stringify(data);
    }

    const response = await fetch(url, opts);
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error(`Admin mutate error on ${table} [${action}]: HTTP ${response.status}`);
      return res.status(response.status || 500).json({ error: "Admin write failed. Please try again." });
    }

    // Build a useful audit detail string that includes the row identifier and
    // key changed fields so log entries are forensically meaningful.
    let auditDetail = `${table} ${action}`;
    try {
      const payload = data || match || {};
      const rowId =
        payload.id ||
        (match && (match.id || Object.values(match)[0])) ||
        undefined;
      if (rowId) auditDetail += ` id=${rowId}`;
      // For inventory/product upserts include the most useful numeric fields
      const snapFields = ['stock', 'stock_eu', 'price_eur', 'name', 'action', 'best_before'];
      snapFields.forEach(f => {
        if (payload[f] !== undefined && payload[f] !== null) {
          auditDetail += ` ${f}=${JSON.stringify(payload[f])}`;
        }
      });
    } catch (_) {}
    const actor = admin.email || (admin.user_metadata && admin.user_metadata.email) || "unknown";
    await writeAuditLog({ action, actor, table, detail: auditDetail });
    return res.status(200).json({ success: true, data: result });
  } catch (e) {
    console.error("[admin-mutate]", e && e.message ? e.message : e);
    return res.status(500).json({ error: "Admin write failed. Please try again." });
  }
};
