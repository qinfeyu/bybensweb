const SUPABASE_URL = "https://dbezrrzmcosxdoorbrgx.supabase.co";
const SUPABASE_KEY = Buffer.from("c2Jfc2VjcmV0X05SOTgxcWo2WGdyTGZHQ2M5WmRrWndfNXJ5UUg4bk0=", "base64").toString();

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
