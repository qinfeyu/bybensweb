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

module.exports = async function handler(req, res) {
  try {
    const headers = {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    };

    // Query PostgREST for settings and orders
    const settingsRes = await fetch(`${SUPABASE_URL}/rest/v1/settings?select=*`, { headers });
    const settings = await settingsRes.json();

    const ordersRes = await fetch(`${SUPABASE_URL}/rest/v1/orders?select=id,status,subtotal,total,created_at&order=created_at.desc&limit=5`, { headers });
    const orders = await ordersRes.json();

    return res.status(200).json({ settings, orders });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
