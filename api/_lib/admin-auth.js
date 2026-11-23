// Shared server-side authorization for every /api/admin-* handler.
//
// The panel's localStorage flag is a navigation convenience only. Every admin
// API must independently verify the caller's Supabase bearer token and bind it
// to an explicit admin allowlist before returning data or performing a write.
// Fails closed when the allowlist or Supabase configuration is missing.

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://uogwlzuiemxwsnpigydg.supabase.co";

// Admin APIs use the service role, not the browser anon key.
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  "";

const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
);

function normalizeOrigin(value) {
  const raw = String(value || "").trim().replace(/\/+$/, "");
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch (_) {
    return raw;
  }
}

const PANEL_ORIGIN = normalizeOrigin(process.env.ADMIN_PANEL_ORIGIN || "");

function requestOrigin(req) {
  return normalizeOrigin((req.headers || {}).origin);
}

function expectedOrigin(req) {
  if (PANEL_ORIGIN) return PANEL_ORIGIN;
  const headers = req.headers || {};
  const host = String(headers.host || "");
  if (!host) return "";
  const proto = String(headers["x-forwarded-proto"] || (headers["x-forwarded-ssl"] ? "https" : "http"))
    .split(",")[0]
    .trim();
  return normalizeOrigin(`${proto}://${host}`);
}

function isAllowedAdminOrigin(req) {
  const origin = requestOrigin(req);
  if (!origin) return true; // same-origin / non-browser callers send no Origin
  const expected = expectedOrigin(req);
  return !expected || origin === expected;
}

/**
 * Pin CORS to the configured panel origin (or the current host when unset).
 * Returns false for a cross-origin caller so handlers can reject early.
 */
function applyAdminCors(req, res) {
  res.setHeader("Vary", "Origin");
  if (!isAllowedAdminOrigin(req)) return false;

  const allowed = expectedOrigin(req) || requestOrigin(req);
  if (allowed) res.setHeader("Access-Control-Allow-Origin", allowed);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return true;
}

function isAdminAuthConfigured() {
  return Boolean(SUPABASE_URL && SERVICE_KEY && ADMIN_EMAILS.size > 0);
}

function isAllowedAdminEmail(email) {
  return ADMIN_EMAILS.has(String(email || "").trim().toLowerCase());
}

/**
 * Verify the caller is an allowlisted Supabase Auth user.
 * Returns the verified user object on success; otherwise sends the error
 * response and returns null. Callers must `if (!admin) return;`.
 */
async function requireAdmin(req, res) {
  if (!isAdminAuthConfigured()) {
    res.status(503).json({
      error: "Admin authorization is not configured (set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and ADMIN_EMAILS).",
    });
    return null;
  }

  const header = String((req.headers && req.headers.authorization) || "");
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      res.status(401).json({ error: "Unauthorized" });
      return null;
    }
    const user = await response.json();
    const email = (user && (user.email || (user.user_metadata && user.user_metadata.email))) || "";
    if (!isAllowedAdminEmail(email)) {
      res.status(403).json({ error: "Forbidden" });
      return null;
    }
    return user;
  } catch (e) {
    res.status(503).json({ error: "Unable to verify admin identity" });
    return null;
  }
}

module.exports = {
  applyAdminCors,
  isAdminAuthConfigured,
  isAllowedAdminEmail,
  isAllowedAdminOrigin,
  requireAdmin,
};
