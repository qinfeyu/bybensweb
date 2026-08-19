const SUPABASE_URL = process.env.SUPABASE_URL || "https://dbezrrzmcosxdoorbrgx.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
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
      return res.status(response.status || 401).json({
        error: data.error_description || data.msg || data.message || "Invalid credentials"
      });
    }

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
