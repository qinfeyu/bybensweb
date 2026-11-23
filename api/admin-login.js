const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://uogwlzuiemxwsnpigydg.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  "";
const { applyAdminCors, isAdminAuthConfigured, isAllowedAdminEmail } = require("./_lib/admin-auth");
let auditLog = () => {};
try {
  ({ writeAuditLog: auditLog } = require("./_lib/audit-log"));
} catch (_) {}

module.exports = async function handler(req, res) {
  if (!applyAdminCors(req, res)) {
    return res.status(403).json({ error: "Origin not allowed" });
  }

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!isAdminAuthConfigured()) {
    return res.status(503).json({
      error: "Admin authorization is not configured (set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and ADMIN_EMAILS).",
    });
  }

  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    if (!response.ok) {
      await auditLog({ action: "auth.login_failed", actor: email, detail: `login failed for ${email}` });
      return res.status(response.status || 401).json({
        error: data.error_description || data.msg || data.message || "Invalid credentials"
      });
    }

    const verifiedEmail = (data.user || {}).email || email;
    if (!isAllowedAdminEmail(verifiedEmail)) {
      await auditLog({
        action: "auth.login_denied",
        actor: verifiedEmail,
        detail: `non-admin sign-in attempt for ${verifiedEmail}`,
      });
      return res.status(403).json({ error: "This account is not authorized for admin access" });
    }

    await auditLog({ action: "auth.login", actor: verifiedEmail, detail: `admin signed in` });
    return res.status(200).json({
      success: true,
      user: data.user,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
