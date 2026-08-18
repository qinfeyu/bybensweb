const SUPABASE_URL = process.env.SUPABASE_URL || "https://uogwlzuiemxwsnpigydg.supabase.co";

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/submit-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body || {}),
    });

    const data = await response.json().catch(() => ({ success: true }));
    res.setHeader("Content-Type", "application/json");
    return res.status(response.status || 200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to submit order" });
  }
};
