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

const SB_HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
};

async function sf(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: SB_HEADERS });
  const data = await res.json().catch(() => ([]));
  if (!res.ok) return [];
  return Array.isArray(data) ? data : [];
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const [orders, settings] = await Promise.all([
      sf("orders?select=*&order=created_at.desc&limit=100"),
      sf("settings?select=*"),
    ]);

    res.status(200).json({
      orders: Array.isArray(orders) ? orders : [],
      settings: Array.isArray(settings) ? settings : [],
    });
  } catch (err) {
    res.status(500).json({ orders: [], settings: [], error: err.message });
  }
};
