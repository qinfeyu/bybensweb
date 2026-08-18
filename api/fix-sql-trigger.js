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

    // Test calling RPC or REST endpoints to inspect triggers
    const results = {};

    // Check if there are any custom RPC functions in PostgREST schema
    const rootRes = await fetch(`${SUPABASE_URL}/rest/v1/`, { headers });
    const schemaObj = await rootRes.json().catch(() => ({}));
    results.schema = schemaObj;

    return res.status(200).json(results);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
