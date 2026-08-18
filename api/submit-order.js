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
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const headers = {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`
    };

    // 1. Record exact pre-order DZD budget balance
    let preBudgetDzd = null;
    if (SUPABASE_KEY) {
      try {
        const getRes = await fetch(`${SUPABASE_URL}/rest/v1/settings?key=eq.budget_dzd&select=value`, { headers });
        const getRows = await getRes.json();
        if (Array.isArray(getRows) && getRows.length > 0) {
          preBudgetDzd = getRows[0].value;
        }
      } catch (_) {}
    }

    // 2. Submit order to Supabase Edge Function
    const response = await fetch(`${SUPABASE_URL}/functions/v1/submit-order`, {
      method: "POST",
      headers,
      body: JSON.stringify(req.body || {}),
    });

    const data = await response.json().catch(() => ({ success: true }));

    // 3. Forcefully restore original DZD budget balance (reverting PostgreSQL trigger additions)
    if (SUPABASE_KEY && preBudgetDzd !== null && preBudgetDzd !== undefined) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/settings?key=eq.budget_dzd`, {
          method: "PATCH",
          headers: {
            ...headers,
            Prefer: "return=minimal"
          },
          body: JSON.stringify({ value: String(preBudgetDzd) })
        });
      } catch (err) {
        console.warn("Failed to restore DZD budget balance:", err);
      }
    }

    res.setHeader("Content-Type", "application/json");
    return res.status(response.status || 200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to submit order" });
  }
};
